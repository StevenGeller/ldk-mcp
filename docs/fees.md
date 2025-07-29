# Fee Estimation

## Overview
This guide covers fee estimation for both Lightning Network routing fees and on-chain Bitcoin transaction fees in LDK.

## Lightning Fee Estimation

### Basic Fee Structure
```swift
import LightningDevKit

struct LightningFees {
    let baseFeeMilliSats: UInt32
    let proportionalFeePPM: UInt32 // Parts per million
    
    func calculateFee(amountMsat: UInt64) -> UInt64 {
        let baseFee = UInt64(baseFeeMilliSats)
        let proportionalFee = (amountMsat * UInt64(proportionalFeePPM)) / 1_000_000
        return baseFee + proportionalFee
    }
}

class LightningFeeEstimator {
    let networkGraph: Bindings.NetworkGraph
    
    func estimateRoutingFee(
        destination: [UInt8],
        amountMsat: UInt64
    ) throws -> FeeEstimate {
        // Get possible routes
        let routes = try findPossibleRoutes(
            destination: destination,
            amountMsat: amountMsat,
            maxRoutes: 5
        )
        
        // Calculate fees for each route
        let feeEstimates = routes.map { route in
            calculateRouteFees(route)
        }
        
        return FeeEstimate(
            minFee: feeEstimates.min() ?? 0,
            maxFee: feeEstimates.max() ?? 0,
            averageFee: feeEstimates.reduce(0, +) / UInt64(feeEstimates.count),
            medianFee: calculateMedian(feeEstimates)
        )
    }
    
    private func calculateRouteFees(_ route: Bindings.Route) -> UInt64 {
        var totalFees: UInt64 = 0
        let hops = route.getHops()
        
        // Skip last hop (destination doesn't charge fees)
        for i in 0..<(hops.count - 1) {
            let hop = hops[i]
            totalFees += hop.getFee()
        }
        
        return totalFees
    }
}
```

### Dynamic Fee Adjustment
```swift
class DynamicFeeManager {
    struct MarketConditions {
        let averageBaseFee: UInt32
        let averageProportionalFee: UInt32
        let networkCongestion: Double // 0.0 to 1.0
        let competitorFees: [LightningFees]
    }
    
    func calculateOptimalFees(
        channelBalance: ChannelBalance,
        marketConditions: MarketConditions
    ) -> LightningFees {
        // Base calculation on channel balance ratio
        let balanceRatio = Double(channelBalance.outboundMsat) / 
                          Double(channelBalance.totalCapacityMsat)
        
        var baseFee: UInt32
        var proportionalFee: UInt32
        
        if balanceRatio < 0.2 {
            // Low outbound liquidity - charge premium
            baseFee = marketConditions.averageBaseFee * 2
            proportionalFee = marketConditions.averageProportionalFee * 2
        } else if balanceRatio > 0.8 {
            // High outbound liquidity - offer discount
            baseFee = marketConditions.averageBaseFee / 2
            proportionalFee = marketConditions.averageProportionalFee / 2
        } else {
            // Balanced - use market rates
            baseFee = marketConditions.averageBaseFee
            proportionalFee = marketConditions.averageProportionalFee
        }
        
        // Adjust for network congestion
        if marketConditions.networkCongestion > 0.8 {
            baseFee = UInt32(Double(baseFee) * 1.5)
            proportionalFee = UInt32(Double(proportionalFee) * 1.5)
        }
        
        return LightningFees(
            baseFeeMilliSats: baseFee,
            proportionalFeePPM: proportionalFee
        )
    }
}
```

## On-Chain Fee Estimation

