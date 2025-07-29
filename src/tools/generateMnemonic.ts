import { Tool, ToolResult } from '../types/tool.js';
import { WalletService } from '../services/walletService.js';

const walletService = new WalletService();

export const generateMnemonicTool: Tool = {
  name: 'ldk_generate_mnemonic',
  description: 'Generate BIP39 mnemonic for wallet initialization',
  inputSchema: {
    type: 'object',
    properties: {
      strength: {
        type: 'number',
        enum: [128, 256],
        description: 'Mnemonic strength (128 = 12 words, 256 = 24 words)',
        default: 256
      }
    }
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const mnemonic = walletService.generateMnemonic(args.strength || 256);
      const seed = walletService.mnemonicToSeed(mnemonic);
      const wordCount = mnemonic.split(' ').length;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            mnemonic,
            wordCount,
            seedHex: seed.toString('hex'),
            swiftExample: `
// Swift code for secure mnemonic generation in your iOS app
import SwiftUI
import CryptoKit
import LightningDevKit

class MnemonicGenerator {
    enum MnemonicLength: Int {
        case words12 = 128
        case words24 = 256
        
        var wordCount: Int {
            switch self {
            case .words12: return 12
            case .words24: return 24
            }
        }
    }
    
    static func generateMnemonic(length: MnemonicLength = .words24) throws -> [String] {
        // Generate entropy
        let entropyBytes = length.rawValue / 8
        var entropy = Data(count: entropyBytes)
        let result = entropy.withUnsafeMutableBytes { bytes in
            SecRandomCopyBytes(kSecRandomDefault, entropyBytes, bytes.baseAddress!)
        }
        
        guard result == errSecSuccess else {
            throw WalletError.entropyGenerationFailed
        }
        
        // Convert to mnemonic
        let mnemonic = Mnemonic.toMnemonic(entropy: [UInt8](entropy))
        guard let words = mnemonic else {
            throw WalletError.mnemonicGenerationFailed
        }
        
        return words.components(separatedBy: " ")
    }
    
    static func mnemonicToSeed(words: [String], passphrase: String = "") -> Data {
        let mnemonic = words.joined(separator: " ")
        let seed = Mnemonic.toSeed(phrase: mnemonic, password: passphrase)
        return Data(seed)
    }
}

// SwiftUI view for secure mnemonic display
struct MnemonicSetupView: View {
    @State private var mnemonicWords: [String] = []
    @State private var currentStep: SetupStep = .generate
    @State private var verificationWords: Set<Int> = []
    @State private var verificationInput: [Int: String] = [:]
    @State private var showError = false
    
    enum SetupStep {
        case generate
        case display
        case verify
        case complete
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Progress indicator
            ProgressBar(currentStep: currentStep)
                .padding()
            
            // Content
            Group {
                switch currentStep {
                case .generate:
                    GenerateView(onGenerate: generateMnemonic)
                    
                case .display:
                    DisplayView(words: mnemonicWords, onContinue: {
                        setupVerification()
                        currentStep = .verify
                    })
                    
                case .verify:
                    VerifyView(
                        words: mnemonicWords,
                        verificationIndices: Array(verificationWords),
                        verificationInput: $verificationInput,
                        onVerify: verifyMnemonic
                    )
                    
                case .complete:
                    CompleteView()
                }
            }
            .padding()
            
            Spacer()
        }
        .navigationTitle("Wallet Setup")
        .navigationBarBackButtonHidden(currentStep != .generate)
        .alert("Verification Failed", isPresented: $showError) {
            Button("Try Again") { }
        } message: {
            Text("Please check the words and try again.")
        }
    }
    
    func generateMnemonic() {
        do {
            mnemonicWords = try MnemonicGenerator.generateMnemonic()
            currentStep = .display
        } catch {
            // Handle error
        }
    }
    
    func setupVerification() {
        // Select random words to verify
        verificationWords = Set((0..<mnemonicWords.count).shuffled().prefix(3))
        verificationInput = [:]
    }
    
    func verifyMnemonic() {
        var allCorrect = true
        
        for index in verificationWords {
            let expectedWord = mnemonicWords[index]
            let inputWord = verificationInput[index]?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
            
            if inputWord != expectedWord {
                allCorrect = false
                break
            }
        }
        
        if allCorrect {
            saveMnemonicSecurely()
            currentStep = .complete
        } else {
            showError = true
        }
    }
    
    func saveMnemonicSecurely() {
        // Save to keychain with biometric protection
        Task {
            do {
                let seed = MnemonicGenerator.mnemonicToSeed(words: mnemonicWords)
                _ = try await BiometricLightningAuth.protectSeedWithBiometrics(seed: seed)
                
                // Clear mnemonic from memory
                mnemonicWords = []
                verificationInput = [:]
            } catch {
                // Handle error
            }
        }
    }
}

struct DisplayView: View {
    let words: [String]
    let onContinue: () -> Void
    @State private var hasScreenshot = false
    
    var body: some View {
        VStack(spacing: 24) {
            // Warning
            VStack(spacing: 12) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.largeTitle)
                    .foregroundColor(.orange)
                
                Text("Write Down Your Recovery Phrase")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Text("Write these words on paper. Never share them with anyone.")
                    .font(.callout)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Mnemonic grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(Array(words.enumerated()), id: \\.offset) { index, word in
                    WordCell(number: index + 1, word: word)
                }
            }
            .padding()
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(12)
            
            // Screenshot warning
            Toggle("I have written down all words", isOn: $hasScreenshot)
                .toggleStyle(CheckboxToggleStyle())
            
            Button(action: onContinue) {
                Text("Continue to Verification")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!hasScreenshot)
        }
    }
}

struct WordCell: View {
    let number: Int
    let word: String
    
    var body: some View {
        HStack(spacing: 8) {
            Text("\\(number).")
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 20, alignment: .trailing)
            
            Text(word)
                .font(.system(.body, design: .monospaced))
                .fontWeight(.medium)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.tertiarySystemBackground))
        .cornerRadius(8)
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