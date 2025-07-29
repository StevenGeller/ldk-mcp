import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const getChannelStatusTool: Tool = {
  name: 'ldk_channel_status',
  description: 'Monitor channel states and balances while coding',
  inputSchema: {
    type: 'object',
    properties: {
      includeOffline: {
        type: 'boolean',
        description: 'Include offline/unusable channels',
        default: true
      }
    }
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const channels = await lightningService.getChannelStatus();
      const filteredChannels = args.includeOffline === false 
        ? channels.filter(c => c.isUsable)
        : channels;

      const totalCapacity = channels.reduce((sum, c) => sum + c.capacityMsat, 0);
      const totalLocal = channels.reduce((sum, c) => sum + c.localBalanceMsat, 0);
      const totalRemote = channels.reduce((sum, c) => sum + c.remoteBalanceMsat, 0);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            summary: {
              totalChannels: channels.length,
              usableChannels: channels.filter(c => c.isUsable).length,
              totalCapacitySats: Math.floor(totalCapacity / 1000),
              totalLocalSats: Math.floor(totalLocal / 1000),
              totalRemoteSats: Math.floor(totalRemote / 1000)
            },
            channels: filteredChannels.map(c => ({
              channelId: c.channelId,
              shortChannelId: c.shortChannelId,
              remotePubkey: c.remotePubkey,
              state: c.state,
              isUsable: c.isUsable,
              capacitySats: Math.floor(c.capacityMsat / 1000),
              localBalanceSats: Math.floor(c.localBalanceMsat / 1000),
              remoteBalanceSats: Math.floor(c.remoteBalanceMsat / 1000)
            })),
            swiftExample: `
// Swift code to display channel status in your iOS app
import SwiftUI
import LightningDevKit

struct ChannelListView: View {
    @State private var channels: [ChannelDetails] = []
    @State private var isLoading = true
    
    var body: some View {
        NavigationView {
            List {
                // Summary Section
                Section("Summary") {
                    HStack {
                        Label("Total Capacity", systemImage: "bolt.circle")
                        Spacer()
                        Text("\\(totalCapacitySats) sats")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Label("Local Balance", systemImage: "arrow.up.circle")
                            .foregroundColor(.green)
                        Spacer()
                        Text("\\(totalLocalSats) sats")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Label("Remote Balance", systemImage: "arrow.down.circle")
                            .foregroundColor(.blue)
                        Spacer()
                        Text("\\(totalRemoteSats) sats")
                            .foregroundColor(.secondary)
                    }
                }
                
                // Channels Section
                Section("Channels (\\(usableChannels)/\\(channels.count))") {
                    ForEach(channels, id: \\.channelId) { channel in
                        ChannelRow(channel: channel)
                    }
                }
            }
            .navigationTitle("Lightning Channels")
            .refreshable {
                await loadChannels()
            }
            .overlay {
                if isLoading {
                    ProgressView()
                }
            }
        }
        .task {
            await loadChannels()
        }
    }
    
    var totalCapacitySats: Int {
        channels.reduce(0) { $0 + Int($1.channelValueSatoshis) }
    }
    
    var totalLocalSats: Int {
        channels.reduce(0) { $0 + Int($1.balanceMsat / 1000) }
    }
    
    var totalRemoteSats: Int {
        channels.reduce(0) { total, channel in
            total + Int(channel.channelValueSatoshis) - Int(channel.balanceMsat / 1000)
        }
    }
    
    var usableChannels: Int {
        channels.filter { $0.isUsable }.count
    }
    
    func loadChannels() async {
        isLoading = true
        defer { isLoading = false }
        
        // Get channels from LDK
        let channelManager = LDKManager.shared.channelManager
        channels = channelManager.listChannels()
    }
}

struct ChannelRow: View {
    let channel: ChannelDetails
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Channel state indicator
            HStack {
                Circle()
                    .fill(channel.isUsable ? Color.green : Color.orange)
                    .frame(width: 10, height: 10)
                
                Text(channelStateText)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if let scid = channel.getShortChannelId() {
                    Text(scid.description)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            // Balance bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 20)
                    
                    // Local balance
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.green)
                        .frame(
                            width: geometry.size.width * localBalanceRatio,
                            height: 20
                        )
                }
            }
            .frame(height: 20)
            
            // Balance text
            HStack {
                Text("\\(localBalanceSats) sats")
                    .font(.caption)
                    .foregroundColor(.green)
                
                Spacer()
                
                Text("\\(remoteBalanceSats) sats")
                    .font(.caption)
                    .foregroundColor(.blue)
            }
        }
        .padding(.vertical, 4)
    }
    
    var channelStateText: String {
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
    
    var localBalanceRatio: Double {
        Double(channel.balanceMsat) / Double(channel.channelValueSatoshis * 1000)
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