# Payment Routing

## Overview
This guide covers Lightning payment routing with LDK, including pathfinding, route optimization, and multi-path payments.

## Basic Routing

### Simple Payment Routing
```swift
import LightningDevKit

class PaymentRouter {
    let channelManager: Bindings.ChannelManager
    let router: Bindings.DefaultRouter
    let networkGraph: Bindings.NetworkGraph
    
    func sendPayment(invoice: String) async throws -> PaymentResult {
        // Parse invoice
        let parsedInvoice = try Bindings.Bolt11Invoice.fromStr(s: invoice)
        
        // Extract payment parameters
        let paymentParams = try Bindings.PaymentParameters.fromBolt11Invoice(
            invoice: parsedInvoice,
            isTestnet: networkGraph.isTestnet()
        )
        
        // Create route parameters
        let amountMsat = parsedInvoice.amountMilliSatoshis() ?? 0
        let routeParams = Bindings.RouteParameters(
            paymentParamsArg: paymentParams,
            finalValueMsatArg: amountMsat,
            maxTotalRoutingFeeMsatArg: calculateMaxFee(amountMsat)
        )
        
        // Find route
        let route = try router.findRoute(
            payer: channelManager.getOurNodeId(),
            routeParams: routeParams,
            first_hops: channelManager.listUsableChannels(),
            infraReply: .routeNotFound
        )
        
        // Send payment
        return try await sendPaymentWithRoute(
            route: route,
            paymentHash: parsedInvoice.paymentHash(),
            recipientOnion: parsedInvoice.paymentSecret()
        )
    }
}
```

### Route Finding with Constraints
```swift
class ConstrainedRouter {
    func findRouteWithConstraints(
        destination: [UInt8],
        amountMsat: UInt64,
        constraints: RouteConstraints
    ) throws -> Bindings.Route {
        // Build payment parameters with constraints
        var paymentParams = Bindings.PaymentParameters.forKeysend(
            payeePubkey: destination,
            finalCltvExpiryDelta: 40,
            allowMpp: constraints.allowMultiPath
        )
        
        // Set max fee
        paymentParams.setMaxTotalRoutingFeeSats(
            constraints.maxFeeSats ?? (amountMsat / 1000 / 100) // 1% default
        )
        
        // Set max path length
        paymentParams.setMaxPathLength(
            constraints.maxHops ?? 20
        )
        
        // Add preferred routes
        if let preferredNodes = constraints.preferredNodes {
            let hints = preferredNodes.map { node in
                Bindings.RouteHint(hopsArg: [
                    Bindings.RouteHintHop(
                        srcNodeIdArg: node,
                        shortChannelIdArg: 0,
                        fees: Bindings.RoutingFees(
                            baseMsatArg: 1000,
                            proportionalMillionthsArg: 100
                        ),
                        cltvExpiryDeltaArg: 40,
                        htlcMinimumMsatArg: nil,
                        htlcMaximumMsatArg: nil
                    )
                ])
            }
            paymentParams.setRouteHints(hints)
        }
        
        // Find route with constraints
        let routeParams = Bindings.RouteParameters(
            paymentParamsArg: paymentParams,
            finalValueMsatArg: amountMsat,
            maxTotalRoutingFeeMsatArg: constraints.maxFeeSats ?? amountMsat / 100
        )
        
        return try router.findRoute(
            payer: channelManager.getOurNodeId(),
            routeParams: routeParams,
            first_hops: channelManager.listUsableChannels(),
            infraReply: .routeNotFound
        )
    }
}
```

## Multi-Path Payments (MPP)