### Fee Estimator Implementation
```swift
class OnChainFeeEstimator: Bindings.FeeEstimator {
    private let feeRateCache = FeeRateCache()
    
    func getEstSatPer1000Weight(confirmationTarget: Bindings.ConfirmationTarget) -> UInt32 {
        switch confirmationTarget {
        case .onChainSweep:
            // High priority - next block
            return fetchFeeRate(targetBlocks: 1)
        case .minAllowedAnchorChannelRemoteFee:
            // Minimum for anchor channels
            return 253 // 1 sat/vbyte
        case .minAllowedNonAnchorChannelRemoteFee:
            // Minimum for non-anchor channels  
            return 1000 // ~4 sat/vbyte
        case .anchorChannelFee:
            // Normal priority for anchor channels
            return fetchFeeRate(targetBlocks: 6)
        case .nonAnchorChannelFee:
            // Normal priority for regular channels
            return fetchFeeRate(targetBlocks: 3)
        case .channelCloseMinimum:
            // Minimum for channel close
            return fetchFeeRate(targetBlocks: 144) // 1 day
        }
    }
    
    private func fetchFeeRate(targetBlocks: Int) -> UInt32 {
        // Check cache first
        if let cachedRate = feeRateCache.getRate(targetBlocks: targetBlocks) {
            return cachedRate
        }
        
        // Fetch from fee estimation service
        Task {
            do {
                let rate = try await fetchFromMempoolSpace(targetBlocks: targetBlocks)
                feeRateCache.setRate(targetBlocks: targetBlocks, rate: rate)
            } catch {
                // Fallback to hardcoded rates
                return getFallbackRate(targetBlocks: targetBlocks)
            }
        }
        
        // Return cached or fallback rate for now
        return feeRateCache.getRate(targetBlocks: targetBlocks) ?? 
               getFallbackRate(targetBlocks: targetBlocks)
    }
}
```

### Fee Rate Sources
```swift
class FeeRateProvider {
    enum FeeSource {
        case mempoolSpace
        case bitcoinCore
        case blockstream
        case fallback
    }
    
    func fetchFeeRates() async throws -> FeeRateEstimates {
        // Try multiple sources with fallback
        let sources: [FeeSource] = [.mempoolSpace, .blockstream, .bitcoinCore]
        
        for source in sources {
            do {
                switch source {
                case .mempoolSpace:
                    return try await fetchFromMempoolSpace()
                case .blockstream:
                    return try await fetchFromBlockstream()
                case .bitcoinCore:
                    return try await fetchFromBitcoinCore()
                default:
                    continue
                }
            } catch {
                Logger.warning("Fee source \(source) failed: \(error)")
                continue
            }
        }
        
        // All sources failed, use fallback
        return getFallbackRates()
    }
    
    private func fetchFromMempoolSpace() async throws -> FeeRateEstimates {
        let url = URL(string: "https://mempool.space/api/v1/fees/recommended")!
        let (data, _) = try await URLSession.shared.data(from: url)
        
        struct MempoolFees: Codable {
            let fastestFee: Int
            let halfHourFee: Int
            let hourFee: Int
            let economyFee: Int
            let minimumFee: Int
        }
        
        let fees = try JSONDecoder().decode(MempoolFees.self, from: data)
        
        return FeeRateEstimates(
            nextBlock: UInt32(fees.fastestFee * 250), // Convert to sat/1000weight
            threeBlocks: UInt32(fees.halfHourFee * 250),
            sixBlocks: UInt32(fees.hourFee * 250),
            twelveBlocks: UInt32(fees.economyFee * 250),
            oneDayBlocks: UInt32(fees.minimumFee * 250)
        )
    }
}
```

### Transaction Size Estimation
```swift
class TransactionSizeEstimator {
    struct TransactionWeights {
        let baseWeight: Int
        let inputWeight: Int
        let outputWeight: Int
        
        static let p2wpkh = TransactionWeights(
            baseWeight: 42 * 4, // Version + locktime + counts
            inputWeight: 68 * 4, // Witness input
            outputWeight: 31 * 4 // P2WPKH output
        )
        
        static let p2wsh = TransactionWeights(
            baseWeight: 42 * 4,
            inputWeight: 104 * 4, // Larger witness
            outputWeight: 43 * 4 // P2WSH output
        )
    }
    
    func estimateTransactionWeight(
        inputs: Int,
        outputs: Int,
        scriptType: ScriptType = .p2wpkh
    ) -> Int {
        let weights = scriptType == .p2wpkh ? 
                     TransactionWeights.p2wpkh : 
                     TransactionWeights.p2wsh
        
        return weights.baseWeight + 
               (inputs * weights.inputWeight) + 
               (outputs * weights.outputWeight)
    }
    
    func calculateFee(
        weight: Int,
        feeRatePerKWeight: UInt32
    ) -> UInt64 {
        return (UInt64(weight) * UInt64(feeRatePerKWeight)) / 1000
    }
}
```

