import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const generateInvoiceTool: Tool = {
  name: 'ldk_generate_invoice',
  description: 'Generate a Lightning invoice with real payment hash for testing',
  inputSchema: {
    type: 'object',
    properties: {
      amountSats: {
        type: 'number',
        description: 'Amount in satoshis',
        minimum: 1
      },
      description: {
        type: 'string',
        description: 'Invoice description'
      },
      expirySeconds: {
        type: 'number',
        description: 'Invoice expiry time in seconds (default: 3600)',
        default: 3600
      }
    },
    required: ['amountSats']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const amountMsat = args.amountSats * 1000;
      const invoice = await lightningService.generateInvoice(
        amountMsat,
        args.description,
        args.expirySeconds || 3600
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            invoice: invoice.bolt11,
            paymentHash: invoice.paymentHash,
            amountSats: args.amountSats,
            expiryTime: invoice.expiryTime,
            description: invoice.description,
            swiftExample: `
// Swift code to generate and display Lightning invoice using LDK
import SwiftUI
import LightningDevKit
import CoreImage.CIFilterBuiltins

class InvoiceGenerator {
    let channelManager: Bindings.ChannelManager
    let logger: Bindings.Logger
    let keys: Bindings.KeysManager
    
    init(channelManager: Bindings.ChannelManager, logger: Bindings.Logger, keys: Bindings.KeysManager) {
        self.channelManager = channelManager
        self.logger = logger
        self.keys = keys
    }
    
    func createInvoice(amountMsat: UInt64?, description: String, expirySecs: UInt32 = 3600) -> Result<Bindings.Bolt11Invoice, Error> {
        let invoiceParams = Bindings.InvoiceBuilder.newInvoiceBuilder()
        
        if let amount = amountMsat {
            invoiceParams.amountMsat(amount)
        }
        
        invoiceParams.description(description.asLdkStr())
        invoiceParams.expiryTime(expirySecs)
        
        do {
            let invoice = try invoiceParams.build()
            return .success(invoice)
        } catch {
            return .failure(error)
        }
    }
}

struct InvoiceView: View {
    let invoice = "${invoice.bolt11}"
    let amountSats = ${args.amountSats}
    @State private var isCopied = false
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Lightning Invoice")
                .font(.title)
            
            // QR Code
            Image(uiImage: generateQRCode(from: invoice))
                .interpolation(.none)
                .resizable()
                .scaledToFit()
                .frame(width: 250, height: 250)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )
            
            // Amount
            VStack(spacing: 4) {
                Text("\\(amountSats)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                Text("sats")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            // Invoice details
            Text("${args.description || 'Lightning Payment'}")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            // Copy button with feedback
            Button(action: {
                UIPasteboard.general.string = invoice
                withAnimation(.easeInOut(duration: 0.2)) {
                    isCopied = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        isCopied = false
                    }
                }
            }) {
                Label(
                    isCopied ? "Copied!" : "Copy Invoice",
                    systemImage: isCopied ? "checkmark.circle.fill" : "doc.on.doc"
                )
                .frame(minWidth: 150)
            }
            .buttonStyle(.borderedProminent)
            .tint(isCopied ? .green : .accentColor)
            
            // Share button
            ShareLink(item: invoice) {
                Label("Share", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }
    
    func generateQRCode(from string: String) -> UIImage {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        
        if let outputImage = filter.outputImage {
            let transform = CGAffineTransform(scaleX: 10, y: 10)
            let scaledImage = outputImage.transformed(by: transform)
            
            if let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) {
                return UIImage(cgImage: cgImage)
            }
        }
        
        return UIImage(systemName: "xmark.circle") ?? UIImage()
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