### Splitting Large Payments
```swift
class MultiPathPaymentRouter {
    func sendMultiPathPayment(
        invoice: Bindings.Bolt11Invoice,
        maxPaths: Int = 3
    ) async throws -> PaymentResult {
        let totalAmountMsat = invoice.amountMilliSatoshis() ?? 0
        
        // Enable MPP in payment parameters
        var paymentParams = try Bindings.PaymentParameters.fromBolt11Invoice(
            invoice: invoice,
            isTestnet: networkGraph.isTestnet()
        )
        paymentParams.setAllowMpp(true)
        paymentParams.setMaxMpppaths(UInt8(maxPaths))
        
        // Configure route parameters for MPP
        let routeParams = Bindings.RouteParameters(
            paymentParamsArg: paymentParams,
            finalValueMsatArg: totalAmountMsat,
            maxTotalRoutingFeeMsatArg: totalAmountMsat / 50 // 2% max fee
        )
        
        // Find multi-path route
        let routes = try findMultiPathRoute(
            routeParams: routeParams,
            maxPaths: maxPaths
        )
        
        // Send payment parts
        return try await sendMultiPathPayment(
            routes: routes,
            paymentHash: invoice.paymentHash()!,
            paymentSecret: invoice.paymentSecret()!
        )
    }
    
    private func findMultiPathRoute(
        routeParams: Bindings.RouteParameters,
        maxPaths: Int
    ) throws -> [Bindings.Route] {
        var routes: [Bindings.Route] = []
        var remainingAmount = routeParams.finalValueMsat
        let channels = channelManager.listUsableChannels()
        
        // Sort channels by available capacity
        let sortedChannels = channels.sorted {
            $0.getOutboundCapacityMsat() > $1.getOutboundCapacityMsat()
        }
        
        for channel in sortedChannels {
            guard remainingAmount > 0 && routes.count < maxPaths else { break }
            
            let channelCapacity = channel.getOutboundCapacityMsat()
            let pathAmount = min(remainingAmount, channelCapacity * 90 / 100) // Use 90% of capacity
            
            if pathAmount >= 1000 { // Minimum 1 sat per path
                var pathRouteParams = routeParams
                pathRouteParams.setFinalValueMsat(pathAmount)
                
                if let route = try? router.findRoute(
                    payer: channelManager.getOurNodeId(),
                    routeParams: pathRouteParams,
                    first_hops: [channel],
                    infraReply: .routeNotFound
                ) {
                    routes.append(route)
                    remainingAmount -= pathAmount
                }
            }
        }
        
        guard remainingAmount == 0 else {
            throw RoutingError.insufficientCapacity
        }
        
        return routes
    }
}
```

## Route Optimization

### Fee Optimization
```swift
class FeeOptimizedRouter {
    struct RouteCandidate {
        let route: Bindings.Route
        let totalFees: UInt64
        let successProbability: Double
    }
    
    func findOptimalRoute(
        destination: [UInt8],
        amountMsat: UInt64,
        maxAttempts: Int = 5
    ) throws -> Bindings.Route {
        var candidates: [RouteCandidate] = []
        
        // Try different fee/reliability trade-offs
        let feeMultipliers = [0.5, 1.0, 1.5, 2.0, 3.0]
        
        for multiplier in feeMultipliers {
            let maxFee = UInt64(Double(amountMsat) * 0.01 * multiplier) // Base 1% * multiplier
            
            var paymentParams = Bindings.PaymentParameters.forKeysend(
                payeePubkey: destination,
                finalCltvExpiryDelta: 40,
                allowMpp: false
            )
            paymentParams.setMaxTotalRoutingFeeSats(maxFee / 1000)
            
            let routeParams = Bindings.RouteParameters(
                paymentParamsArg: paymentParams,
                finalValueMsatArg: amountMsat,
                maxTotalRoutingFeeMsatArg: maxFee
            )
            
            if let route = try? router.findRoute(
                payer: channelManager.getOurNodeId(),
                routeParams: routeParams,
                first_hops: channelManager.listUsableChannels(),
                infraReply: .routeNotFound
            ) {
                let totalFees = calculateTotalFees(route)
                let probability = estimateSuccessProbability(route)
                
                candidates.append(RouteCandidate(
                    route: route,
                    totalFees: totalFees,
                    successProbability: probability
                ))
            }
        }
        
        // Select best route based on expected cost
        let bestCandidate = candidates.min { first, second in
            let firstExpectedCost = Double(first.totalFees) / first.successProbability
            let secondExpectedCost = Double(second.totalFees) / second.successProbability
            return firstExpectedCost < secondExpectedCost
        }
        
        guard let best = bestCandidate else {
            throw RoutingError.noRouteFound
        }
        
        return best.route
    }
}
```