## Channel-Specific Fee Estimation

### Opening Channel Fees
```swift
class ChannelOpenFeeEstimator {
    let feeEstimator: OnChainFeeEstimator
    let sizeEstimator: TransactionSizeEstimator
    
    func estimateChannelOpenFee(
        fundingAmount: UInt64,
        isAnchorChannel: Bool = true
    ) async throws -> ChannelOpenFeeEstimate {
        // Get current fee rates
        let feeRate = feeEstimator.getEstSatPer1000Weight(
            confirmationTarget: isAnchorChannel ? .anchorChannelFee : .nonAnchorChannelFee
        )
        
        // Estimate transaction size
        // 1 input (funding), 2 outputs (channel + change)
        let estimatedWeight = sizeEstimator.estimateTransactionWeight(
            inputs: 1,
            outputs: 2,
            scriptType: .p2wpkh
        )
        
        let openingFee = sizeEstimator.calculateFee(
            weight: estimatedWeight,
            feeRatePerKWeight: feeRate
        )
        
        // Calculate reserve requirements
        let channelReserve = calculateChannelReserve(
            channelValue: fundingAmount,
            isAnchor: isAnchorChannel
        )
        
        return ChannelOpenFeeEstimate(
            totalFee: openingFee,
            feeRate: feeRate,
            channelReserve: channelReserve,
            minimumFunding: channelReserve + openingFee + 10_000 // dust limit
        )
    }
    
    private func calculateChannelReserve(
        channelValue: UInt64,
        isAnchor: Bool
    ) -> UInt64 {
        // 1% of channel value, minimum 1000 sats
        let reservePercent = channelValue / 100
        let minimumReserve: UInt64 = isAnchor ? 354 : 1000
        return max(reservePercent, minimumReserve)
    }
}
```

### Closing Channel Fees
```swift
class ChannelCloseFeeEstimator {
    func estimateCooperativeCloseFee(
        channelBalance: UInt64,
        targetConfirmation: Int = 6
    ) async throws -> UInt64 {
        let feeRate = await fetchFeeRate(targetBlocks: targetConfirmation)
        
        // Cooperative close: 1 input, 2 outputs typically
        let weight = TransactionWeights.p2wpkh.baseWeight +
                    TransactionWeights.p2wpkh.inputWeight +
                    (2 * TransactionWeights.p2wpkh.outputWeight)
        
        return calculateFee(weight: weight, feeRatePerKWeight: feeRate)
    }
    
    func estimateForceCloseFee(
        pendingHTLCs: Int,
        isAnchorChannel: Bool
    ) async throws -> ForceCloseFeeEstimate {
        // Commitment transaction
        let commitmentWeight = calculateCommitmentWeight(
            htlcCount: pendingHTLCs,
            isAnchor: isAnchorChannel
        )
        
        let commitmentFeeRate = feeEstimator.getEstSatPer1000Weight(
            confirmationTarget: .onChainSweep
        )
        
        let commitmentFee = calculateFee(
            weight: commitmentWeight,
            feeRatePerKWeight: commitmentFeeRate
        )
        
        // HTLC transactions (if any)
        let htlcFees = pendingHTLCs > 0 ? 
            estimateHTLCFees(count: pendingHTLCs) : 0
        
        // Sweep transaction
        let sweepWeight = TransactionWeights.p2wpkh.baseWeight +
                         TransactionWeights.p2wpkh.inputWeight +
                         TransactionWeights.p2wpkh.outputWeight
        
        let sweepFee = calculateFee(
            weight: sweepWeight,
            feeRatePerKWeight: commitmentFeeRate
        )
        
        return ForceCloseFeeEstimate(
            commitmentTxFee: commitmentFee,
            htlcTxFees: htlcFees,
            sweepTxFee: sweepFee,
            totalEstimatedFee: commitmentFee + htlcFees + sweepFee,
            timeToFullResolution: pendingHTLCs > 0 ? "3-7 days" : "1-2 days"
        )
    }
}
```

## Fee Optimization Strategies

