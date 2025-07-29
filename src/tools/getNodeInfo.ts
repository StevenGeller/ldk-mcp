import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const getNodeInfoTool: Tool = {
  name: 'ldk_node_info',
  description: 'Get current node status and connectivity information',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const nodeInfo = await lightningService.getNodeInfo();
      const balance = await lightningService.getBalance();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            node: {
              nodeId: nodeInfo.nodeId,
              alias: nodeInfo.alias,
              version: nodeInfo.version,
              blockHeight: nodeInfo.blockHeight,
              syncedToChain: nodeInfo.syncedToChain
            },
            channels: {
              total: nodeInfo.numChannels,
              usable: nodeInfo.numUsableChannels
            },
            balance: {
              totalSats: Math.floor(balance.totalMsat / 1000),
              spendableSats: Math.floor(balance.spendableMsat / 1000)
            },
            peers: nodeInfo.numPeers,
            swiftExample: `
// Swift code to display node info in your iOS app
import SwiftUI
import LightningDevKit

struct NodeInfoView: View {
    @State private var nodeInfo: NodeInfo?
    @State private var isLoading = true
    @State private var isSyncing = false
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Node Identity Card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "bolt.circle.fill")
                            .font(.largeTitle)
                            .foregroundColor(.orange)
                        
                        VStack(alignment: .leading) {
                            Text(nodeInfo?.alias ?? "Lightning Node")
                                .font(.title2)
                                .fontWeight(.semibold)
                            
                            Text(nodeInfo?.nodeId.prefix(16) ?? "")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .monospaced()
                        }
                        
                        Spacer()
                    }
                    
                    Divider()
                    
                    // Sync Status
                    HStack {
                        Label(
                            nodeInfo?.syncedToChain == true ? "Synced" : "Syncing...",
                            systemImage: nodeInfo?.syncedToChain == true ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath"
                        )
                        .foregroundColor(nodeInfo?.syncedToChain == true ? .green : .orange)
                        
                        Spacer()
                        
                        Text("Block \\(nodeInfo?.blockHeight ?? 0)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                
                // Stats Grid
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 16) {
                    StatCard(
                        title: "Channels",
                        value: "\\(nodeInfo?.numUsableChannels ?? 0)/\\(nodeInfo?.numChannels ?? 0)",
                        icon: "link",
                        color: .blue
                    )
                    
                    StatCard(
                        title: "Peers",
                        value: "\\(nodeInfo?.numPeers ?? 0)",
                        icon: "person.2",
                        color: .green
                    )
                    
                    StatCard(
                        title: "Total Balance",
                        value: "\\(formatSats(nodeInfo?.totalBalanceSats ?? 0))",
                        icon: "bitcoinsign.circle",
                        color: .orange
                    )
                    
                    StatCard(
                        title: "Spendable",
                        value: "\\(formatSats(nodeInfo?.spendableBalanceSats ?? 0))",
                        icon: "paperplane",
                        color: .purple
                    )
                }
                
                // Actions
                VStack(spacing: 12) {
                    Button(action: syncToTip) {
                        Label("Sync to Chain Tip", systemImage: "arrow.clockwise")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isSyncing)
                    
                    Button(action: openChannel) {
                        Label("Open Channel", systemImage: "plus.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(.top)
            }
            .padding()
        }
        .navigationTitle("Node Info")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            await loadNodeInfo()
        }
        .task {
            await loadNodeInfo()
        }
        .overlay {
            if isLoading {
                ProgressView("Loading node info...")
                    .padding()
                    .background(Color(UIColor.systemBackground))
                    .cornerRadius(10)
                    .shadow(radius: 5)
            }
        }
    }
    
    func loadNodeInfo() async {
        isLoading = true
        defer { isLoading = false }
        
        // Fetch node info from LDK
        let ldkManager = LDKManager.shared
        nodeInfo = await ldkManager.getNodeInfo()
    }
    
    func syncToTip() {
        Task {
            isSyncing = true
            defer { isSyncing = false }
            
            await LDKManager.shared.syncToChainTip()
            await loadNodeInfo()
        }
    }
    
    func openChannel() {
        // Navigate to channel opening view
    }
    
    func formatSats(_ sats: Int64) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: sats)) ?? "0"
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(value)
                    .font(.title3)
                    .fontWeight(.semibold)
                
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(10)
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