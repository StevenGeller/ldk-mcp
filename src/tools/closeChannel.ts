import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const closeChannelTool: Tool = {
  name: 'ldk_close_channel',
  description: 'Close a Lightning channel cooperatively or force close',
  inputSchema: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Channel ID to close'
      },
      force: {
        type: 'boolean',
        description: 'Force close the channel',
        default: false
      }
    },
    required: ['channelId']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const success = await lightningService.closeChannel(args.channelId);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success,
            channelId: args.channelId,
            closeType: args.force ? 'force' : 'cooperative',
            message: 'Channel closing initiated',
            swiftExample: `
// Swift code for channel closing in your iOS app
import LightningDevKit

class ChannelCloser {
    let channelManager: ChannelManager
    
    func closeChannel(
        channelId: String,
        counterpartyNodeId: String,
        force: Bool = false
    ) throws {
        guard let channelIdData = Data(hexString: channelId),
              channelIdData.count == 32,
              let nodeIdData = Data(hexString: counterpartyNodeId),
              nodeIdData.count == 33 else {
            throw ChannelError.invalidParameters
        }
        
        let result: Result_NoneAPIErrorZ
        
        if force {
            // Force close the channel
            result = channelManager.forceCloseBroadcastingLatestTxn(
                channelId: channelIdData.bytes,
                counterpartyNodeId: nodeIdData.bytes
            )
        } else {
            // Cooperative close
            result = channelManager.closeChannel(
                channelId: channelIdData.bytes,
                counterpartyNodeId: nodeIdData.bytes
            )
        }
        
        guard result.isOk() else {
            throw ChannelError.closeFailed(result.getError()!)
        }
    }
    
    // Handle spendable outputs after channel close
    func handleSpendableOutputs(event: Event.SpendableOutputs) async throws {
        let outputs = event.getOutputs()
        
        // Get destination address from wallet
        let address = try wallet.getAddress(addressIndex: .new)
        let script = try Address(
            address: address.address.asString(),
            network: .testnet
        ).scriptPubkey().toBytes()
        
        // Create sweep transaction
        let result = keysManager.spendSpendableOutputs(
            descriptors: outputs,
            outputs: [], // No additional outputs
            changeDestinationScript: script,
            feerateSatPer1000Weight: 1000,
            locktime: nil // Current block height recommended
        )
        
        guard result.isOk(), let tx = result.getValue() else {
            throw ChannelError.sweepFailed
        }
        
        // Broadcast sweep transaction
        try await broadcastTransaction(Data(tx))
    }
}

// SwiftUI view for channel management
struct ChannelDetailView: View {
    let channel: ChannelDetails
    @State private var showingCloseAlert = false
    @State private var isClosing = false
    @State private var closeError: String?
    @Environment(\\.dismiss) private var dismiss
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Channel status card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Circle()
                            .fill(channel.isUsable ? Color.green : Color.orange)
                            .frame(width: 12, height: 12)
                        
                        Text(channelStatus)
                            .font(.headline)
                        
                        Spacer()
                        
                        if let scid = channel.getShortChannelId() {
                            Text(scid.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Divider()
                    
                    // Balances
                    VStack(spacing: 8) {
                        BalanceRow(
                            label: "Local Balance",
                            amount: localBalanceSats,
                            color: .green
                        )
                        
                        BalanceRow(
                            label: "Remote Balance",
                            amount: remoteBalanceSats,
                            color: .blue
                        )
                        
                        BalanceRow(
                            label: "Channel Capacity",
                            amount: Int(channel.channelValueSatoshis),
                            color: .primary
                        )
                    }
                }
                .padding()
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                
                // Actions
                VStack(spacing: 12) {
                    Button(action: { showingCloseAlert = true }) {
                        Label("Close Channel", systemImage: "xmark.circle")
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isClosing)
                }
            }
            .padding()
        }
        .navigationTitle("Channel Details")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Close Channel", isPresented: $showingCloseAlert) {
            Button("Cooperative Close", role: .destructive) {
                closeChannel(force: false)
            }
            Button("Force Close", role: .destructive) {
                closeChannel(force: true)
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Cooperative close is cheaper but requires the peer to be online. Force close can be done immediately but costs more in fees.")
        }
        .alert("Error", isPresented: .constant(closeError != nil)) {
            Button("OK") { closeError = nil }
        } message: {
            Text(closeError ?? "")
        }
        .overlay {
            if isClosing {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                
                ProgressView("Closing channel...")
                    .padding()
                    .background(Color(UIColor.systemBackground))
                    .cornerRadius(10)
                    .shadow(radius: 5)
            }
        }
    }
    
    var channelStatus: String {
        if channel.isUsable {
            return "Active"
        } else if channel.isChannelReady {
            return "Ready"
        } else {
            return "Pending"
        }
    }
    
    var localBalanceSats: Int {
        Int(channel.balanceMsat / 1000)
    }
    
    var remoteBalanceSats: Int {
        Int(channel.channelValueSatoshis) - localBalanceSats
    }
    
    func closeChannel(force: Bool) {
        Task {
            isClosing = true
            defer { isClosing = false }
            
            do {
                try LDKManager.shared.closeChannel(
                    channelId: channel.getChannelId().toHex(),
                    counterpartyNodeId: channel.getCounterpartyNodeId().toHex(),
                    force: force
                )
                
                dismiss()
            } catch {
                closeError = error.localizedDescription
            }
        }
    }
}

struct BalanceRow: View {
    let label: String
    let amount: Int
    let color: Color
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text("\\(amount.formatted()) sats")
                .fontWeight(.medium)
                .foregroundColor(color)
        }
    }
}`.trim()
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