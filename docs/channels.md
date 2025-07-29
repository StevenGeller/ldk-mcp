# Channel Management

## Overview
This guide covers Lightning channel lifecycle management using LDK, including opening, monitoring, and closing channels.

## Channel Opening

### Basic Channel Opening
```swift
import LightningDevKit

class ChannelOpener {
    let channelManager: Bindings.ChannelManager
    let peerManager: Bindings.PeerManager
    
    func openChannel(
        nodeId: [UInt8],
        channelValue: UInt64,
        pushMsat: UInt64 = 0,
        isPublic: Bool = false
    ) async throws -> [UInt8; 32] {
        // Create user channel ID
        let userChannelId = try generateUserChannelId()
        
        // Configure channel
        let channelConfig = Bindings.ChannelConfig()
        channelConfig.setMaxDustHtlcExposure(
            .feeRateMultiplier(multiplier: 5000)
        )
        channelConfig.setForceCloseAvoidanceMaxFeeSatoshis(1000)
        
        // Open channel
        let result = channelManager.createChannel(
            theirNetworkKey: nodeId,
            channelValueSatoshis: channelValue,
            pushMsat: pushMsat,
            userChannelId: userChannelId,
            overrideConfig: channelConfig
        )
        
        switch result {
        case .ok(let temporaryChannelId):
            return temporaryChannelId
        case .err(let error):
            throw ChannelError.openFailed(error)
        }
    }
}
```

### Batch Channel Opening
```swift
class BatchChannelOpener {
    func openMultipleChannels(_ requests: [ChannelRequest]) async throws {
        // Group by target fee rate
        let groupedRequests = Dictionary(grouping: requests) { $0.targetFeeRate }
        
        for (feeRate, channels) in groupedRequests {
            // Create batch funding transaction
            let fundingTx = try await createBatchFundingTransaction(
                channels: channels,
                feeRate: feeRate
            )
            
            // Open all channels in batch
            for channel in channels {
                try await openChannelWithFunding(
                    channel: channel,
                    fundingTx: fundingTx
                )
            }
        }
    }
}
```

## Channel Monitoring

### Real-time Channel Status
```swift
class ChannelMonitor {
    let channelManager: Bindings.ChannelManager
    
    func getChannelStatus() -> [ChannelInfo] {
        let channels = channelManager.listChannels()
        
        return channels.map { details in
            ChannelInfo(
                channelId: details.getChannelId(),
                counterpartyNodeId: details.getCounterparty().getNodeId(),
                channelValueSats: details.getChannelValueSatoshis(),
                balanceMsat: details.getBalanceMsat(),
                inboundCapacityMsat: details.getInboundCapacityMsat(),
                outboundCapacityMsat: details.getOutboundCapacityMsat(),
                isUsable: details.getIsUsable(),
                isPublic: details.getIsPublic(),
                state: parseChannelState(details)
            )
        }
    }
    
    func parseChannelState(_ details: Bindings.ChannelDetails) -> ChannelState {
        if !details.getIsChannelReady() {
            return .pending
        } else if details.getIsUsable() {
            return .active
        } else {
            return .inactive
        }
    }
}
```

### Channel Health Monitoring
```swift
class ChannelHealthMonitor {
    struct ChannelHealth {
        let channelId: [UInt8; 32]
        let healthScore: Double
        let issues: [HealthIssue]
    }
    
    func assessChannelHealth(_ channel: ChannelDetails) -> ChannelHealth {
        var issues: [HealthIssue] = []
        var score = 1.0
        
        // Check liquidity balance
        let totalCapacity = channel.getChannelValueSatoshis() * 1000 // to msat
        let outboundRatio = Double(channel.getOutboundCapacityMsat()) / Double(totalCapacity)
        
        if outboundRatio < 0.1 {
            issues.append(.lowOutboundLiquidity)
            score -= 0.3
        } else if outboundRatio > 0.9 {
            issues.append(.lowInboundLiquidity)
            score -= 0.3
        }
        
        // Check channel age and activity
        if let lastActivity = getLastChannelActivity(channel.getChannelId()) {
            let daysSinceActivity = Date().timeIntervalSince(lastActivity) / 86400
            if daysSinceActivity > 30 {
                issues.append(.inactive)
                score -= 0.2
            }
        }
        
        // Check fee rates
        if let feeRate = channel.getConfig()?.getForwardingFeeBaseMsat() {
            if feeRate > marketAverageFee * 2 {
                issues.append(.highFees)
                score -= 0.1
            }
        }
        
        return ChannelHealth(
            channelId: channel.getChannelId()!,
            healthScore: max(0, score),
            issues: issues
        )
    }
}
```

## Channel Operations

### Fee Management
```swift
class ChannelFeeManager {
    func updateChannelFees(
        channelId: [UInt8; 32],
        baseFee: UInt32,
        proportionalFee: UInt32
    ) throws {
        let config = Bindings.ChannelConfig()
        config.setForwardingFeeBaseMsat(baseFee)
        config.setForwardingFeeProportionalMillionths(proportionalFee)
        
        let result = channelManager.updateChannelConfig(
            counterpartyNodeId: getCounterpartyForChannel(channelId),
            channelIds: [channelId],
            config: config
        )
        
        guard result.isOk() else {
            throw ChannelError.feeUpdateFailed
        }
    }
    
    // Dynamic fee adjustment based on channel usage
    func optimizeFees() {
        for channel in channelManager.listChannels() {
            let usage = calculateChannelUsage(channel)
            let optimalFees = calculateOptimalFees(
                usage: usage,
                capacity: channel.getChannelValueSatoshis(),
                marketConditions: getCurrentMarketConditions()
            )
            
            try? updateChannelFees(
                channelId: channel.getChannelId()!,
                baseFee: optimalFees.base,
                proportionalFee: optimalFees.proportional
            )
        }
    }
}
```

