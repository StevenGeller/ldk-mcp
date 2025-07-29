import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const payInvoiceTool: Tool = {
  name: 'ldk_pay_invoice',
  description: 'Test payment flows by paying a Lightning invoice',
  inputSchema: {
    type: 'object',
    properties: {
      invoice: {
        type: 'string',
        description: 'BOLT11 Lightning invoice to pay'
      },
      maxFeeSats: {
        type: 'number',
        description: 'Maximum fee in satoshis willing to pay',
        default: 10
      }
    },
    required: ['invoice']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const payment = await lightningService.payInvoice(args.invoice);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            payment: {
              paymentHash: payment.paymentHash,
              paymentPreimage: payment.paymentPreimage,
              amountSats: Math.floor(payment.amountMsat / 1000),
              feeSats: Math.floor((payment.feeMsat || 0) / 1000),
              status: payment.status,
              timestamp: payment.timestamp
            },
            swiftExample: `
// Swift code to handle payment in your iOS app
import LightningDevKit

func payInvoice(invoice: String, maxFeeSats: UInt64) async throws -> PaymentResult {
    let parsedInvoice = Bolt11Invoice.fromStr(s: invoice)
    
    guard let invoiceVal = parsedInvoice.getValue() else {
        throw PaymentError.invalidInvoice
    }
    
    let invoicePaymentResult = Bindings.paymentParametersFromInvoice(invoice: invoiceVal)
    guard invoicePaymentResult.isOk() else {
        throw PaymentError.invalidPaymentParams
    }
    
    let (paymentHash, recipientOnion, routeParams) = invoicePaymentResult.getValue()!
    let paymentId = invoiceVal.paymentHash()!
    
    // Set max fee
    routeParams.setMaxTotalFeeMsat(val: maxFeeSats * 1000)
    
    let res = channelManager.sendPayment(
        paymentHash: paymentHash,
        recipientOnion: recipientOnion,
        paymentId: paymentId,
        routeParams: routeParams,
        retryStrategy: .initWithTimeout(a: 15)
    )
    
    if res.isOk() {
        // Payment initiated successfully
        return PaymentResult(
            paymentHash: paymentHash.toHex(),
            status: .pending
        )
    } else {
        throw PaymentError.sendFailed(res.getError()!)
    }
}

// Handle payment events
func handlePaymentEvent(event: Event) {
    if let paymentSent = event.getValueAsPaymentSent() {
        let paymentHash = paymentSent.getPaymentHash().toHex()
        let feePaidMsat = paymentSent.getFeePaidMsat()?.getValue() ?? 0
        
        print("Payment sent successfully!")
        print("Payment hash: \\(paymentHash)")
        print("Fee paid: \\(feePaidMsat / 1000) sats")
        
        // Update UI
        DispatchQueue.main.async {
            self.updatePaymentStatus(hash: paymentHash, status: .succeeded)
        }
    } else if let paymentFailed = event.getValueAsPaymentFailed() {
        let paymentHash = paymentFailed.getPaymentHash().toHex()
        let reason = paymentFailed.getReason()
        
        print("Payment failed: \\(reason?.description ?? "Unknown")")
        
        // Update UI
        DispatchQueue.main.async {
            self.updatePaymentStatus(hash: paymentHash, status: .failed)
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