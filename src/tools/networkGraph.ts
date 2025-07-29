import { Tool, ToolResult } from '../types/tool.js';

export const networkGraphTool: Tool = {
  name: 'ldk_network_graph',
  description: 'Get network graph operations and RapidGossipSync implementation',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'setup',
          'rapid_gossip_sync',
          'query_routes',
          'node_info',
          'channel_info',
          'update_handling'
        ],
        description: 'Network graph operation to perform'
      },
      nodeId: {
        type: 'string',
        description: 'Node ID for node_info operation (optional)'
      },
      channelId: {
        type: 'string',
        description: 'Channel ID for channel_info operation (optional)'
      }
    },
    required: ['operation']
  },
  execute: async (args: any): Promise<ToolResult> => {
    const swiftExamples: Record<string, string> = {
      setup: `
// Network Graph and RapidGossipSync setup in Swift
import LightningDevKit

class NetworkGraphManager {
    private let networkGraph: Bindings.NetworkGraph
    private let rapidGossipSync: Bindings.RapidGossipSync
    private let logger: Bindings.Logger
    private let network: Bindings.Network
    private var lastSyncTimestamp: UInt64 = 0
    
    init(network: Bindings.Network, logger: Bindings.Logger) {
        self.network = network
        self.logger = logger
        
        // Initialize or load network graph
        if let savedGraph = loadNetworkGraphFromDisk() {
            let readResult = Bindings.NetworkGraph.read(ser: savedGraph, arg: logger)
            if readResult.isOk() {
                self.networkGraph = readResult.getValue()!
            } else {
                self.networkGraph = Bindings.NetworkGraph(network: network, logger: logger)
            }
        } else {
            self.networkGraph = Bindings.NetworkGraph(network: network, logger: logger)
        }
        
        // Initialize RapidGossipSync
        self.rapidGossipSync = Bindings.RapidGossipSync(networkGraph: networkGraph, logger: logger)
        
        // Load last sync timestamp
        self.lastSyncTimestamp = UserDefaults.standard.object(forKey: "lastGossipSync") as? UInt64 ?? 0
    }
    
    // Persist network graph to disk
    func saveNetworkGraph() throws {
        let serialized = networkGraph.write()
        let documentsPath = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        let graphPath = documentsPath.appendingPathComponent("network_graph.bin")
        
        try Data(serialized).write(to: graphPath)
    }
    
    private func loadNetworkGraphFromDisk() -> [UInt8]? {
        let documentsPath = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first!
        let graphPath = documentsPath.appendingPathComponent("network_graph.bin")
        
        guard let data = try? Data(contentsOf: graphPath) else {
            return nil
        }
        
        return [UInt8](data)
    }
}`.trim(),

      rapid_gossip_sync: `
// RapidGossipSync implementation for efficient network updates
import LightningDevKit

extension NetworkGraphManager {
    // Sync network graph using RapidGossipSync
    func syncNetworkGraph() async throws {
        let currentTime = UInt64(Date().timeIntervalSince1970)
        
        // Build RGS URL with last sync timestamp
        let baseUrl = network == .bitcoin ? 
            "https://rapidsync.lightningdevkit.org/snapshot" :
            "https://rapidsync.lightningdevkit.org/testnet/snapshot"
        
        let url = URL(string: "\\(baseUrl)/\\(lastSyncTimestamp)")!
        
        // Download snapshot
        let (data, response) = try await URLSession.shared.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NetworkError.syncFailed
        }
        
        // Apply update to network graph
        let result = rapidGossipSync.updateNetworkGraphNoStd(
            updateData: [UInt8](data),
            currentTimeUnix: currentTime
        )
        
        if result.isOk() {
            // Update last sync timestamp
            lastSyncTimestamp = currentTime
            UserDefaults.standard.set(lastSyncTimestamp, forKey: "lastGossipSync")
            
            // Persist updated graph
            try saveNetworkGraph()
            
            print("RapidGossipSync successful - updated to timestamp: \\(currentTime)")
        } else if let error = result.getError() {
            throw NetworkError.graphUpdateFailed(error.getValueAsDecodeError()?.getDescription() ?? "Unknown error")
        }
    }
    
    // Schedule automatic sync
    func startAutomaticSync(interval: TimeInterval = 3600) {
        Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { _ in
            Task {
                do {
                    try await self.syncNetworkGraph()
                } catch {
                    print("Automatic sync failed: \\(error)")
                }
            }
        }
        
        // Perform initial sync
        Task {
            try? await syncNetworkGraph()
        }
    }
    
    // Manual incremental update
    func applyGossipUpdate(_ update: [UInt8]) -> Bool {
        let currentTime = UInt64(Date().timeIntervalSince1970)
        let result = rapidGossipSync.updateNetworkGraphNoStd(
            updateData: update,
            currentTimeUnix: currentTime
        )
        
        return result.isOk()
    }
}

// Background task for iOS
extension NetworkGraphManager {
    func performBackgroundSync() async -> Bool {
        do {
            try await syncNetworkGraph()
            return true
        } catch {
            print("Background sync failed: \\(error)")
            return false
        }
    }
}`.trim(),

      query_routes: `
// Query routes using the network graph
import LightningDevKit

extension NetworkGraphManager {
    // Find routes for a payment
    func findRoute(
        to destination: [UInt8],
        amountMsat: UInt64,
        paymentParams: Bindings.PaymentParameters
    ) -> Result<[RouteInfo], RoutingError> {
        let channelManager = LDKManager.shared.channelManager
        let ourNodeId = channelManager.getOurNodeId()
        let channels = channelManager.listUsableChannels()
        
        // Create route parameters
        let routeParams = Bindings.RouteParameters(
            paymentParamsArg: paymentParams,
            finalValueMsatArg: amountMsat,
            maxTotalRoutingFeeMsatArg: amountMsat / 100 // 1% max fee
        )
        
        // Use router to find route
        let router = LDKManager.shared.router
        let inflightHtlcs = Bindings.InFlightHtlcs()
        
        let routeResult = router.findRoute(
            payer: ourNodeId,
            routeParams: routeParams,
            firstHops: channels,
            inflightHtlcs: inflightHtlcs
        )
        
        if routeResult.isOk(), let route = routeResult.getValue() {
            return .success(analyzeRoute(route))
        } else if let error = routeResult.getError() {
            return .failure(.routingFailed(error.getDescription()))
        }
        
        return .failure(.noRoute)
    }
    
    // Analyze route details
    private func analyzeRoute(_ route: Bindings.Route) -> [RouteInfo] {
        return route.getPaths().map { path in
            let hops = path.getHops().map { hop in
                HopInfo(
                    pubkey: Data(hop.getPubkey()).hexString,
                    shortChannelId: hop.getShortChannelId(),
                    feeMsat: hop.getFeeMsat(),
                    cltvExpiryDelta: hop.getCltvExpiryDelta()
                )
            }
            
            let totalFees = path.getFeeMsat()
            let finalValueMsat = path.getFinalValueMsat()
            
            return RouteInfo(
                hops: hops,
                totalFeeMsat: totalFees,
                totalAmountMsat: finalValueMsat
            )
        }
    }
}

struct RouteInfo {
    let hops: [HopInfo]
    let totalFeeMsat: UInt64
    let totalAmountMsat: UInt64
}

struct HopInfo {
    let pubkey: String
    let shortChannelId: UInt64
    let feeMsat: UInt64
    let cltvExpiryDelta: UInt32
}

enum RoutingError: Error {
    case noRoute
    case routingFailed(String)
    case insufficientBalance
}`.trim(),

      node_info: `
// Query node information from network graph
import LightningDevKit

extension NetworkGraphManager {
    // Get information about a specific node
    func getNodeInfo(nodeId: String) -> NodeDetails? {
        guard let pubkeyData = Data(hexString: nodeId),
              pubkeyData.count == 33 else {
            return nil
        }
        
        let nodeIdObj = Bindings.NodeId(pubkey: pubkeyData.bytes)
        
        guard let nodeInfo = networkGraph.readOnly().node(nodeId: nodeIdObj) else {
            return nil
        }
        
        // Extract node details
        let channels = nodeInfo.getChannels()
        let announcement = nodeInfo.getAnnouncementMessage()
        
        var nodeDetails = NodeDetails(
            nodeId: nodeId,
            alias: "",
            color: "",
            addresses: [],
            features: [],
            channelCount: channels.count,
            totalCapacityMsat: 0
        )
        
        // Parse announcement if available
        if let announcement = announcement {
            let contents = announcement.getContents()
            nodeDetails.alias = String(data: Data(contents.getAlias()), encoding: .utf8) ?? ""
            nodeDetails.color = Data(contents.getRgb()).hexString
            
            // Parse addresses
            nodeDetails.addresses = contents.getAddresses().compactMap { address in
                parseNetworkAddress(address)
            }
            
            // Features
            if let features = contents.getFeatures() {
                nodeDetails.features = parseNodeFeatures(features)
            }
        }
        
        // Calculate total capacity
        for channelId in channels {
            if let channelInfo = networkGraph.readOnly().channel(shortChannelId: channelId) {
                nodeDetails.totalCapacityMsat += channelInfo.getCapacityMsat() ?? 0
            }
        }
        
        return nodeDetails
    }
    
    // Get all known nodes
    func getAllNodes() -> [NodeSummary] {
        let readOnly = networkGraph.readOnly()
        let nodeIds = readOnly.listNodes()
        
        return nodeIds.compactMap { nodeId in
            guard let nodeInfo = readOnly.node(nodeId: nodeId) else {
                return nil
            }
            
            let pubkey = Data(nodeId.asSlice()).hexString
            let channels = nodeInfo.getChannels()
            
            var alias = ""
            if let announcement = nodeInfo.getAnnouncementMessage() {
                alias = String(data: Data(announcement.getContents().getAlias()), encoding: .utf8) ?? ""
            }
            
            return NodeSummary(
                nodeId: pubkey,
                alias: alias,
                channelCount: channels.count,
                isReachable: !channels.isEmpty
            )
        }
    }
    
    private func parseNetworkAddress(_ address: Bindings.SocketAddress) -> String? {
        switch address.getValueType() {
        case .TcpIpV4:
            if let ipv4 = address.getValueAsTcpIpV4() {
                let addr = ipv4.getAddr()
                return "\\(addr.0).\\(addr.1).\\(addr.2).\\(addr.3):\\(ipv4.getPort())"
            }
        case .TcpIpV6:
            if let ipv6 = address.getValueAsTcpIpV6() {
                return "[\\(ipv6.getAddr().map{String($0)}.joined(separator:":"))]:\\(ipv6.getPort())"
            }
        case .OnionV3:
            if let onion = address.getValueAsOnionV3() {
                return "\\(Data(onion.getEd25519Pubkey()).hexString).onion:\\(onion.getPort())"
            }
        default:
            break
        }
        return nil
    }
    
    private func parseNodeFeatures(_ features: Bindings.NodeFeatures) -> [String] {
        var featureList: [String] = []
        
        if features.supportsVariableLengthOnion() {
            featureList.append("Variable Length Onion")
        }
        if features.supportsStaticRemoteKey() {
            featureList.append("Static Remote Key")
        }
        if features.supportsAnchors() {
            featureList.append("Anchor Outputs")
        }
        
        return featureList
    }
}

struct NodeDetails {
    var nodeId: String
    var alias: String
    var color: String
    var addresses: [String]
    var features: [String]
    var channelCount: Int
    var totalCapacityMsat: UInt64
}

struct NodeSummary {
    let nodeId: String
    let alias: String
    let channelCount: Int
    let isReachable: Bool
}`.trim(),

      channel_info: `
// Query channel information from network graph
import LightningDevKit

extension NetworkGraphManager {
    // Get information about a specific channel
    func getChannelInfo(shortChannelId: UInt64) -> ChannelDetails? {
        guard let channelInfo = networkGraph.readOnly().channel(shortChannelId: shortChannelId) else {
            return nil
        }
        
        let node1 = Data(channelInfo.getNodeOne().asSlice()).hexString
        let node2 = Data(channelInfo.getNodeTwo().asSlice()).hexString
        
        var details = ChannelDetails(
            shortChannelId: shortChannelId,
            node1: node1,
            node2: node2,
            capacityMsat: channelInfo.getCapacityMsat(),
            node1Policy: nil,
            node2Policy: nil,
            lastUpdate: nil
        )
        
        // Get directional policies
        if let node1Policy = channelInfo.getOneToTwo() {
            details.node1Policy = parseChannelPolicy(node1Policy)
        }
        
        if let node2Policy = channelInfo.getTwoToOne() {
            details.node2Policy = parseChannelPolicy(node2Policy)
        }
        
        // Get announcement details
        if let announcement = channelInfo.getAnnouncementMessage() {
            let contents = announcement.getContents()
            details.lastUpdate = Date(timeIntervalSince1970: TimeInterval(contents.getTimestamp()))
        }
        
        return details
    }
    
    // Get all channels for a node
    func getNodeChannels(nodeId: String) -> [ChannelSummary] {
        guard let pubkeyData = Data(hexString: nodeId),
              pubkeyData.count == 33 else {
            return []
        }
        
        let nodeIdObj = Bindings.NodeId(pubkey: pubkeyData.bytes)
        
        guard let nodeInfo = networkGraph.readOnly().node(nodeId: nodeIdObj) else {
            return []
        }
        
        return nodeInfo.getChannels().compactMap { channelId in
            guard let channelInfo = networkGraph.readOnly().channel(shortChannelId: channelId) else {
                return nil
            }
            
            let node1 = Data(channelInfo.getNodeOne().asSlice()).hexString
            let node2 = Data(channelInfo.getNodeTwo().asSlice()).hexString
            let isNode1 = node1 == nodeId
            let remoteNode = isNode1 ? node2 : node1
            
            // Get our policy
            let ourPolicy = isNode1 ? channelInfo.getOneToTwo() : channelInfo.getTwoToOne()
            let theirPolicy = isNode1 ? channelInfo.getTwoToOne() : channelInfo.getOneToTwo()
            
            return ChannelSummary(
                shortChannelId: channelId,
                remoteNode: remoteNode,
                capacityMsat: channelInfo.getCapacityMsat(),
                isEnabled: ourPolicy?.getEnabled() ?? false,
                baseFee: ourPolicy?.getFeeBaseMsat() ?? 0,
                feeRate: ourPolicy?.getFeeProportionalMillionths() ?? 0,
                remoteBaseFee: theirPolicy?.getFeeBaseMsat() ?? 0,
                remoteFeeRate: theirPolicy?.getFeeProportionalMillionths() ?? 0
            )
        }
    }
    
    private func parseChannelPolicy(_ update: Bindings.ChannelUpdateInfo) -> ChannelPolicy {
        return ChannelPolicy(
            enabled: update.getEnabled(),
            cltvExpiryDelta: update.getCltvExpiryDelta(),
            htlcMinimumMsat: update.getHtlcMinimumMsat(),
            htlcMaximumMsat: update.getHtlcMaximumMsat(),
            feeBaseMsat: update.getFeeBaseMsat(),
            feeProportionalMillionths: update.getFeeProportionalMillionths(),
            lastUpdate: Date(timeIntervalSince1970: TimeInterval(update.getLastUpdate()))
        )
    }
}

struct ChannelDetails {
    let shortChannelId: UInt64
    let node1: String
    let node2: String
    let capacityMsat: UInt64?
    var node1Policy: ChannelPolicy?
    var node2Policy: ChannelPolicy?
    var lastUpdate: Date?
}

struct ChannelPolicy {
    let enabled: Bool
    let cltvExpiryDelta: UInt16
    let htlcMinimumMsat: UInt64
    let htlcMaximumMsat: UInt64?
    let feeBaseMsat: UInt32
    let feeProportionalMillionths: UInt32
    let lastUpdate: Date
}

struct ChannelSummary {
    let shortChannelId: UInt64
    let remoteNode: String
    let capacityMsat: UInt64?
    let isEnabled: Bool
    let baseFee: UInt32
    let feeRate: UInt32
    let remoteBaseFee: UInt32
    let remoteFeeRate: UInt32
}`.trim(),

      update_handling: `
// Handle network graph updates
import LightningDevKit

extension NetworkGraphManager {
    // Process channel announcement
    func handleChannelAnnouncement(_ announcement: Bindings.ChannelAnnouncement) -> Bool {
        let result = networkGraph.updateChannelFromAnnouncement(
            msg: announcement,
            utxoLookup: nil
        )
        
        if result.isOk() {
            // Persist updated graph
            try? saveNetworkGraph()
            return true
        }
        
        return false
    }
    
    // Process channel update
    func handleChannelUpdate(_ update: Bindings.ChannelUpdate) -> Bool {
        let result = networkGraph.updateChannelFromUnsignedAnnouncement(
            msg: update.getContents(),
            utxoLookup: nil
        )
        
        if result.isOk() {
            try? saveNetworkGraph()
            return true
        }
        
        return false
    }
    
    // Process node announcement
    func handleNodeAnnouncement(_ announcement: Bindings.NodeAnnouncement) -> Bool {
        let result = networkGraph.updateNodeFromAnnouncement(msg: announcement)
        
        if result.isOk() {
            try? saveNetworkGraph()
            return true
        }
        
        return false
    }
    
    // Prune old channels
    func pruneStaleChannels() {
        let currentTime = UInt64(Date().timeIntervalSince1970)
        let twoWeeksAgo = currentTime - (14 * 24 * 60 * 60)
        
        networkGraph.removeStaleChannelsAndTrackedNodes(currentTimeUnix: twoWeeksAgo)
        
        // Persist pruned graph
        try? saveNetworkGraph()
    }
    
    // Monitor graph statistics
    func getGraphStatistics() -> GraphStatistics {
        let readOnly = networkGraph.readOnly()
        let nodeCount = readOnly.listNodes().count
        
        var channelCount = 0
        var totalCapacityMsat: UInt64 = 0
        
        for node in readOnly.listNodes() {
            if let nodeInfo = readOnly.node(nodeId: node) {
                let channels = nodeInfo.getChannels()
                channelCount += channels.count
                
                for channelId in channels {
                    if let channelInfo = readOnly.channel(shortChannelId: channelId) {
                        totalCapacityMsat += channelInfo.getCapacityMsat() ?? 0
                    }
                }
            }
        }
        
        // Channels are counted twice (once per node)
        channelCount /= 2
        
        return GraphStatistics(
            nodeCount: nodeCount,
            channelCount: channelCount,
            totalCapacityMsat: totalCapacityMsat,
            lastSync: Date(timeIntervalSince1970: TimeInterval(lastSyncTimestamp))
        )
    }
}

struct GraphStatistics {
    let nodeCount: Int
    let channelCount: Int
    let totalCapacityMsat: UInt64
    let lastSync: Date
}

// SwiftUI View for Network Graph Stats
struct NetworkGraphView: View {
    @StateObject private var viewModel = NetworkGraphViewModel()
    
    var body: some View {
        List {
            Section("Network Statistics") {
                StatRow(label: "Nodes", value: "\\(viewModel.stats.nodeCount)")
                StatRow(label: "Channels", value: "\\(viewModel.stats.channelCount)")
                StatRow(label: "Total Capacity", value: "\\(viewModel.stats.totalCapacityMsat / 1_000_000_000) BTC")
            }
            
            Section("Sync Status") {
                HStack {
                    Text("Last Sync")
                    Spacer()
                    Text(viewModel.stats.lastSync, style: .relative)
                        .foregroundColor(.secondary)
                }
                
                Button("Sync Now") {
                    Task {
                        await viewModel.syncNetworkGraph()
                    }
                }
                .disabled(viewModel.isSyncing)
            }
            
            if viewModel.isSyncing {
                Section {
                    HStack {
                        ProgressView()
                        Text("Syncing network graph...")
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .navigationTitle("Network Graph")
        .onAppear {
            viewModel.loadStatistics()
        }
    }
}

struct StatRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
            Spacer()
            Text(value)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
        }
    }
}`.trim()
    };

    try {
      const code = swiftExamples[args.operation];
      if (!code) {
        throw new Error(`Unknown operation: ${args.operation}`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            operation: args.operation,
            swiftCode: code,
            description: `NetworkGraph and RapidGossipSync implementation for ${args.operation}`
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