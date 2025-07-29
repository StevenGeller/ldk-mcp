import { Tool, ToolResult } from '../types/tool.js';

export const eventHandlingTool: Tool = {
  name: 'ldk_event_handling',
  description: 'Get comprehensive LDK event handling patterns and implementations',
  inputSchema: {
    type: 'object',
    properties: {
      eventType: {
        type: 'string',
        enum: [
          'all_events',
          'payment_events',
          'channel_events',
          'funding_events',
          'spendable_outputs',
          'forwarding_events',
          'event_persistence'
        ],
        description: 'Type of event handling to get code for'
      }
    },
    required: ['eventType']
  },
  execute: async (args: any): Promise<ToolResult> => {
    const eventExamples: Record<string, string> = {
      all_events: `
// Comprehensive LDK Event Handler
import LightningDevKit
import BitcoinDevKit

class LDKEventHandler: Bindings.EventHandler {
    private let channelManager: Bindings.ChannelManager
    private let wallet: BitcoinDevKit.Wallet
    private let keysManager: Bindings.KeysManager
    private let networkGraph: Bindings.NetworkGraph
    private let logger: Bindings.Logger
    private let broadcaster: Bindings.BroadcasterInterface
    
    init(
        channelManager: Bindings.ChannelManager,
        wallet: BitcoinDevKit.Wallet,
        keysManager: Bindings.KeysManager,
        networkGraph: Bindings.NetworkGraph,
        logger: Bindings.Logger,
        broadcaster: Bindings.BroadcasterInterface
    ) {
        self.channelManager = channelManager
        self.wallet = wallet
        self.keysManager = keysManager
        self.networkGraph = networkGraph
        self.logger = logger
        self.broadcaster = broadcaster
        super.init()
    }
    
    override func handleEvent(event: Bindings.Event) {
        // Log all events
        logger.log(message: "Handling event: \\(event.getValueType())")
        
        switch event.getValueType() {
        // Payment Events
        case .PaymentClaimable:
            handlePaymentClaimable(event.getValueAsPaymentClaimable()!)
        case .PaymentClaimed:
            handlePaymentClaimed(event.getValueAsPaymentClaimed()!)
        case .PaymentSent:
            handlePaymentSent(event.getValueAsPaymentSent()!)
        case .PaymentFailed:
            handlePaymentFailed(event.getValueAsPaymentFailed()!)
        case .PaymentPathSuccessful:
            handlePaymentPathSuccessful(event.getValueAsPaymentPathSuccessful()!)
        case .PaymentPathFailed:
            handlePaymentPathFailed(event.getValueAsPaymentPathFailed()!)
        case .PaymentForwarded:
            handlePaymentForwarded(event.getValueAsPaymentForwarded()!)
            
        // Channel Events
        case .FundingGenerationReady:
            handleFundingGenerationReady(event.getValueAsFundingGenerationReady()!)
        case .ChannelReady:
            handleChannelReady(event.getValueAsChannelReady()!)
        case .ChannelClosed:
            handleChannelClosed(event.getValueAsChannelClosed()!)
        case .DiscardFunding:
            handleDiscardFunding(event.getValueAsDiscardFunding()!)
        case .OpenChannelRequest:
            handleOpenChannelRequest(event.getValueAsOpenChannelRequest()!)
            
        // HTLC Events
        case .HTLCIntercepted:
            handleHTLCIntercepted(event.getValueAsHTLCIntercepted()!)
        case .HTLCHandlingFailed:
            handleHTLCHandlingFailed(event.getValueAsHTLCHandlingFailed()!)
            
        // Output Events
        case .SpendableOutputs:
            handleSpendableOutputs(event.getValueAsSpendableOutputs()!)
            
        // Probe Events
        case .ProbeFailed:
            handleProbeFailed(event.getValueAsProbeFailed()!)
        case .ProbeSuccessful:
            handleProbeSuccessful(event.getValueAsProbeSuccessful()!)
            
        // Other Events
        case .PendingHTLCsForwardable:
            handlePendingHTLCsForwardable(event.getValueAsPendingHTLCsForwardable()!)
        case .BumpTransaction:
            handleBumpTransaction(event.getValueAsBumpTransaction()!)
        case .InvoiceRequestFailed:
            handleInvoiceRequestFailed(event.getValueAsInvoiceRequestFailed()!)
        case .ConnectionNeeded:
            handleConnectionNeeded(event.getValueAsConnectionNeeded()!)
            
        default:
            logger.log(message: "Unhandled event type: \\(event.getValueType())")
        }
        
        // Persist event for recovery
        persistEvent(event)
    }
    
    private func persistEvent(_ event: Bindings.Event) {
        // Store event for potential replay during recovery
        EventPersistence.shared.store(event: event)
    }
}`.trim(),

      payment_events: `
// Payment Event Handling
import LightningDevKit
import UserNotifications

extension LDKEventHandler {
    // Payment Claimable - Incoming payment detected
    func handlePaymentClaimable(_ event: Bindings.Event.PaymentClaimable) {
        let paymentHash = event.getPaymentHash()
        let amountMsat = event.getClaimableAmountMsat()
        let purpose = event.getPurpose()
        let claimDeadline = event.getClaimDeadline()
        
        // Auto-claim the payment
        if let preimage = extractPaymentPreimage(purpose: purpose) {
            channelManager.claimFunds(paymentPreimage: preimage)
            
            // Log successful claim attempt
            logger.log(message: "Claiming payment: \\(Data(paymentHash).hexString) for \\(amountMsat) msat")
        }
        
        // Store pending payment
        PaymentStore.shared.storePendingPayment(
            paymentHash: Data(paymentHash).hexString,
            amountMsat: amountMsat,
            purpose: purpose,
            claimDeadline: claimDeadline
        )
        
        // Notify UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .paymentClaimable,
                object: nil,
                userInfo: [
                    "paymentHash": Data(paymentHash).hexString,
                    "amountMsat": amountMsat,
                    "description": self.extractDescription(purpose: purpose)
                ]
            )
        }
    }
    
    // Payment Claimed - Successfully received payment
    func handlePaymentClaimed(_ event: Bindings.Event.PaymentClaimed) {
        let paymentHash = event.getPaymentHash()
        let amountMsat = event.getAmountMsat()
        let purpose = event.getPurpose()
        let receivers = event.getReceivers()
        let htlcs = event.getHtlcs()
        
        // Update payment record
        PaymentStore.shared.markPaymentClaimed(
            paymentHash: Data(paymentHash).hexString,
            amountMsat: amountMsat,
            receivers: receivers,
            htlcs: htlcs
        )
        
        // Show notification
        showPaymentNotification(
            title: "Payment Received",
            body: "Received \\(amountMsat / 1000) sats",
            identifier: Data(paymentHash).hexString
        )
        
        // Update balance
        BalanceManager.shared.updateBalance()
        
        // Log for analytics
        Analytics.logPaymentReceived(
            amountMsat: amountMsat,
            paymentType: getPaymentType(purpose: purpose)
        )
    }
    
    // Payment Sent - Outgoing payment succeeded
    func handlePaymentSent(_ event: Bindings.Event.PaymentSent) {
        let paymentId = event.getPaymentId()
        let paymentPreimage = event.getPaymentPreimage()
        let paymentHash = event.getPaymentHash()
        let feePaidMsat = event.getFeePaidMsat()?.getValue() ?? 0
        
        // Update payment record
        PaymentStore.shared.markPaymentSent(
            paymentId: paymentId?.data.hexString,
            paymentHash: Data(paymentHash).hexString,
            preimage: Data(paymentPreimage).hexString,
            feeMsat: feePaidMsat
        )
        
        // Update UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .paymentSent,
                object: nil,
                userInfo: [
                    "paymentHash": Data(paymentHash).hexString,
                    "feeMsat": feePaidMsat
                ]
            )
        }
        
        // Log success
        logger.log(message: "Payment sent successfully. Fee: \\(feePaidMsat) msat")
    }
    
    // Payment Failed - Outgoing payment failed
    func handlePaymentFailed(_ event: Bindings.Event.PaymentFailed) {
        let paymentId = event.getPaymentId()
        let paymentHash = event.getPaymentHash()
        let reason = event.getReason()
        
        // Parse failure reason
        let failureReason = parsePaymentFailureReason(reason)
        
        // Update payment record
        PaymentStore.shared.markPaymentFailed(
            paymentId: paymentId.data.hexString,
            paymentHash: Data(paymentHash).hexString,
            reason: failureReason
        )
        
        // Notify UI with detailed error
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .paymentFailed,
                object: nil,
                userInfo: [
                    "paymentHash": Data(paymentHash).hexString,
                    "reason": failureReason.description,
                    "isRetryable": failureReason.isRetryable
                ]
            )
        }
        
        // Log failure for debugging
        logger.log(message: "Payment failed: \\(failureReason.description)")
    }
    
    // Helper methods
    private func extractPaymentPreimage(purpose: Bindings.PaymentPurpose) -> [UInt8]? {
        switch purpose.getValueType() {
        case .Bolt11InvoicePayment:
            if let bolt11 = purpose.getValueAsBolt11InvoicePayment() {
                return bolt11.getPaymentPreimage()?.getValue()
            }
        case .Bolt12OfferPayment:
            if let bolt12 = purpose.getValueAsBolt12OfferPayment() {
                return bolt12.getPaymentPreimage()?.getValue()
            }
        case .Bolt12RefundPayment:
            if let refund = purpose.getValueAsBolt12RefundPayment() {
                return refund.getPaymentPreimage()?.getValue()
            }
        case .SpontaneousPayment:
            if let spontaneous = purpose.getValueAsSpontaneousPayment() {
                return spontaneous.getSpontaneousPayment()
            }
        default:
            break
        }
        return nil
    }
    
    private func extractDescription(purpose: Bindings.PaymentPurpose) -> String {
        switch purpose.getValueType() {
        case .Bolt11InvoicePayment:
            return "Lightning Invoice"
        case .Bolt12OfferPayment:
            return "BOLT12 Offer"
        case .Bolt12RefundPayment:
            return "BOLT12 Refund"
        case .SpontaneousPayment:
            return "Spontaneous Payment"
        default:
            return "Unknown Payment"
        }
    }
    
    private func parsePaymentFailureReason(_ reason: Bindings.PaymentFailureReason?) -> PaymentFailure {
        guard let reason = reason else {
            return PaymentFailure(type: .unknown, description: "Unknown failure", isRetryable: true)
        }
        
        switch reason.getValueType() {
        case .RecipientRejected:
            return PaymentFailure(type: .recipientRejected, description: "Recipient rejected payment", isRetryable: false)
        case .UserAbandoned:
            return PaymentFailure(type: .userAbandoned, description: "Payment abandoned by user", isRetryable: false)
        case .RetriesExhausted:
            return PaymentFailure(type: .retriesExhausted, description: "All payment retries exhausted", isRetryable: false)
        case .PaymentExpired:
            return PaymentFailure(type: .expired, description: "Payment expired", isRetryable: false)
        case .RouteNotFound:
            return PaymentFailure(type: .noRoute, description: "No route found", isRetryable: true)
        case .UnexpectedError:
            return PaymentFailure(type: .unexpected, description: "Unexpected error", isRetryable: true)
        default:
            return PaymentFailure(type: .unknown, description: "Unknown failure", isRetryable: true)
        }
    }
}

struct PaymentFailure {
    enum FailureType {
        case recipientRejected
        case userAbandoned
        case retriesExhausted
        case expired
        case noRoute
        case unexpected
        case unknown
    }
    
    let type: FailureType
    let description: String
    let isRetryable: Bool
}

// Notification Names
extension Notification.Name {
    static let paymentClaimable = Notification.Name("ldk.payment.claimable")
    static let paymentClaimed = Notification.Name("ldk.payment.claimed")
    static let paymentSent = Notification.Name("ldk.payment.sent")
    static let paymentFailed = Notification.Name("ldk.payment.failed")
}`.trim(),

      channel_events: `
// Channel Event Handling
import LightningDevKit
import BitcoinDevKit

extension LDKEventHandler {
    // Funding Generation Ready - Need to create funding transaction
    func handleFundingGenerationReady(_ event: Bindings.Event.FundingGenerationReady) {
        Task {
            do {
                let channelValue = event.getChannelValueSatoshis()
                let outputScript = event.getOutputScript()
                let userChannelId = event.getUserChannelId()
                
                // Build funding transaction with BDK
                let address = try BitcoinDevKit.Address(
                    scriptPubkey: BitcoinDevKit.Script(rawOutputScript: outputScript)
                )
                
                let txBuilder = try BitcoinDevKit.TxBuilder()
                    .addRecipient(script: address.scriptPubkey(), amount: channelValue)
                    .feeRate(satPerVbyte: Float(await getFeeRate()))
                    .enableRbf()
                
                let psbt = try txBuilder.finish(wallet: wallet)
                let signResult = try wallet.sign(psbt: psbt, signOptions: nil)
                
                guard signResult.isFinalized else {
                    throw ChannelError.fundingNotFinalized
                }
                
                let fundingTx = signResult.psbt.extractTx()
                
                // Provide funding transaction to LDK
                let fundingResult = channelManager.fundingTransactionGenerated(
                    temporaryChannelId: event.getTemporaryChannelId(),
                    counterpartyNodeId: event.getCounterpartyNodeId(),
                    fundingTransaction: fundingTx.serialize()
                )
                
                guard fundingResult.isOk() else {
                    throw ChannelError.fundingFailed(fundingResult.getError()?.getDescription() ?? "Unknown error")
                }
                
                // Broadcast transaction
                broadcaster.broadcastTransactions(txs: [fundingTx.serialize()])
                
                // Store channel info
                ChannelStore.shared.storePendingChannel(
                    temporaryChannelId: event.getTemporaryChannelId(),
                    userChannelId: Data(userChannelId).hexString,
                    counterpartyNodeId: Data(event.getCounterpartyNodeId()).hexString,
                    fundingTxid: fundingTx.txid(),
                    channelValueSats: channelValue
                )
                
                // Notify UI
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: .channelPendingFunding,
                        object: nil,
                        userInfo: [
                            "temporaryChannelId": event.getTemporaryChannelId().data.hexString,
                            "fundingTxid": fundingTx.txid()
                        ]
                    )
                }
                
            } catch {
                logger.log(message: "Funding generation failed: \\(error)")
                
                // Notify failure
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: .channelFundingFailed,
                        object: nil,
                        userInfo: ["error": error.localizedDescription]
                    )
                }
            }
        }
    }
    
    // Channel Ready - Channel is now usable
    func handleChannelReady(_ event: Bindings.Event.ChannelReady) {
        let channelId = event.getChannelId()
        let userChannelId = event.getUserChannelId()
        let counterpartyNodeId = event.getCounterpartyNodeId()
        let channelType = event.getChannelType()
        
        // Update channel status
        ChannelStore.shared.markChannelReady(
            channelId: channelId,
            userChannelId: Data(userChannelId).hexString,
            counterpartyNodeId: Data(counterpartyNodeId).hexString,
            channelType: channelType
        )
        
        // Update routing hints for invoices
        updateRoutingHints()
        
        // Notify UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .channelReady,
                object: nil,
                userInfo: [
                    "channelId": channelId.data.hexString,
                    "counterpartyNodeId": Data(counterpartyNodeId).hexString
                ]
            )
        }
        
        // Show notification
        showChannelNotification(
            title: "Channel Ready",
            body: "Channel is now active and ready for payments",
            identifier: channelId.data.hexString
        )
        
        logger.log(message: "Channel ready: \\(channelId.data.hexString)")
    }
    
    // Channel Closed - Channel has been closed
    func handleChannelClosed(_ event: Bindings.Event.ChannelClosed) {
        let channelId = event.getChannelId()
        let userChannelId = event.getUserChannelId()
        let reason = event.getReason()
        let counterpartyNodeId = event.getCounterpartyNodeId()
        let channelCapacityMsat = event.getChannelCapacitySats()?.getValue()
        let channelFundingTxo = event.getChannelFundingTxo()
        
        // Parse closure reason
        let closureReason = parseClosureReason(reason)
        
        // Update channel status
        ChannelStore.shared.markChannelClosed(
            channelId: channelId,
            userChannelId: Data(userChannelId).hexString,
            reason: closureReason,
            capacityMsat: channelCapacityMsat
        )
        
        // Handle based on closure type
        switch closureReason.type {
        case .cooperativeClosure:
            logger.log(message: "Channel closed cooperatively")
        case .commitmentTxConfirmed:
            logger.log(message: "Channel force closed - commitment tx confirmed")
            // Monitor for penalty transactions if needed
        case .counterpartyForceClosed:
            logger.log(message: "Counterparty force closed channel")
            // Ensure we claim our outputs
        case .holderForceClosed:
            logger.log(message: "We force closed the channel")
        default:
            logger.log(message: "Channel closed: \\(closureReason.description)")
        }
        
        // Update routing hints
        updateRoutingHints()
        
        // Notify UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .channelClosed,
                object: nil,
                userInfo: [
                    "channelId": channelId.data.hexString,
                    "reason": closureReason.description,
                    "isForceClose": closureReason.isForceClose
                ]
            )
        }
    }
    
    // Open Channel Request - Counterparty wants to open channel
    func handleOpenChannelRequest(_ event: Bindings.Event.OpenChannelRequest) {
        let temporaryChannelId = event.getTemporaryChannelId()
        let counterpartyNodeId = event.getCounterpartyNodeId()
        let fundingSatoshis = event.getFundingSatoshis()
        let pushMsat = event.getPushMsat()
        let channelType = event.getChannelType()
        
        // Check if we want to accept this channel
        let shouldAccept = evaluateChannelRequest(
            counterpartyNodeId: Data(counterpartyNodeId).hexString,
            fundingSatoshis: fundingSatoshis,
            pushMsat: pushMsat,
            channelType: channelType
        )
        
        if shouldAccept {
            // Accept the channel
            let userChannelId = generateUserChannelId()
            let acceptResult = channelManager.acceptInboundChannel(
                temporaryChannelId: temporaryChannelId,
                counterpartyNodeId: counterpartyNodeId,
                userChannelId: userChannelId
            )
            
            if acceptResult.isOk() {
                logger.log(message: "Accepted inbound channel from \\(Data(counterpartyNodeId).hexString)")
                
                // Store pending channel
                ChannelStore.shared.storeInboundPendingChannel(
                    temporaryChannelId: temporaryChannelId,
                    userChannelId: Data(userChannelId).hexString,
                    counterpartyNodeId: Data(counterpartyNodeId).hexString,
                    fundingSatoshis: fundingSatoshis,
                    pushMsat: pushMsat
                )
            } else {
                logger.log(message: "Failed to accept channel: \\(acceptResult.getError()?.getDescription() ?? "Unknown")")
            }
        } else {
            // Reject the channel
            let rejectResult = channelManager.forceCloseWithoutBroadcastingTxn(
                channelId: temporaryChannelId,
                counterpartyNodeId: counterpartyNodeId
            )
            
            logger.log(message: "Rejected inbound channel from \\(Data(counterpartyNodeId).hexString)")
        }
    }
    
    // Helper methods
    private func parseClosureReason(_ reason: Bindings.ClosureReason) -> ChannelClosureInfo {
        switch reason.getValueType() {
        case .CounterpartyForceClosed:
            let details = reason.getValueAsCounterpartyForceClosed()!
            return ChannelClosureInfo(
                type: .counterpartyForceClosed,
                description: "Counterparty force closed: \\(details.getPeerMessage())",
                isForceClose: true
            )
        case .HolderForceClosed:
            return ChannelClosureInfo(
                type: .holderForceClosed,
                description: "We force closed the channel",
                isForceClose: true
            )
        case .CooperativeClosure:
            return ChannelClosureInfo(
                type: .cooperativeClosure,
                description: "Channel closed cooperatively",
                isForceClose: false
            )
        case .CommitmentTxConfirmed:
            return ChannelClosureInfo(
                type: .commitmentTxConfirmed,
                description: "Commitment transaction confirmed on-chain",
                isForceClose: true
            )
        case .FundingTimedOut:
            return ChannelClosureInfo(
                type: .fundingTimeout,
                description: "Channel funding timed out",
                isForceClose: false
            )
        case .ProcessingError:
            let error = reason.getValueAsProcessingError()!
            return ChannelClosureInfo(
                type: .processingError,
                description: "Processing error: \\(error.getErr())",
                isForceClose: false
            )
        case .DisconnectedPeer:
            return ChannelClosureInfo(
                type: .disconnectedPeer,
                description: "Peer disconnected",
                isForceClose: false
            )
        case .OutdatedChannelManager:
            return ChannelClosureInfo(
                type: .outdatedChannelManager,
                description: "Channel manager outdated",
                isForceClose: false
            )
        case .CounterpartyCoopClosedUnfundedChannel:
            return ChannelClosureInfo(
                type: .coopClosedUnfunded,
                description: "Counterparty cooperatively closed unfunded channel",
                isForceClose: false
            )
        case .FundingBatchClosure:
            return ChannelClosureInfo(
                type: .fundingBatchClosure,
                description: "Closed due to funding batch failure",
                isForceClose: false
            )
        case .HTLCsTimedOut:
            return ChannelClosureInfo(
                type: .htlcsTimedOut,
                description: "Channel closed due to HTLC timeout",
                isForceClose: false
            )
        default:
            return ChannelClosureInfo(
                type: .unknown,
                description: "Unknown closure reason",
                isForceClose: false
            )
        }
    }
    
    private func evaluateChannelRequest(
        counterpartyNodeId: String,
        fundingSatoshis: UInt64,
        pushMsat: UInt64,
        channelType: Bindings.ChannelTypeFeatures
    ) -> Bool {
        // Check minimum channel size
        guard fundingSatoshis >= 20000 else { return false }
        
        // Check if we know this peer
        guard PeerStore.shared.isTrustedPeer(nodeId: counterpartyNodeId) else { return false }
        
        // Check channel type compatibility
        if channelType.requiresAnchorsZeroFeeHtlcTx() && !supportsAnchors() {
            return false
        }
        
        // Check total channel count
        let currentChannels = channelManager.listChannels().count
        guard currentChannels < maxChannelCount() else { return false }
        
        return true
    }
    
    private func generateUserChannelId() -> [UInt8] {
        var userChannelId = [UInt8](repeating: 0, count: 16)
        arc4random_buf(&userChannelId, 16)
        return userChannelId
    }
    
    private func updateRoutingHints() {
        // Update routing hints for invoice generation
        RoutingHintManager.shared.updateFromChannels(channelManager.listUsableChannels())
    }
}

struct ChannelClosureInfo {
    enum ClosureType {
        case counterpartyForceClosed
        case holderForceClosed
        case cooperativeClosure
        case commitmentTxConfirmed
        case fundingTimeout
        case processingError
        case disconnectedPeer
        case outdatedChannelManager
        case coopClosedUnfunded
        case fundingBatchClosure
        case htlcsTimedOut
        case unknown
    }
    
    let type: ClosureType
    let description: String
    let isForceClose: Bool
}

// Channel notification names
extension Notification.Name {
    static let channelPendingFunding = Notification.Name("ldk.channel.pendingFunding")
    static let channelFundingFailed = Notification.Name("ldk.channel.fundingFailed")
    static let channelReady = Notification.Name("ldk.channel.ready")
    static let channelClosed = Notification.Name("ldk.channel.closed")
}`.trim(),

      funding_events: `
// Funding and Transaction Events
import LightningDevKit
import BitcoinDevKit

extension LDKEventHandler {
    // Discard Funding - Funding transaction can be discarded
    func handleDiscardFunding(_ event: Bindings.Event.DiscardFunding) {
        let channelId = event.getChannelId()
        let fundingTx = event.getTransaction()
        
        logger.log(message: "Discarding funding transaction for channel: \\(channelId.data.hexString)")
        
        // Remove from our transaction store
        TransactionStore.shared.removePendingTransaction(
            txid: BitcoinDevKit.Transaction(transactionBytes: fundingTx).txid()
        )
        
        // Update channel status
        ChannelStore.shared.removeChannel(channelId: channelId)
        
        // Notify UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .fundingDiscarded,
                object: nil,
                userInfo: ["channelId": channelId.data.hexString]
            )
        }
    }
    
    // Bump Transaction - Need to bump fee for transaction
    func handleBumpTransaction(_ event: Bindings.Event.BumpTransaction) {
        switch event.getValueType() {
        case .ChannelClose:
            handleBumpChannelClose(event.getValueAsChannelClose()!)
        case .HTLCResolution:
            handleBumpHTLCResolution(event.getValueAsHTLCResolution()!)
        default:
            logger.log(message: "Unknown bump transaction type")
        }
    }
    
    private func handleBumpChannelClose(_ bumpEvent: Bindings.Event.BumpTransaction.ChannelClose) {
        let channelId = bumpEvent.getChannelId()
        let counterpartyNodeId = bumpEvent.getCounterpartyNodeId()
        let claimId = bumpEvent.getClaimId()
        let packageTargetFeerateSatPer1000Weight = bumpEvent.getPackageTargetFeerateSatPer1000Weight()
        let commitmentTx = bumpEvent.getCommitmentTx()
        let commitmentTxFeeSatoshis = bumpEvent.getCommitmentTxFeeSatoshis()
        let anchorDescriptor = bumpEvent.getAnchorDescriptor()
        let pendingHtlcs = bumpEvent.getPendingHtlcs()
        
        Task {
            do {
                // Build anchor spending transaction
                let anchorTx = try await buildAnchorSpendingTransaction(
                    anchorDescriptor: anchorDescriptor,
                    targetFeeRate: packageTargetFeerateSatPer1000Weight,
                    commitmentTx: commitmentTx,
                    commitmentTxFee: commitmentTxFeeSatoshis
                )
                
                // Broadcast the transaction
                broadcaster.broadcastTransactions(txs: [anchorTx])
                
                // Handle any pending HTLCs
                for htlc in pendingHtlcs {
                    handlePendingHTLC(htlc)
                }
                
                logger.log(message: "Bumped channel close fee for channel: \\(channelId.data.hexString)")
                
            } catch {
                logger.log(message: "Failed to bump channel close fee: \\(error)")
            }
        }
    }
    
    private func handleBumpHTLCResolution(_ bumpEvent: Bindings.Event.BumpTransaction.HTLCResolution) {
        let channelId = bumpEvent.getChannelId()
        let counterpartyNodeId = bumpEvent.getCounterpartyNodeId()
        let claimId = bumpEvent.getClaimId()
        let targetFeerateSatPer1000Weight = bumpEvent.getTargetFeerateSatPer1000Weight()
        let htlcDescriptors = bumpEvent.getHtlcDescriptors()
        let txLockTime = bumpEvent.getTxLockTime()
        
        Task {
            do {
                // Build HTLC claim transaction
                let htlcTx = try await buildHTLCTransaction(
                    htlcDescriptors: htlcDescriptors,
                    targetFeeRate: targetFeerateSatPer1000Weight,
                    lockTime: txLockTime
                )
                
                // Broadcast the transaction
                broadcaster.broadcastTransactions(txs: [htlcTx])
                
                logger.log(message: "Bumped HTLC resolution fee for channel: \\(channelId.data.hexString)")
                
            } catch {
                logger.log(message: "Failed to bump HTLC resolution fee: \\(error)")
            }
        }
    }
    
    // Build anchor spending transaction
    private func buildAnchorSpendingTransaction(
        anchorDescriptor: Bindings.AnchorDescriptor,
        targetFeeRate: UInt32,
        commitmentTx: [UInt8],
        commitmentTxFee: UInt64
    ) async throws -> [UInt8] {
        // Get anchor output
        let anchorOutpoint = anchorDescriptor.getOutpoint()
        let anchorOutput = anchorDescriptor.getPreviousUtxo()
        
        // Calculate required fee
        let anchorSpendWeight: UInt64 = 321 // Approximate weight for anchor spend
        let requiredFee = (anchorSpendWeight * UInt64(targetFeeRate)) / 1000
        
        // Build transaction with BDK
        let txBuilder = BitcoinDevKit.TxBuilder()
        
        // Add anchor input
        txBuilder.addUtxo(outpoint: anchorOutpoint, satisfaction: nil)
        
        // Add wallet inputs if needed for fees
        if requiredFee > anchorOutput.getValue() {
            let additionalFee = requiredFee - anchorOutput.getValue()
            txBuilder.fundTransaction(wallet: wallet, requiredAmount: additionalFee)
        }
        
        // Set fee rate
        txBuilder.feeRate(satPerVbyte: Float(targetFeeRate / 250)) // Convert to sat/vbyte
        
        // Set change address
        let changeAddress = try wallet.getAddress(addressIndex: .new)
        txBuilder.drainTo(address: changeAddress.address.asString())
        
        // Finish and sign
        let psbt = try txBuilder.finish(wallet: wallet)
        let signed = try wallet.sign(psbt: psbt, signOptions: nil)
        
        return signed.psbt.extractTx().serialize()
    }
    
    // Build HTLC transaction
    private func buildHTLCTransaction(
        htlcDescriptors: [Bindings.HTLCDescriptor],
        targetFeeRate: UInt32,
        lockTime: UInt32
    ) async throws -> [UInt8] {
        var inputs: [Bindings.TxIn] = []
        var outputs: [Bindings.TxOut] = []
        var totalValue: UInt64 = 0
        
        // Add HTLC inputs
        for descriptor in htlcDescriptors {
            let input = Bindings.TxIn(
                previousOutput: descriptor.getOutpoint(),
                scriptSig: Bindings.CVecU8Z(),
                sequence: descriptor.getPerCommitmentNumber(),
                witness: Bindings.Witness(elements: [])
            )
            inputs.append(input)
            
            totalValue += descriptor.getHtlc().getAmountMsat() / 1000
        }
        
        // Calculate fee
        let txWeight = estimateHTLCTxWeight(htlcCount: htlcDescriptors.count)
        let fee = (txWeight * UInt64(targetFeeRate)) / 1000
        
        // Create output to our wallet
        let outputValue = totalValue.saturatingSubtraction(fee)
        if outputValue > 546 { // Dust limit
            let address = try wallet.getAddress(addressIndex: .new)
            let script = try address.address.scriptPubkey()
            
            let output = Bindings.TxOut(
                value: outputValue,
                scriptPubkey: script.toBytes()
            )
            outputs.append(output)
        }
        
        // Build transaction
        let htlcTx = Bindings.Transaction(
            version: 2,
            lockTime: lockTime,
            input: inputs,
            output: outputs
        )
        
        // Sign inputs
        for (index, descriptor) in htlcDescriptors.enumerated() {
            let signature = keysManager.asSignerProvider().signCounterpartyHtlcTransaction(
                htlcTx: htlcTx.write(),
                inputIdx: UInt(index),
                amount: descriptor.getHtlc().getAmountMsat() / 1000,
                perCommitmentPoint: descriptor.getPerCommitmentPoint(),
                htlc: descriptor.getHtlc()
            )
            
            // Add witness
            htlcTx.input[index].witness = createHTLCWitness(
                signature: signature,
                htlcDescriptor: descriptor
            )
        }
        
        return htlcTx.write()
    }
    
    private func estimateHTLCTxWeight(htlcCount: Int) -> UInt64 {
        // Base transaction weight + per-HTLC input weight
        let baseTxWeight: UInt64 = 42 * 4 // Version, locktime, counts
        let perInputWeight: UInt64 = 413 // Approximate HTLC input weight
        let outputWeight: UInt64 = 31 * 4 // P2WPKH output
        
        return baseTxWeight + (UInt64(htlcCount) * perInputWeight) + outputWeight
    }
}

// Transaction notification names
extension Notification.Name {
    static let fundingDiscarded = Notification.Name("ldk.funding.discarded")
    static let transactionBumped = Notification.Name("ldk.transaction.bumped")
}`.trim(),

      spendable_outputs: `
// Spendable Outputs Event Handling
import LightningDevKit
import BitcoinDevKit

extension LDKEventHandler {
    // Handle spendable outputs that can be swept
    func handleSpendableOutputs(_ event: Bindings.Event.SpendableOutputs) {
        let outputs = event.getOutputs()
        let channelId = event.getChannelId()
        
        Task {
            do {
                // Group outputs by type for efficient handling
                let groupedOutputs = groupOutputsByType(outputs)
                
                // Process each group
                for (outputType, descriptors) in groupedOutputs {
                    try await sweepOutputs(
                        descriptors: descriptors,
                        outputType: outputType,
                        channelId: channelId
                    )
                }
                
                logger.log(message: "Successfully swept \\(outputs.count) spendable outputs")
                
            } catch {
                logger.log(message: "Failed to sweep outputs: \\(error)")
                
                // Store for retry
                SpendableOutputStore.shared.storePendingOutputs(
                    outputs: outputs,
                    channelId: channelId
                )
            }
        }
    }
    
    // Sweep outputs to wallet
    private func sweepOutputs(
        descriptors: [Bindings.SpendableOutputDescriptor],
        outputType: OutputType,
        channelId: Bindings.ChannelId?
    ) async throws {
        // Get fee rate based on output type
        let feeRate = await getFeeRateForOutputType(outputType)
        
        // Get destination address
        let destinationAddress = try wallet.getAddress(addressIndex: .new)
        let destinationScript = try destinationAddress.address.scriptPubkey().toBytes()
        
        // Build spending transaction
        let spendResult = keysManager.spendSpendableOutputs(
            descriptors: descriptors,
            outputs: [], // No additional outputs
            changeDestinationScript: destinationScript,
            feerateSatPer1000Weight: feeRate,
            locktime: nil
        )
        
        guard spendResult.isOk(), let transaction = spendResult.getValue() else {
            throw OutputSweepError.failedToBuildTransaction(
                spendResult.getError()?.getDescription() ?? "Unknown error"
            )
        }
        
        // Broadcast transaction
        broadcaster.broadcastTransactions(txs: [transaction])
        
        // Store sweep transaction
        let txid = BitcoinDevKit.Transaction(transactionBytes: transaction).txid()
        SweepTransactionStore.shared.store(
            txid: txid,
            outputs: descriptors,
            channelId: channelId,
            outputType: outputType,
            timestamp: Date()
        )
        
        // Update balance after sweep
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            BalanceManager.shared.updateBalance()
        }
        
        // Notify UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .outputsSwept,
                object: nil,
                userInfo: [
                    "txid": txid,
                    "outputCount": descriptors.count,
                    "outputType": outputType.rawValue
                ]
            )
        }
    }
    
    // Group outputs by type for batching
    private func groupOutputsByType(_ outputs: [Bindings.SpendableOutputDescriptor]) -> [OutputType: [Bindings.SpendableOutputDescriptor]] {
        var grouped: [OutputType: [Bindings.SpendableOutputDescriptor]] = [:]
        
        for output in outputs {
            let outputType = getOutputType(output)
            if grouped[outputType] == nil {
                grouped[outputType] = []
            }
            grouped[outputType]?.append(output)
        }
        
        return grouped
    }
    
    // Determine output type
    private func getOutputType(_ output: Bindings.SpendableOutputDescriptor) -> OutputType {
        switch output.getValueType() {
        case .StaticPaymentOutput:
            return .staticPayment
        case .DelayedPaymentOutput:
            return .delayedPayment
        case .StaticOutput:
            return .staticOutput
        default:
            return .unknown
        }
    }
    
    // Get appropriate fee rate for output type
    private func getFeeRateForOutputType(_ outputType: OutputType) async -> UInt32 {
        let feeEstimator = LDKManager.shared.feeEstimator
        
        switch outputType {
        case .staticPayment:
            // Higher priority for static payment outputs
            return feeEstimator.getEstSatPer1000Weight(
                confirmationTarget: .onChainSweep
            )
        case .delayedPayment:
            // Medium priority for delayed payments
            return feeEstimator.getEstSatPer1000Weight(
                confirmationTarget: .nonAnchorChannelFee
            )
        case .staticOutput:
            // Lower priority for static outputs
            return feeEstimator.getEstSatPer1000Weight(
                confirmationTarget: .channelCloseMinimum
            )
        case .unknown:
            // Default fee rate
            return feeEstimator.getEstSatPer1000Weight(
                confirmationTarget: .outputSpendingFee
            )
        }
    }
}

// Output type enumeration
enum OutputType: String {
    case staticPayment = "static_payment"
    case delayedPayment = "delayed_payment"
    case staticOutput = "static_output"
    case unknown = "unknown"
}

// Output sweep error
enum OutputSweepError: LocalizedError {
    case failedToBuildTransaction(String)
    case broadcastFailed(String)
    case insufficientFunds
    
    var errorDescription: String? {
        switch self {
        case .failedToBuildTransaction(let reason):
            return "Failed to build sweep transaction: \\(reason)"
        case .broadcastFailed(let reason):
            return "Failed to broadcast sweep transaction: \\(reason)"
        case .insufficientFunds:
            return "Insufficient funds to sweep outputs"
        }
    }
}

// Spendable Output Store for persistence
class SpendableOutputStore {
    static let shared = SpendableOutputStore()
    
    private let queue = DispatchQueue(label: "spendable.output.store", attributes: .concurrent)
    private var pendingOutputs: [PendingOutput] = []
    
    struct PendingOutput: Codable {
        let id: String
        let outputData: Data
        let channelId: String?
        let addedAt: Date
        var retryCount: Int
    }
    
    func storePendingOutputs(outputs: [Bindings.SpendableOutputDescriptor], channelId: Bindings.ChannelId?) {
        queue.async(flags: .barrier) {
            for output in outputs {
                let pending = PendingOutput(
                    id: UUID().uuidString,
                    outputData: Data(output.write()),
                    channelId: channelId?.data.hexString,
                    addedAt: Date(),
                    retryCount: 0
                )
                self.pendingOutputs.append(pending)
            }
            self.persist()
        }
    }
    
    func getPendingOutputs() -> [PendingOutput] {
        queue.sync { pendingOutputs }
    }
    
    func removePendingOutput(id: String) {
        queue.async(flags: .barrier) {
            self.pendingOutputs.removeAll { $0.id == id }
            self.persist()
        }
    }
    
    private func persist() {
        // Persist to UserDefaults or file
        if let encoded = try? JSONEncoder().encode(pendingOutputs) {
            UserDefaults.standard.set(encoded, forKey: "pending_spendable_outputs")
        }
    }
}

// Retry sweeping pending outputs
extension LDKEventHandler {
    func retryPendingOutputSweeps() {
        let pendingOutputs = SpendableOutputStore.shared.getPendingOutputs()
        
        for pending in pendingOutputs where pending.retryCount < 3 {
            // Deserialize output
            if let outputResult = Bindings.SpendableOutputDescriptor.read(
                ser: [UInt8](pending.outputData),
                arg: keysManager
            ), outputResult.isOk(), let output = outputResult.getValue() {
                
                Task {
                    do {
                        try await sweepOutputs(
                            descriptors: [output],
                            outputType: getOutputType(output),
                            channelId: nil
                        )
                        
                        // Remove from pending if successful
                        SpendableOutputStore.shared.removePendingOutput(id: pending.id)
                        
                    } catch {
                        logger.log(message: "Retry sweep failed: \\(error)")
                        // Increment retry count
                        pending.retryCount += 1
                    }
                }
            }
        }
    }
}

// Notification name for swept outputs
extension Notification.Name {
    static let outputsSwept = Notification.Name("ldk.outputs.swept")
}`.trim(),

      forwarding_events: `
// Payment Forwarding Event Handling
import LightningDevKit

extension LDKEventHandler {
    // Payment Forwarded - Successfully forwarded a payment
    func handlePaymentForwarded(_ event: Bindings.Event.PaymentForwarded) {
        let prevChannelId = event.getPrevChannelId()
        let nextChannelId = event.getNextChannelId()
        let prevUserChannelId = event.getPrevUserChannelId()
        let nextUserChannelId = event.getNextUserChannelId()
        let totalFeeMsat = event.getTotalFeeMsat()
        let skimmedFeeMsat = event.getSkimmedFeeMsat()
        let claimFromOnchain = event.getClaimFromOnchainTx()
        let outboundAmountMsat = event.getOutboundAmountForwardedMsat()
        
        // Calculate forwarding fee earned
        let feeEarnedMsat = totalFeeMsat?.getValue() ?? 0
        
        // Store forwarding record
        ForwardingStore.shared.recordForwarding(
            prevChannelId: prevChannelId?.data.hexString,
            nextChannelId: nextChannelId?.data.hexString,
            feeEarnedMsat: feeEarnedMsat,
            amountMsat: outboundAmountMsat?.getValue() ?? 0,
            timestamp: Date()
        )
        
        // Update routing statistics
        RoutingStats.shared.recordSuccessfulForward(
            fromChannel: prevChannelId,
            toChannel: nextChannelId,
            feeMsat: feeEarnedMsat
        )
        
        // Notify UI
        DispatchQueue.main.async {
            NotificationCenter.default.post(
                name: .paymentForwarded,
                object: nil,
                userInfo: [
                    "feeEarnedMsat": feeEarnedMsat,
                    "prevChannelId": prevChannelId?.data.hexString ?? "unknown",
                    "nextChannelId": nextChannelId?.data.hexString ?? "unknown"
                ]
            )
        }
        
        logger.log(message: "Payment forwarded. Fee earned: \\(feeEarnedMsat) msat")
    }
    
    // Pending HTLCs Forwardable - Need to process pending forwards
    func handlePendingHTLCsForwardable(_ event: Bindings.Event.PendingHTLCsForwardable) {
        let timeForwardable = event.getTimeForwardableNanos()
        
        // Calculate delay in milliseconds
        let delayMs = timeForwardable / 1_000_000
        
        if delayMs > 0 {
            // Schedule forward processing
            DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(Int(delayMs))) {
                self.channelManager.processPendingHtlcForwards()
                self.logger.log(message: "Processed pending HTLC forwards after \\(delayMs)ms delay")
            }
        } else {
            // Process immediately
            channelManager.processPendingHtlcForwards()
            logger.log(message: "Processed pending HTLC forwards immediately")
        }
    }
    
    // HTLC Intercepted - Intercept HTLC for custom handling
    func handleHTLCIntercepted(_ event: Bindings.Event.HTLCIntercepted) {
        let interceptId = event.getInterceptId()
        let requestedNextHopScid = event.getRequestedNextHopScid()
        let paymentHash = event.getPaymentHash()
        let inboundAmount = event.getInboundAmountMsat()
        let outboundAmount = event.getExpectedOutboundAmountMsat()
        
        // Evaluate HTLC for acceptance
        let evaluation = evaluateHTLC(
            paymentHash: paymentHash,
            inboundAmount: inboundAmount,
            outboundAmount: outboundAmount,
            nextHopScid: requestedNextHopScid
        )
        
        switch evaluation {
        case .accept:
            // Forward the HTLC normally
            let result = channelManager.forwardInterceptedHtlc(
                interceptId: interceptId,
                nextHopChannelId: getChannelId(fromScid: requestedNextHopScid),
                nextHopNodeId: getNodeId(fromScid: requestedNextHopScid),
                amtToForwardMsat: outboundAmount
            )
            
            if result.isOk() {
                logger.log(message: "Forwarded intercepted HTLC")
            } else {
                logger.log(message: "Failed to forward intercepted HTLC")
            }
            
        case .reject(let reason):
            // Fail the HTLC
            channelManager.failInterceptedHtlc(interceptId: interceptId)
            logger.log(message: "Rejected intercepted HTLC: \\(reason)")
            
        case .customHandle(let customData):
            // Handle with custom logic (e.g., hold invoice)
            handleCustomHTLC(
                interceptId: interceptId,
                paymentHash: paymentHash,
                customData: customData
            )
        }
    }
    
    // HTLC Handling Failed
    func handleHTLCHandlingFailed(_ event: Bindings.Event.HTLCHandlingFailed) {
        let prevChannelId = event.getPrevChannelId()
        let failedNextDestination = event.getFailedNextDestination()
        
        // Update routing statistics
        RoutingStats.shared.recordFailedForward(
            fromChannel: prevChannelId,
            toDestination: failedNextDestination
        )
        
        logger.log(message: "HTLC handling failed from channel: \\(prevChannelId.data.hexString)")
    }
}

// HTLC evaluation logic
extension LDKEventHandler {
    enum HTLCEvaluation {
        case accept
        case reject(String)
        case customHandle(Data)
    }
    
    private func evaluateHTLC(
        paymentHash: [UInt8],
        inboundAmount: UInt64,
        outboundAmount: UInt64,
        nextHopScid: UInt64
    ) -> HTLCEvaluation {
        // Check if this is a hold invoice
        if let holdInvoice = HoldInvoiceStore.shared.getHoldInvoice(
            paymentHash: Data(paymentHash).hexString
        ) {
            return .customHandle(holdInvoice.metadata)
        }
        
        // Check channel capacity
        if let channel = getChannel(fromScid: nextHopScid) {
            if channel.getOutboundCapacityMsat() < outboundAmount {
                return .reject("Insufficient outbound capacity")
            }
        }
        
        // Check fee policy
        let impliedFee = inboundAmount.saturatingSubtraction(outboundAmount)
        if impliedFee < minimumForwardingFee() {
            return .reject("Fee too low")
        }
        
        // Check rate limiting
        if !RateLimiter.shared.allowForward(
            amount: outboundAmount,
            channelScid: nextHopScid
        ) {
            return .reject("Rate limit exceeded")
        }
        
        return .accept
    }
    
    private func handleCustomHTLC(
        interceptId: Bindings.InterceptId,
        paymentHash: [UInt8],
        customData: Data
    ) {
        // Example: Hold invoice handling
        Task {
            // Wait for external approval
            let approved = await waitForApproval(
                paymentHash: Data(paymentHash).hexString,
                timeout: 30
            )
            
            if approved {
                // Forward the HTLC
                let result = channelManager.forwardInterceptedHtlc(
                    interceptId: interceptId,
                    nextHopChannelId: nil, // Use default
                    nextHopNodeId: nil, // Use default
                    amtToForwardMsat: 0 // Use default
                )
                
                if result.isOk() {
                    logger.log(message: "Hold invoice approved and forwarded")
                }
            } else {
                // Fail the HTLC
                channelManager.failInterceptedHtlc(interceptId: interceptId)
                logger.log(message: "Hold invoice rejected")
            }
        }
    }
}

// Forwarding Statistics
class RoutingStats {
    static let shared = RoutingStats()
    
    private var successfulForwards: [ForwardRecord] = []
    private var failedForwards: [FailedForwardRecord] = []
    private let queue = DispatchQueue(label: "routing.stats", attributes: .concurrent)
    
    struct ForwardRecord {
        let fromChannel: Bindings.ChannelId?
        let toChannel: Bindings.ChannelId?
        let feeMsat: UInt64
        let timestamp: Date
    }
    
    struct FailedForwardRecord {
        let fromChannel: Bindings.ChannelId
        let toDestination: Bindings.HTLCDestination
        let timestamp: Date
    }
    
    func recordSuccessfulForward(
        fromChannel: Bindings.ChannelId?,
        toChannel: Bindings.ChannelId?,
        feeMsat: UInt64
    ) {
        queue.async(flags: .barrier) {
            let record = ForwardRecord(
                fromChannel: fromChannel,
                toChannel: toChannel,
                feeMsat: feeMsat,
                timestamp: Date()
            )
            self.successfulForwards.append(record)
            
            // Keep only last 1000 records
            if self.successfulForwards.count > 1000 {
                self.successfulForwards.removeFirst()
            }
        }
    }
    
    func recordFailedForward(
        fromChannel: Bindings.ChannelId,
        toDestination: Bindings.HTLCDestination
    ) {
        queue.async(flags: .barrier) {
            let record = FailedForwardRecord(
                fromChannel: fromChannel,
                toDestination: toDestination,
                timestamp: Date()
            )
            self.failedForwards.append(record)
            
            // Keep only last 1000 records
            if self.failedForwards.count > 1000 {
                self.failedForwards.removeFirst()
            }
        }
    }
    
    func getStatistics(since: Date) -> (
        totalForwards: Int,
        successfulForwards: Int,
        failedForwards: Int,
        totalFeesEarned: UInt64,
        averageFee: UInt64
    ) {
        queue.sync {
            let recentSuccessful = successfulForwards.filter { $0.timestamp >= since }
            let recentFailed = failedForwards.filter { $0.timestamp >= since }
            
            let totalFees = recentSuccessful.reduce(0) { $0 + $1.feeMsat }
            let avgFee = recentSuccessful.isEmpty ? 0 : totalFees / UInt64(recentSuccessful.count)
            
            return (
                totalForwards: recentSuccessful.count + recentFailed.count,
                successfulForwards: recentSuccessful.count,
                failedForwards: recentFailed.count,
                totalFeesEarned: totalFees,
                averageFee: avgFee
            )
        }
    }
}

// Forwarding notification names
extension Notification.Name {
    static let paymentForwarded = Notification.Name("ldk.payment.forwarded")
    static let htlcIntercepted = Notification.Name("ldk.htlc.intercepted")
}`.trim(),

      event_persistence: `
// Event Persistence and Recovery
import LightningDevKit
import Foundation

class EventPersistence {
    static let shared = EventPersistence()
    
    private let queue = DispatchQueue(label: "event.persistence", attributes: .concurrent)
    private let documentsDirectory: URL
    private let eventsDirectory: URL
    private let maxStoredEvents = 1000
    
    init() {
        documentsDirectory = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        
        eventsDirectory = documentsDirectory.appendingPathComponent("ldk_events")
        
        // Create directory if needed
        try? FileManager.default.createDirectory(
            at: eventsDirectory,
            withIntermediateDirectories: true
        )
    }
    
    // Store event for potential replay
    func store(event: Bindings.Event) {
        queue.async(flags: .barrier) {
            let eventId = UUID().uuidString
            let timestamp = Date()
            
            // Serialize event
            let eventData = event.write()
            
            // Create event record
            let record = StoredEvent(
                id: eventId,
                timestamp: timestamp,
                eventType: event.getValueType().rawValue,
                eventData: Data(eventData),
                processed: false
            )
            
            // Save to disk
            self.saveEvent(record)
            
            // Clean up old events
            self.pruneOldEvents()
        }
    }
    
    // Mark event as processed
    func markProcessed(eventId: String) {
        queue.async(flags: .barrier) {
            let eventPath = self.eventsDirectory.appendingPathComponent("\\(eventId).json")
            
            if var record = self.loadEvent(from: eventPath) {
                record.processed = true
                self.saveEvent(record)
            }
        }
    }
    
    // Load unprocessed events for recovery
    func loadUnprocessedEvents() -> [StoredEvent] {
        queue.sync {
            var unprocessedEvents: [StoredEvent] = []
            
            do {
                let files = try FileManager.default.contentsOfDirectory(
                    at: eventsDirectory,
                    includingPropertiesForKeys: [.creationDateKey]
                )
                
                for file in files where file.pathExtension == "json" {
                    if let event = loadEvent(from: file), !event.processed {
                        unprocessedEvents.append(event)
                    }
                }
                
                // Sort by timestamp
                unprocessedEvents.sort { $0.timestamp < $1.timestamp }
                
            } catch {
                logger.log(message: "Failed to load events: \\(error)")
            }
            
            return unprocessedEvents
        }
    }
    
    // Replay unprocessed events during recovery
    func replayUnprocessedEvents(handler: LDKEventHandler) async {
        let unprocessedEvents = loadUnprocessedEvents()
        
        logger.log(message: "Found \\(unprocessedEvents.count) unprocessed events to replay")
        
        for storedEvent in unprocessedEvents {
            // Deserialize event
            if let event = deserializeEvent(storedEvent.eventData) {
                // Check if event is still valid
                if isEventStillValid(event, storedAt: storedEvent.timestamp) {
                    // Replay event
                    handler.handleEvent(event: event)
                    
                    // Mark as processed
                    markProcessed(eventId: storedEvent.id)
                    
                    logger.log(message: "Replayed event: \\(storedEvent.eventType)")
                } else {
                    // Skip expired events
                    logger.log(message: "Skipped expired event: \\(storedEvent.eventType)")
                    markProcessed(eventId: storedEvent.id)
                }
            }
        }
    }
    
    // Check if event is still valid for replay
    private func isEventStillValid(_ event: Bindings.Event, storedAt: Date) -> Bool {
        let age = Date().timeIntervalSince(storedAt)
        
        switch event.getValueType() {
        case .PaymentClaimable:
            // Check claim deadline
            if let claimable = event.getValueAsPaymentClaimable(),
               let deadline = claimable.getClaimDeadline() {
                return UInt64(Date().timeIntervalSince1970) < deadline
            }
            return age < 86400 // 24 hours
            
        case .PendingHTLCsForwardable:
            // Always process pending forwards
            return true
            
        case .SpendableOutputs:
            // Always process spendable outputs
            return true
            
        case .FundingGenerationReady:
            // Funding should be processed within reasonable time
            return age < 3600 // 1 hour
            
        default:
            // Default: events valid for 24 hours
            return age < 86400
        }
    }
    
    // Serialize/deserialize helpers
    private func deserializeEvent(_ data: Data) -> Bindings.Event? {
        let result = Bindings.Event.read(ser: [UInt8](data))
        return result.isOk() ? result.getValue() : nil
    }
    
    private func saveEvent(_ event: StoredEvent) {
        let eventPath = eventsDirectory.appendingPathComponent("\\(event.id).json")
        
        do {
            let encoded = try JSONEncoder().encode(event)
            try encoded.write(to: eventPath)
        } catch {
            logger.log(message: "Failed to save event: \\(error)")
        }
    }
    
    private func loadEvent(from url: URL) -> StoredEvent? {
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(StoredEvent.self, from: data)
        } catch {
            return nil
        }
    }
    
    private func pruneOldEvents() {
        do {
            let files = try FileManager.default.contentsOfDirectory(
                at: eventsDirectory,
                includingPropertiesForKeys: [.creationDateKey]
            ).sorted { file1, file2 in
                let date1 = try? file1.resourceValues(forKeys: [.creationDateKey]).creationDate
                let date2 = try? file2.resourceValues(forKeys: [.creationDateKey]).creationDate
                return (date1 ?? Date.distantPast) < (date2 ?? Date.distantPast)
            }
            
            // Remove old events if we exceed limit
            if files.count > maxStoredEvents {
                let toRemove = files.prefix(files.count - maxStoredEvents)
                for file in toRemove {
                    try FileManager.default.removeItem(at: file)
                }
            }
            
            // Remove processed events older than 7 days
            let cutoffDate = Date().addingTimeInterval(-7 * 24 * 60 * 60)
            for file in files {
                if let event = loadEvent(from: file),
                   event.processed && event.timestamp < cutoffDate {
                    try FileManager.default.removeItem(at: file)
                }
            }
            
        } catch {
            logger.log(message: "Failed to prune events: \\(error)")
        }
    }
}

// Stored event structure
struct StoredEvent: Codable {
    let id: String
    let timestamp: Date
    let eventType: Int
    let eventData: Data
    var processed: Bool
}

// Event recovery during startup
extension LDKEventHandler {
    func performEventRecovery() async {
        logger.log(message: "Starting event recovery...")
        
        await EventPersistence.shared.replayUnprocessedEvents(handler: self)
        
        logger.log(message: "Event recovery completed")
    }
}

// Graceful shutdown
extension LDKEventHandler {
    func prepareForShutdown() {
        // Process any pending events
        channelManager.processPendingHtlcForwards()
        
        // Wait for event processing to complete
        Thread.sleep(forTimeInterval: 0.5)
        
        logger.log(message: "Event handler prepared for shutdown")
    }
}`.trim()
    };

    try {
      const code = eventExamples[args.eventType];
      if (!code) {
        throw new Error(`Unknown event type: ${args.eventType}`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            eventType: args.eventType,
            swiftCode: code,
            description: `LDK event handling implementation for ${args.eventType}`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
};