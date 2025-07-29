import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const getBalanceTool: Tool = {
  name: 'ldk_get_balance',
  description: 'Get Lightning wallet balance and channel liquidity',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const balance = await lightningService.getBalance();
      const channels = await lightningService.getChannelStatus();
      
      // Calculate inbound liquidity
      let inboundMsat = 0;
      for (const channel of channels) {
        if (channel.isUsable) {
          inboundMsat += channel.remoteBalanceMsat;
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            balance: {
              totalSats: Math.floor(balance.totalMsat / 1000),
              spendableSats: Math.floor(balance.spendableMsat / 1000),
              inboundSats: Math.floor(inboundMsat / 1000)
            },
            liquidity: {
              canSendMaxSats: Math.floor(balance.spendableMsat / 1000),
              canReceiveMaxSats: Math.floor(inboundMsat / 1000)
            },
            swiftExample: `
// Swift code to display balance in your iOS app
import SwiftUI
import LightningDevKit

struct BalanceView: View {
    @State private var balance: WalletBalance?
    @State private var isLoading = true
    
    var body: some View {
        VStack(spacing: 24) {
            // Total balance card
            VStack(spacing: 16) {
                HStack {
                    Image(systemName: "bitcoinsign.circle.fill")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    
                    Spacer()
                    
                    VStack(alignment: .trailing) {
                        Text(formatSats(balance?.totalSats ?? 0))
                            .font(.system(size: 32, weight: .bold, design: .rounded))
                        Text("sats")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Balance breakdown
                VStack(spacing: 8) {
                    BalanceDetailRow(
                        label: "Spendable",
                        amount: balance?.spendableSats ?? 0,
                        icon: "paperplane.fill",
                        color: .green
                    )
                    
                    BalanceDetailRow(
                        label: "Receivable",
                        amount: balance?.inboundSats ?? 0,
                        icon: "arrow.down.circle.fill",
                        color: .blue
                    )
                }
            }
            .padding()
            .background(
                LinearGradient(
                    colors: [Color.orange.opacity(0.1), Color.orange.opacity(0.05)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(16)
            
            // Quick actions
            HStack(spacing: 16) {
                QuickActionButton(
                    title: "Send",
                    icon: "paperplane.fill",
                    color: .green,
                    isEnabled: (balance?.spendableSats ?? 0) > 0
                ) {
                    // Navigate to send view
                }
                
                QuickActionButton(
                    title: "Receive",
                    icon: "qrcode",
                    color: .blue,
                    isEnabled: (balance?.inboundSats ?? 0) > 0
                ) {
                    // Navigate to receive view
                }
            }
            
            Spacer()
        }
        .padding()
        .navigationTitle("Balance")
        .task {
            await loadBalance()
        }
        .refreshable {
            await loadBalance()
        }
        .overlay {
            if isLoading {
                ProgressView()
            }
        }
    }
    
    func loadBalance() async {
        isLoading = true
        defer { isLoading = false }
        
        balance = await LDKManager.shared.getBalance()
    }
    
    func formatSats(_ sats: Int64) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: sats)) ?? "0"
    }
}

struct BalanceDetailRow: View {
    let label: String
    let amount: Int64
    let icon: String
    let color: Color
    
    var body: some View {
        HStack {
            Label(label, systemImage: icon)
                .foregroundColor(color)
                .font(.callout)
            
            Spacer()
            
            Text(formatAmount(amount))
                .font(.callout)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
        }
    }
    
    func formatAmount(_ sats: Int64) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return (formatter.string(from: NSNumber(value: sats)) ?? "0") + " sats"
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isEnabled: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(color.opacity(isEnabled ? 0.15 : 0.05))
            .foregroundColor(isEnabled ? color : .gray)
            .cornerRadius(12)
        }
        .disabled(!isEnabled)
    }
}

// Extension for LDK balance fetching
extension LDKManager {
    func getBalance() async -> WalletBalance {
        let channels = channelManager.listChannels()
        
        var totalMsat: UInt64 = 0
        var spendableMsat: UInt64 = 0
        var inboundMsat: UInt64 = 0
        
        for channel in channels {
            if channel.isUsable {
                let localBalance = channel.balanceMsat
                let remoteBalance = (channel.channelValueSatoshis * 1000) - localBalance
                
                totalMsat += localBalance
                spendableMsat += max(0, localBalance - (channel.channelValueSatoshis * 10)) // Reserve 1%
                inboundMsat += remoteBalance
            }
        }
        
        return WalletBalance(
            totalSats: Int64(totalMsat / 1000),
            spendableSats: Int64(spendableMsat / 1000),
            inboundSats: Int64(inboundMsat / 1000)
        )
    }
}

struct WalletBalance {
    let totalSats: Int64
    let spendableSats: Int64
    let inboundSats: Int64
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