### Reliability-Based Routing
```swift
class ReliabilityRouter {
    let scorer: Bindings.ProbabilisticScorer
    
    func findReliableRoute(
        destination: [UInt8],
        amountMsat: UInt64,
        minSuccessProbability: Double = 0.9
    ) throws -> Bindings.Route {
        // Configure scorer for reliability
        let scoringParams = Bindings.ProbabilisticScoringFeeParameters.default()
        scoringParams.setBaseUnitSats(1000) // Prefer reliability over fees
        scoringParams.setLiquidityPenaltyMultiplierMsat(40_000) // Heavy penalty for low liquidity
        
        scorer.setFeeParams(scoringParams)
        
        // Find routes and filter by reliability
        var attempts = 0
        let maxAttempts = 10
        
        while attempts < maxAttempts {
            let route = try findRouteWithScorer(
                destination: destination,
                amountMsat: amountMsat
            )
            
            let probability = estimateRouteProbability(route)
            if probability >= minSuccessProbability {
                return route
            }
            
            // Penalize failed route for next attempt
            for hop in route.getHops() {
                scorer.paymentPathFailed(
                    path: hop,
                    shortChannelId: hop.getShortChannelId()
                )
            }
            
            attempts += 1
        }
        
        throw RoutingError.noReliableRoute
    }
}
```

## Probing and Testing

### Route Probing
```swift
class RouteProber {
    func probeRoute(
        destination: [UInt8],
        amountMsat: UInt64
    ) async throws -> ProbeResult {
        // Create probe payment with random payment hash
        let probePaymentHash = try generateRandomBytes(count: 32)
        let probePaymentSecret = try generateRandomBytes(count: 32)
        
        // Find route
        let route = try findRoute(
            destination: destination,
            amountMsat: amountMsat
        )
        
        // Send probe
        let startTime = Date()
        let result = try await channelManager.sendProbeAlongRoute(
            route: route,
            paymentHash: probePaymentHash,
            paymentSecret: probePaymentSecret
        )
        
        let latency = Date().timeIntervalSince(startTime)
        
        return ProbeResult(
            success: result.isOk(),
            route: route,
            latency: latency,
            totalFees: calculateTotalFees(route)
        )
    }
    
    // Probe multiple routes in parallel
    func probeMultipleRoutes(
        destination: [UInt8],
        amountMsat: UInt64,
        routeCount: Int = 3
    ) async throws -> [ProbeResult] {
        let routes = try findAlternativeRoutes(
            destination: destination,
            amountMsat: amountMsat,
            count: routeCount
        )
        
        // Probe all routes concurrently
        return try await withThrowingTaskGroup(of: ProbeResult.self) { group in
            for route in routes {
                group.addTask {
                    try await self.probeSingleRoute(route)
                }
            }
            
            var results: [ProbeResult] = []
            for try await result in group {
                results.append(result)
            }
            
            return results.sorted { $0.latency < $1.latency }
        }
    }
}
```

## Advanced Routing Features

