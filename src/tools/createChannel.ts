import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const createChannelTool: Tool = {
  name: 'ldk_create_channel',
  description: 'Open a Lightning channel with a peer node',
  inputSchema: {
    type: 'object',
    properties: {
      remotePubkey: {
        type: 'string',
        description: 'Remote node public key (hex encoded)'
      },
      capacitySats: {
        type: 'number',
        description: 'Channel capacity in satoshis',
        minimum: 20000
      },
      pushSats: {
        type: 'number',
        description: 'Amount to push to remote side (optional)',
        default: 0
      },
      isPublic: {
        type: 'boolean',
        description: 'Whether to announce channel publicly',
        default: false
      }
    },
    required: ['remotePubkey', 'capacitySats']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const channel = await lightningService.createChannel(
        args.remotePubkey,
        args.capacitySats * 1000, // Convert to millisats
        args.pushSats * 1000
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            channel: {
              channelId: channel.channelId,
              shortChannelId: channel.shortChannelId,
              fundingTxid: channel.fundingTxid,
              capacitySats: Math.floor(channel.capacityMsat / 1000),
              localBalanceSats: Math.floor(channel.localBalanceMsat / 1000),
              remoteBalanceSats: Math.floor(channel.remoteBalanceMsat / 1000),
              state: channel.state
            },
            swiftExample: `
// Swift code to open a channel in your iOS app using LDK
import LightningDevKit
import BitcoinDevKit

class ChannelOpener {
    let channelManager: Bindings.ChannelManager
    let wallet: BitcoinDevKit.Wallet
    let logger: Bindings.Logger
    
    func openChannel(
        remotePubkey: String,
        capacitySats: UInt64,
        pushSats: UInt64 = 0,
        isPublic: Bool = false
    ) async throws -> Bindings.ChannelId {
        // Parse remote pubkey
        guard let pubkeyData = Data(hexString: remotePubkey),
              pubkeyData.count == 33 else {
            throw ChannelError.invalidPubkey
        }
        
        // Configure channel
        let userConfig = Bindings.UserConfig.initWithDefault()
        let channelHandshakeConfig = Bindings.ChannelHandshakeConfig.initWithDefault()
        channelHandshakeConfig.setAnnouncedChannel(val: isPublic)
        channelHandshakeConfig.setMinimumDepth(val: 3) // 3 confirmations
        userConfig.setChannelHandshakeConfig(val: channelHandshakeConfig)
        
        // Generate user channel ID (16 bytes)
        let userChannelId = Array<UInt8>(repeating: 0, count: 16)
        arc4random_buf(&userChannelId, 16)
        
        // Create channel with proper error handling
        let result = channelManager.createChannel(
            theirNetworkKey: pubkeyData.bytes,
            channelValueSatoshis: capacitySats,
            pushMsat: pushSats * 1000,
            userChannelId: userChannelId,
            temporaryChannelId: nil,
            overrideConfig: userConfig
        )
        
        guard result.isOk() else {
            let error = result.getError()!
            throw ChannelError.creationFailed(error.getValueAsApiMisuseError()?.getErrMessage() ?? "Unknown error")
        }
        
        return result.getValue()!
    }
    
    // Handle funding generation event
    func handleFundingGeneration(event: Bindings.Event.FundingGenerationReady) async throws {
        let outputScript = Script(rawOutputScript: event.getOutputScript())
        let amount = event.getChannelValueSatoshis()
        
        // Build funding transaction with BDK
        let txBuilder = try TxBuilder()
            .addRecipient(script: outputScript, amount: amount)
            .feeRate(satPerVbyte: 5.0)
            .enableRbf()
        
        let psbt = try txBuilder.finish(wallet: wallet)
        let signed = try wallet.sign(psbt: psbt, signOptions: nil)
        let fundingTx = signed.extractTx()
        
        // Provide funding transaction to LDK
        channelManager.fundingTransactionGenerated(
            temporaryChannelId: event.getTemporaryChannelId(),
            counterpartyNodeId: event.getCounterpartyNodeId(),
            fundingTransaction: fundingTx.serialize()
        )
        
        // Broadcast transaction
        try await broadcastTransaction(fundingTx)
    }
}

// SwiftUI view for channel opening
struct OpenChannelView: View {
    @State private var remotePubkey = ""
    @State private var capacitySats = "100000"
    @State private var pushSats = "0"
    @State private var isPublic = false
    @State private var isOpening = false
    @State private var error: String?
    
    var body: some View {
        Form {
            Section("Channel Details") {
                TextField("Remote Node Pubkey", text: $remotePubkey)
                    .font(.system(.body, design: .monospaced))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                
                HStack {
                    TextField("Capacity (sats)", text: $capacitySats)
                        .keyboardType(.numberPad)
                    
                    Text("sats")
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    TextField("Push Amount (sats)", text: $pushSats)
                        .keyboardType(.numberPad)
                    
                    Text("sats")
                        .foregroundColor(.secondary)
                }
                
                Toggle("Public Channel", isOn: $isPublic)
            }
            
            Section("Fee Estimate") {
                HStack {
                    Label("On-chain Fee", systemImage: "bitcoinsign.circle")
                    Spacer()
                    Text("~500 sats")
                        .foregroundColor(.secondary)
                }
            }
            
            Section {
                Button(action: openChannel) {
                    if isOpening {
                        HStack {
                            ProgressView()
                                .scaleEffect(0.8)
                            Text("Opening Channel...")
                        }
                    } else {
                        Text("Open Channel")
                    }
                }
                .frame(maxWidth: .infinity)
                .disabled(isOpening || !isValid)
            }
        }
        .navigationTitle("Open Channel")
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error ?? "")
        }
    }
    
    var isValid: Bool {
        !remotePubkey.isEmpty &&
        Int(capacitySats) ?? 0 >= 20000 &&
        Int(pushSats) ?? 0 >= 0
    }
    
    func openChannel() {
        Task {
            isOpening = true
            defer { isOpening = false }
            
            do {
                let capacity = UInt64(capacitySats) ?? 0
                let push = UInt64(pushSats) ?? 0
                
                try await LDKManager.shared.openChannel(
                    remotePubkey: remotePubkey,
                    capacitySats: capacity,
                    pushSats: push,
                    isPublic: isPublic
                )
                
                // Navigate back or show success
            } catch {
                self.error = error.localizedDescription
            }
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