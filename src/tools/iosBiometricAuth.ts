import { Tool, ToolResult } from '../types/tool.js';
import { IOSService } from '../services/iosService.js';

const iosService = new IOSService();

export const biometricAuthTool: Tool = {
  name: 'ios_biometric_auth',
  description: 'Integrate Touch/Face ID with Lightning operations',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['send_payment', 'open_channel', 'close_channel', 'export_seed'],
        description: 'Operation requiring biometric auth',
        default: 'send_payment'
      },
      requireAuth: {
        type: 'boolean',
        description: 'Whether to require biometric auth',
        default: true
      }
    }
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const result = await iosService.testBiometricAuth();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            message: result.message,
            swiftExample: result.swiftCode,
            operation: args.operation,
            requireAuth: args.requireAuth,
            securityGuidelines: [
              'Always require biometric auth for seed access',
              'Use biometrics for high-value payments',
              'Provide passcode fallback option',
              'Clear biometric data on app reinstall',
              'Implement anti-tampering measures',
              'Use LAContext evaluation for each operation'
            ],
            uiIntegration: `
// SwiftUI biometric-protected payment view
import SwiftUI
import LocalAuthentication

struct SecurePaymentView: View {
    @State private var isAuthenticated = false
    @State private var showingError = false
    @State private var errorMessage = ""
    
    let invoice: String
    let amountSats: Int
    
    var body: some View {
        VStack(spacing: 30) {
            // Payment details
            VStack(spacing: 16) {
                Image(systemName: "bolt.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.orange)
                
                Text("Confirm Payment")
                    .font(.title)
                    .fontWeight(.semibold)
                
                Text("\\(amountSats) sats")
                    .font(.title2)
                    .foregroundColor(.secondary)
            }
            
            // Biometric prompt
            if !isAuthenticated {
                VStack(spacing: 20) {
                    Image(systemName: biometricIcon)
                        .font(.system(size: 50))
                        .foregroundColor(.blue)
                    
                    Text("Authenticate to send payment")
                        .font(.headline)
                    
                    Button(action: authenticate) {
                        Label("Authenticate", systemImage: biometricIcon)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
            } else {
                // Payment in progress
                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.5)
                    
                    Text("Sending payment...")
                        .font(.headline)
                }
                .onAppear {
                    sendPayment()
                }
            }
        }
        .padding()
        .alert("Authentication Failed", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
    }
    
    var biometricIcon: String {
        let biometricType = BiometricLightningAuth.getBiometricType()
        switch biometricType {
        case .faceID:
            return "faceid"
        case .touchID:
            return "touchid"
        default:
            return "lock"
        }
    }
    
    func authenticate() {
        Task {
            let authenticated = await BiometricLightningAuth.authenticateForPayment(
                amount: UInt64(amountSats)
            )
            
            if authenticated {
                withAnimation {
                    isAuthenticated = true
                }
            } else {
                errorMessage = "Authentication failed. Please try again."
                showingError = true
            }
        }
    }
    
    func sendPayment() {
        Task {
            do {
                // Send payment via LDK
                try await LDKManager.shared.payInvoice(
                    invoice: invoice,
                    maxFeeSats: UInt64(amountSats) / 100 // 1% max fee
                )
                
                // Navigate to success view
                await MainActor.run {
                    // Show success
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Payment failed: \\(error.localizedDescription)"
                    showingError = true
                }
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