### Batch Operations
```swift
class BatchFeeOptimizer {
    func optimizeBatchChannelOpen(
        channelRequests: [ChannelOpenRequest]
    ) async throws -> BatchOpenPlan {
        // Sort by urgency
        let sorted = channelRequests.sorted { $0.priority > $1.priority }
        
        // Group by similar fee requirements
        let feeGroups = Dictionary(grouping: sorted) { request in
            determineFeeGroup(priority: request.priority)
        }
        
        var plans: [BatchOpenPlan.Group] = []
        
        for (feeGroup, requests) in feeGroups {
            let feeRate = getFeeRateForGroup(feeGroup)
            
            // Calculate batch transaction size
            let batchWeight = calculateBatchWeight(channelCount: requests.count)
            let totalFee = calculateFee(
                weight: batchWeight,
                feeRatePerKWeight: feeRate
            )
            
            // Split fee among channels proportionally
            let feePerChannel = requests.map { request in
                let proportion = Double(request.amount) / 
                                Double(requests.reduce(0) { $0 + $1.amount })
                return UInt64(Double(totalFee) * proportion)
            }
            
            plans.append(BatchOpenPlan.Group(
                requests: requests,
                feeRate: feeRate,
                totalFee: totalFee,
                feePerChannel: feePerChannel,
                estimatedConfirmation: feeGroup.targetBlocks
            ))
        }
        
        return BatchOpenPlan(groups: plans)
    }
}
```

### Fee Bumping (RBF)
```swift
class FeeBumpManager {
    func bumpTransactionFee(
        txid: String,
        newFeeRate: UInt32
    ) throws -> Transaction {
        // Get original transaction
        let originalTx = try getTransaction(txid: txid)
        
        // Calculate new fee
        let txWeight = calculateTransactionWeight(tx: originalTx)
        let newFee = calculateFee(
            weight: txWeight,
            feeRatePerKWeight: newFeeRate
        )
        
        let oldFee = calculateCurrentFee(tx: originalTx)
        guard newFee > oldFee * 110 / 100 else { // Minimum 10% increase
            throw FeeError.insufficientFeeBump
        }
        
        // Create replacement transaction
        var replacementTx = originalTx
        replacementTx.fee = newFee
        
        // Reduce change output to pay for increased fee
        let feeDifference = newFee - oldFee
        if let changeOutput = findChangeOutput(tx: &replacementTx) {
            changeOutput.value -= feeDifference
            
            // Check dust limit
            if changeOutput.value < 546 {
                // Remove change output entirely
                replacementTx.outputs.removeAll { $0 == changeOutput }
            }
        }
        
        return replacementTx
    }
}
```

## Fee Analytics

### Historical Fee Analysis
```swift
class FeeAnalytics {
    func analyzeFeeHistory(days: Int = 30) -> FeeHistoryReport {
        let payments = getPaymentHistory(days: days)
        
        // Lightning fee analysis
        let lightningFees = payments
            .filter { $0.type == .lightning }
            .map { $0.feesPaid }
        
        let lightningStats = FeeStatistics(
            total: lightningFees.reduce(0, +),
            average: lightningFees.reduce(0, +) / UInt64(lightningFees.count),
            median: calculateMedian(lightningFees),
            asPercentOfVolume: calculateFeePercentage(fees: lightningFees, payments: payments)
        )
        
        // On-chain fee analysis
        let onChainFees = payments
            .filter { $0.type == .onChain }
            .map { $0.feesPaid }
        
        let onChainStats = FeeStatistics(
            total: onChainFees.reduce(0, +),
            average: onChainFees.reduce(0, +) / UInt64(onChainFees.count),
            median: calculateMedian(onChainFees),
            overpaidEstimate: estimateOverpayment(payments: payments)
        )
        
        return FeeHistoryReport(
            lightning: lightningStats,
            onChain: onChainStats,
            recommendations: generateFeeRecommendations(stats: lightningStats, onChainStats)
        )
    }
}
```

## Best Practices

1. **Cache Fee Estimates**: Reduce API calls by caching recent estimates
2. **Multiple Sources**: Use fallback fee sources for reliability
3. **Dynamic Adjustment**: Adjust Lightning fees based on channel balance
4. **Batch Operations**: Combine multiple operations to save on fees
5. **Monitor Mempool**: Track mempool conditions for optimal timing
6. **User Control**: Allow users to choose between speed and cost
7. **Fee Limits**: Implement maximum fee limits to prevent overpayment
8. **Analytics**: Track fee spending to optimize over time