### Trampoline Routing
```swift
class TrampolineRouter {
    func sendTrampolinePayment(
        invoice: Bindings.Bolt11Invoice,
        trampolineNodes: [[UInt8]]
    ) async throws -> PaymentResult {
        // Build trampoline route
        let trampolineHops = trampolineNodes.map { nodeId in
            Bindings.TrampolineHop(
                nodeId: nodeId,
                fee: 1000, // 1 sat base fee
                cltvExpiryDelta: 144 // 1 day
            )
        }
        
        // Create trampoline payment
        let payment = Bindings.TrampolinePayment(
            invoice: invoice,
            trampolineRoute: trampolineHops
        )
        
        // Send via trampoline
        return try await channelManager.sendTrampolinePayment(payment)
    }
}
```

### Private Route Hints
```swift
class PrivateRouteManager {
    func addPrivateRouteHints(
        invoice: inout Bindings.Bolt11InvoiceBuilder,
        channels: [Bindings.ChannelDetails]
    ) {
        // Select best channels for route hints
        let eligibleChannels = channels
            .filter { $0.getIsUsable() && $0.getInboundCapacityMsat() > 100_000 }
            .sorted { $0.getInboundCapacityMsat() > $1.getInboundCapacityMsat() }
            .prefix(3) // Maximum 3 hints
        
        for channel in eligibleChannels {
            let hint = Bindings.RouteHint(hopsArg: [
                Bindings.RouteHintHop(
                    srcNodeIdArg: channel.getCounterparty().getNodeId(),
                    shortChannelIdArg: channel.getShortChannelId() ?? 0,
                    fees: Bindings.RoutingFees(
                        baseMsatArg: 1000,
                        proportionalMillionthsArg: 100
                    ),
                    cltvExpiryDeltaArg: 40,
                    htlcMinimumMsatArg: channel.getCounterparty().getOutboundHtlcMinimumMsat(),
                    htlcMaximumMsatArg: channel.getCounterparty().getOutboundHtlcMaximumMsat()
                )
            ])
            
            invoice.addPrivateRoute(hint)
        }
    }
}
```

## Route Analytics

### Payment Analytics
```swift
class RouteAnalytics {
    struct RouteMetrics {
        let totalPayments: Int
        let successRate: Double
        let averageFees: UInt64
        let averageHops: Double
        let popularNodes: [(nodeId: [UInt8], usage: Int)]
    }
    
    func analyzePaymentRoutes(
        timeframe: TimeInterval = 86400 * 30 // 30 days
    ) -> RouteMetrics {
        let payments = getPaymentsInTimeframe(timeframe)
        let successfulPayments = payments.filter { $0.status == .succeeded }
        
        // Calculate metrics
        let successRate = Double(successfulPayments.count) / Double(payments.count)
        
        let totalFees = successfulPayments.reduce(0) { $0 + $1.feePaidMsat }
        let averageFees = totalFees / UInt64(successfulPayments.count)
        
        let totalHops = successfulPayments.reduce(0) { $0 + $1.route.getHops().count }
        let averageHops = Double(totalHops) / Double(successfulPayments.count)
        
        // Find most used nodes
        var nodeUsage: [Data: Int] = [:]
        for payment in successfulPayments {
            for hop in payment.route.getHops() {
                let nodeId = Data(hop.getPubkey())
                nodeUsage[nodeId, default: 0] += 1
            }
        }
        
        let popularNodes = nodeUsage
            .sorted { $0.value > $1.value }
            .prefix(10)
            .map { (nodeId: Array($0.key), usage: $0.value) }
        
        return RouteMetrics(
            totalPayments: payments.count,
            successRate: successRate,
            averageFees: averageFees,
            averageHops: averageHops,
            popularNodes: popularNodes
        )
    }
}
```

## Best Practices

1. **Route Caching**: Cache successful routes for frequent destinations
2. **Probing**: Probe routes before large payments
3. **Fallback Routes**: Always have alternative routes ready
4. **Fee Limits**: Set reasonable maximum fees (1-3% typical)
5. **Timeout Handling**: Implement proper payment timeouts
6. **Route Diversity**: Use different routes to avoid detection
7. **Liquidity Monitoring**: Track channel liquidity for better routing
8. **Error Handling**: Implement retry logic with backoff