import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const estimateFeeTool: Tool = {
  name: 'ldk_estimate_fee',
  description: 'Estimate Lightning routing fees for a payment',
  inputSchema: {
    type: 'object',
    properties: {
      amountSats: {
        type: 'number',
        description: 'Payment amount in satoshis',
        minimum: 1
      },
      targetNode: {
        type: 'string',
        description: 'Target node public key (optional)'
      }
    },
    required: ['amountSats']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const amountMsat = args.amountSats * 1000;
      const estimate = await lightningService.estimateFee(amountMsat);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            amountSats: args.amountSats,
            feeEstimate: {
              baseFee: estimate.baseFee,
              proportionalMillionths: estimate.proportionalMillionths,
              estimatedFeeSats: Math.ceil(estimate.estimatedFeeMsat / 1000),
              estimatedDurationSeconds: estimate.estimatedDurationSeconds,
              feePercentage: (estimate.estimatedFeeMsat / amountMsat * 100).toFixed(2)
            },
            swiftExample: `
// Swift code for fee estimation in your iOS app
import SwiftUI
import LightningDevKit

struct FeeEstimator {
    static func estimateRoutingFee(
        amountMsat: UInt64,
        targetNode: [UInt8]? = nil
    ) -> FeeEstimate {
        let router = LDKManager.shared.router
        let networkGraph = LDKManager.shared.networkGraph
        
        // Get route parameters
        let paymentParams = PaymentParameters.initForKeysend(
            payeePublicKey: targetNode ?? generateRandomPubkey()
        )
        
        let routeParams = RouteParameters(
            paymentParamsArg: paymentParams,
            finalValueMsatArg: amountMsat
        )
        
        // Find route
        let routeResult = router.findRoute(
            payer: LDKManager.shared.channelManager.getOurNodeId(),
            routeParams: routeParams,
            channelDetails: LDKManager.shared.channelManager.listUsableChannels(),
            scorerParams: InFlightHtlcs()
        )
        
        if let route = routeResult.getValue() {
            let totalFees = route.getTotalFees()
            let hops = route.getHops().count
            
            return FeeEstimate(
                totalFeeMsat: totalFees,
                numberOfHops: hops,
                estimatedDuration: hops * 30 // ~30 seconds per hop
            )
        } else {
            // Fallback estimate
            return FeeEstimate(
                totalFeeMsat: UInt64(Double(amountMsat) * 0.001), // 0.1%
                numberOfHops: 3,
                estimatedDuration: 90
            )
        }
    }
}

struct FeeEstimate {
    let totalFeeMsat: UInt64
    let numberOfHops: Int
    let estimatedDuration: Int
    
    var totalFeeSats: Int {
        Int(totalFeeMsat / 1000)
    }
}

// SwiftUI Fee Display Component
struct FeeEstimateView: View {
    let amountSats: Int
    @State private var feeEstimate: FeeEstimate?
    @State private var isCalculating = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Network Fee", systemImage: "network")
                    .font(.headline)
                
                Spacer()
                
                if isCalculating {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }
            
            if let estimate = feeEstimate {
                VStack(alignment: .leading, spacing: 8) {
                    // Fee amount
                    HStack {
                        Text("Estimated Fee")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("~\\(estimate.totalFeeSats) sats")
                            .fontWeight(.medium)
                    }
                    
                    // Fee percentage
                    HStack {
                        Text("Fee Rate")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(String(format: "%.2f%%", feePercentage))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    // Route info
                    HStack {
                        Text("Route Hops")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\\(estimate.numberOfHops)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    // Duration
                    HStack {
                        Text("Est. Duration")
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("~\\(estimate.estimatedDuration)s")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                // Visual fee indicator
                FeeIndicator(feePercentage: feePercentage)
                    .padding(.top, 8)
                
            } else {
                Text("Calculating route fees...")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
        .task {
            await calculateFee()
        }
    }
    
    var feePercentage: Double {
        guard let estimate = feeEstimate, amountSats > 0 else { return 0 }
        return Double(estimate.totalFeeSats) / Double(amountSats) * 100
    }
    
    func calculateFee() async {
        isCalculating = true
        defer { isCalculating = false }
        
        feeEstimate = FeeEstimator.estimateRoutingFee(
            amountMsat: UInt64(amountSats * 1000)
        )
    }
}

struct FeeIndicator: View {
    let feePercentage: Double
    
    var feeLevel: FeeLevel {
        if feePercentage < 0.1 {
            return .low
        } else if feePercentage < 0.5 {
            return .medium
        } else {
            return .high
        }
    }
    
    enum FeeLevel {
        case low, medium, high
        
        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .orange
            case .high: return .red
            }
        }
        
        var text: String {
            switch self {
            case .low: return "Low fees"
            case .medium: return "Normal fees"
            case .high: return "High fees"
            }
        }
    }
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(feeLevel.color)
                .frame(width: 8, height: 8)
            
            Text(feeLevel.text)
                .font(.caption)
                .foregroundColor(feeLevel.color)
            
            Spacer()
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