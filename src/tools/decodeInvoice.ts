import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const decodeInvoiceTool: Tool = {
  name: 'ldk_decode_invoice',
  description: 'Decode and validate Lightning invoices',
  inputSchema: {
    type: 'object',
    properties: {
      invoice: {
        type: 'string',
        description: 'BOLT11 Lightning invoice to decode'
      }
    },
    required: ['invoice']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const decoded = await lightningService.decodeInvoice(args.invoice);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            ...decoded,
            amountSats: decoded.amountMsat ? Math.floor(decoded.amountMsat / 1000) : null,
            isExpired: decoded.timestamp + (decoded.expiry || 3600) < Date.now() / 1000,
            swiftExample: `
// Swift code to decode and display invoice in your iOS app
import SwiftUI
import LightningDevKit

struct InvoiceDecoder: View {
    @State private var invoiceText = ""
    @State private var decodedInvoice: DecodedInvoice?
    @State private var error: String?
    @State private var showingScanner = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Input section
            VStack(alignment: .leading, spacing: 12) {
                Text("Lightning Invoice")
                    .font(.headline)
                
                HStack {
                    TextField("Paste invoice or scan QR", text: $invoiceText)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onChange(of: invoiceText) { _ in
                            decodeIfValid()
                        }
                    
                    Button(action: { showingScanner = true }) {
                        Image(systemName: "qrcode.viewfinder")
                            .font(.title2)
                    }
                    
                    Button(action: pasteFromClipboard) {
                        Image(systemName: "doc.on.clipboard")
                            .font(.title2)
                    }
                }
            }
            
            // Decoded invoice details
            if let invoice = decodedInvoice {
                InvoiceDetailsCard(invoice: invoice)
            }
            
            Spacer()
        }
        .padding()
        .navigationTitle("Decode Invoice")
        .sheet(isPresented: $showingScanner) {
            QRScannerView { scannedCode in
                invoiceText = scannedCode
                showingScanner = false
            }
        }
        .alert("Error", isPresented: .constant(error != nil)) {
            Button("OK") { error = nil }
        } message: {
            Text(error ?? "")
        }
    }
    
    func decodeIfValid() {
        guard !invoiceText.isEmpty else {
            decodedInvoice = nil
            return
        }
        
        // Decode the invoice
        let result = Bolt11Invoice.fromStr(s: invoiceText.trimmingCharacters(in: .whitespacesAndNewlines))
        
        if let invoice = result.getValue() {
            decodedInvoice = DecodedInvoice(from: invoice)
            error = nil
        } else {
            decodedInvoice = nil
            error = "Invalid Lightning invoice"
        }
    }
    
    func pasteFromClipboard() {
        if let text = UIPasteboard.general.string {
            invoiceText = text
        }
    }
}

struct InvoiceDetailsCard: View {
    let invoice: DecodedInvoice
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Status indicator
            HStack {
                if invoice.isExpired {
                    Label("Expired", systemImage: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                } else {
                    Label("Valid", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
                
                Spacer()
                
                Text(invoice.network.uppercased())
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.secondary.opacity(0.2))
                    .cornerRadius(4)
            }
            
            Divider()
            
            // Amount
            if let amountSats = invoice.amountSats {
                DetailRow(
                    label: "Amount",
                    value: "\\(amountSats.formatted()) sats",
                    icon: "bitcoinsign.circle"
                )
            } else {
                DetailRow(
                    label: "Amount",
                    value: "Any amount",
                    icon: "bitcoinsign.circle"
                )
            }
            
            // Description
            if let description = invoice.description {
                DetailRow(
                    label: "Description",
                    value: description,
                    icon: "text.alignleft"
                )
            }
            
            // Payment hash
            DetailRow(
                label: "Payment Hash",
                value: invoice.paymentHash.prefix(16) + "...",
                icon: "number",
                isMonospaced: true
            )
            
            // Expiry
            DetailRow(
                label: "Expires",
                value: formatExpiry(invoice.timestamp, invoice.expiry),
                icon: "clock"
            )
            
            // Payee
            if let payee = invoice.payee {
                DetailRow(
                    label: "Payee",
                    value: payee.prefix(16) + "...",
                    icon: "person.circle",
                    isMonospaced: true
                )
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    func formatExpiry(_ timestamp: Int64, _ expiry: Int?) -> String {
        let expiryTime = Date(timeIntervalSince1970: Double(timestamp + Int64(expiry ?? 3600)))
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: expiryTime, relativeTo: Date())
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    let icon: String
    var isMonospaced = false
    
    var body: some View {
        HStack(alignment: .top) {
            Label(label, systemImage: icon)
                .foregroundColor(.secondary)
                .frame(width: 120, alignment: .leading)
            
            Text(value)
                .font(isMonospaced ? .system(.body, design: .monospaced) : .body)
                .foregroundColor(.primary)
                .multilineTextAlignment(.trailing)
            
            Spacer()
        }
    }
}

struct DecodedInvoice {
    let paymentHash: String
    let amountSats: Int?
    let description: String?
    let expiry: Int
    let timestamp: Int64
    let payee: String?
    let network: String
    let isExpired: Bool
    
    init(from invoice: Bolt11Invoice) {
        self.paymentHash = invoice.paymentHash()?.toHex() ?? ""
        self.amountSats = invoice.amountMilliSatoshis()?.getValue().map { Int($0 / 1000) }
        self.description = invoice.description()
        self.expiry = Int(invoice.expiry())
        self.timestamp = Int64(invoice.timestamp())
        self.payee = invoice.payee()?.toHex()
        self.network = invoice.network() == .Bitcoin ? "mainnet" : 
                      invoice.network() == .Testnet ? "testnet" : "regtest"
        self.isExpired = Date().timeIntervalSince1970 > Double(timestamp + Int64(expiry))
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