### Channel Rebalancing
```swift
class ChannelRebalancer {
    func rebalanceChannels(
        from: [UInt8; 32],
        to: [UInt8; 32],
        amountMsat: UInt64
    ) async throws {
        // Create circular payment to rebalance
        let invoice = try await createRebalanceInvoice(
            amountMsat: amountMsat,
            targetChannel: to
        )
        
        // Route payment through specific channel
        let routeParams = Bindings.RouteParameters(
            paymentParamsArg: paymentParams,
            finalValueMsatArg: amountMsat,
            maxTotalRoutingFeeMsatArg: amountMsat / 100 // 1% max fee
        )
        
        // Force first hop through source channel
        let firstHop = getFirstHopForChannel(from)
        let route = try router.findRouteWithFirstHop(
            firstHop: firstHop,
            routeParams: routeParams
        )
        
        // Send payment
        try await sendPaymentAlongRoute(route: route, invoice: invoice)
    }
}
```

## Channel Closing

### Cooperative Close
```swift
class ChannelCloser {
    func closeChannelCooperatively(
        channelId: [UInt8; 32],
        targetFeeSatsPerVbyte: UInt32? = nil
    ) throws {
        let result = channelManager.closeChannel(
            channelId: channelId,
            counterpartyNodeId: getCounterpartyForChannel(channelId),
            targetFeeSatoshisPerVirtualByte: targetFeeSatsPerVbyte
        )
        
        switch result {
        case .ok:
            Logger.info("Initiated cooperative close for channel \(channelId.toHex())")
        case .err(let error):
            throw ChannelError.closeFailed(error)
        }
    }
}
```

### Force Close
```swift
extension ChannelCloser {
    func forceCloseChannel(
        channelId: [UInt8; 32],
        broadcastImmediately: Bool = true
    ) throws {
        let result = channelManager.forceCloseBroadcastingLatestTxn(
            channelId: channelId,
            counterpartyNodeId: getCounterpartyForChannel(channelId)
        )
        
        switch result {
        case .ok:
            Logger.warning("Force closed channel \(channelId.toHex())")
            if broadcastImmediately {
                try broadcastPendingTransactions()
            }
        case .err(let error):
            throw ChannelError.forceCloseFailed(error)
        }
    }
    
    // Monitor force close resolution
    func monitorForceClose(channelId: [UInt8; 32]) {
        let monitor = chainMonitor.getMonitor(channelId)
        
        monitor.onEvent = { event in
            switch event {
            case .commitmentTxConfirmed(let height):
                Logger.info("Commitment tx confirmed at height \(height)")
            case .htlcResolved(let htlcId, let amount):
                Logger.info("HTLC \(htlcId) resolved for \(amount) sats")
            case .fundsRecovered(let amount):
                Logger.info("Recovered \(amount) sats from force close")
                notifyUserFundsRecovered(amount)
            }
        }
    }
}
```

## Advanced Channel Features

### Splicing Support
```swift
class ChannelSplicer {
    func spliceIn(
        channelId: [UInt8; 32],
        additionalSats: UInt64
    ) async throws {
        // Check if peer supports splicing
        let peerFeatures = getPeerFeatures(channelId)
        guard peerFeatures.supportsChannelSplicing() else {
            throw ChannelError.splicingNotSupported
        }
        
        // Initiate splice
        let spliceRequest = Bindings.SpliceRequest(
            channelId: channelId,
            satsDelta: Int64(additionalSats),
            feerate: getCurrentFeeRate()
        )
        
        try await performSplice(spliceRequest)
    }
}
```

### Zero-Conf Channels
```swift
class ZeroConfChannelManager {
    func acceptZeroConfChannel(
        temporaryChannelId: [UInt8; 32],
        counterparty: [UInt8]
    ) -> Bool {
        // Check if we trust this peer for zero-conf
        let trustLevel = evaluatePeerTrust(counterparty)
        guard trustLevel >= .high else {
            return false
        }
        
        // Check channel size is within acceptable range
        let channelValue = getProposedChannelValue(temporaryChannelId)
        guard channelValue <= maxZeroConfChannelSize else {
            return false
        }
        
        // Accept zero-conf
        channelManager.acceptInboundChannelFromTrustedPeer(
            temporaryChannelId: temporaryChannelId,
            counterpartyNodeId: counterparty,
            userChannelId: generateUserChannelId()
        )
        
        return true
    }
}
```

## Best Practices

1. **Channel Sizing**: Open channels with sufficient capacity for expected payment volume
2. **Peer Selection**: Choose well-connected, reliable peers
3. **Fee Management**: Regularly adjust fees based on channel usage
4. **Liquidity Management**: Maintain balanced channels for routing
5. **Monitoring**: Set up alerts for channel issues
6. **Backup**: Always backup channel state after changes
7. **Security**: Validate all channel operations
8. **Documentation**: Keep records of all channel events