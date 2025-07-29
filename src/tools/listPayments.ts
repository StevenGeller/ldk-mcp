import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const listPaymentsTool: Tool = {
  name: 'ldk_list_payments',
  description: 'List recent Lightning payments with status',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of payments to return',
        default: 10
      },
      status: {
        type: 'string',
        enum: ['all', 'pending', 'succeeded', 'failed'],
        description: 'Filter by payment status',
        default: 'all'
      }
    }
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      let payments = await lightningService.listPayments();
      
      // Filter by status
      if (args.status && args.status !== 'all') {
        payments = payments.filter(p => p.status === args.status);
      }
      
      // Limit results
      if (args.limit) {
        payments = payments.slice(0, args.limit);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            count: payments.length,
            payments: payments.map(p => ({
              paymentHash: p.paymentHash,
              paymentPreimage: p.paymentPreimage,
              amountSats: Math.floor(p.amountMsat / 1000),
              feeSats: p.feeMsat ? Math.floor(p.feeMsat / 1000) : 0,
              status: p.status,
              timestamp: p.timestamp,
              description: p.description
            })),
            swiftExample: `
// Swift code to display payment history in your iOS app
import SwiftUI
import LightningDevKit

struct PaymentHistoryView: View {
    @State private var payments: [PaymentRecord] = []
    @State private var isLoading = true
    @State private var selectedFilter: PaymentFilter = .all
    
    enum PaymentFilter: String, CaseIterable {
        case all = "All"
        case sent = "Sent"
        case received = "Received"
        case pending = "Pending"
        case failed = "Failed"
    }
    
    var filteredPayments: [PaymentRecord] {
        switch selectedFilter {
        case .all:
            return payments
        case .sent:
            return payments.filter { $0.direction == .outbound && $0.status == .succeeded }
        case .received:
            return payments.filter { $0.direction == .inbound && $0.status == .succeeded }
        case .pending:
            return payments.filter { $0.status == .pending }
        case .failed:
            return payments.filter { $0.status == .failed }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Filter picker
            Picker("Filter", selection: $selectedFilter) {
                ForEach(PaymentFilter.allCases, id: \\.self) { filter in
                    Text(filter.rawValue).tag(filter)
                }
            }
            .pickerStyle(SegmentedPickerStyle())
            .padding()
            
            // Payment list
            if filteredPayments.isEmpty && !isLoading {
                ContentUnavailableView(
                    "No Payments",
                    systemImage: "bolt.slash",
                    description: Text("Your payment history will appear here")
                )
            } else {
                List(filteredPayments) { payment in
                    PaymentRow(payment: payment)
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                }
                .listStyle(PlainListStyle())
            }
        }
        .navigationTitle("Payment History")
        .task {
            await loadPayments()
        }
        .refreshable {
            await loadPayments()
        }
        .overlay {
            if isLoading {
                ProgressView()
            }
        }
    }
    
    func loadPayments() async {
        isLoading = true
        defer { isLoading = false }
        
        payments = await LDKManager.shared.getPaymentHistory()
    }
}

struct PaymentRow: View {
    let payment: PaymentRecord
    
    var body: some View {
        HStack(spacing: 12) {
            // Direction icon
            Image(systemName: payment.direction == .inbound ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .font(.title2)
                .foregroundColor(payment.direction == .inbound ? .green : .blue)
            
            // Payment details
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(payment.description ?? "Lightning Payment")
                        .font(.body)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    // Amount
                    Text("\\(payment.direction == .inbound ? "+" : "-")\\(payment.amountSats)")
                        .font(.callout)
                        .fontWeight(.medium)
                        .foregroundColor(payment.direction == .inbound ? .green : .primary)
                }
                
                HStack {
                    // Status
                    Label(payment.status.displayText, systemImage: payment.status.icon)
                        .font(.caption)
                        .foregroundColor(payment.status.color)
                    
                    Spacer()
                    
                    // Time
                    Text(formatTime(payment.timestamp))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    func formatTime(_ timestamp: Int64) -> String {
        let date = Date(timeIntervalSince1970: Double(timestamp / 1000))
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// Payment record model
struct PaymentRecord: Identifiable {
    let id: String
    let paymentHash: String
    let paymentPreimage: String?
    let amountSats: Int
    let feeSats: Int
    let status: PaymentStatus
    let direction: PaymentDirection
    let timestamp: Int64
    let description: String?
    
    enum PaymentDirection {
        case inbound
        case outbound
    }
    
    enum PaymentStatus {
        case pending
        case succeeded
        case failed
        
        var displayText: String {
            switch self {
            case .pending: return "Pending"
            case .succeeded: return "Completed"
            case .failed: return "Failed"
            }
        }
        
        var icon: String {
            switch self {
            case .pending: return "clock"
            case .succeeded: return "checkmark.circle"
            case .failed: return "xmark.circle"
            }
        }
        
        var color: Color {
            switch self {
            case .pending: return .orange
            case .succeeded: return .green
            case .failed: return .red
            }
        }
    }
}

// Extension to fetch payment history
extension LDKManager {
    func getPaymentHistory() async -> [PaymentRecord] {
        // Fetch from event store or database
        var records: [PaymentRecord] = []
        
        // Get recent payments from channel manager events
        let recentPayments = getRecentPaymentEvents()
        
        for event in recentPayments {
            if let sent = event as? PaymentSent {
                records.append(PaymentRecord(
                    id: sent.paymentHash.toHex(),
                    paymentHash: sent.paymentHash.toHex(),
                    paymentPreimage: sent.paymentPreimage.toHex(),
                    amountSats: Int(sent.amountMsat / 1000),
                    feeSats: Int((sent.feePaidMsat ?? 0) / 1000),
                    status: .succeeded,
                    direction: .outbound,
                    timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                    description: nil
                ))
            } else if let received = event as? PaymentReceived {
                records.append(PaymentRecord(
                    id: received.paymentHash.toHex(),
                    paymentHash: received.paymentHash.toHex(),
                    paymentPreimage: nil,
                    amountSats: Int(received.amountMsat / 1000),
                    feeSats: 0,
                    status: .succeeded,
                    direction: .inbound,
                    timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                    description: received.purpose.description
                ))
            }
        }
        
        return records.sorted { $0.timestamp > $1.timestamp }
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