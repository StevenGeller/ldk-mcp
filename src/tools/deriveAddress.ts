import { Tool, ToolResult } from '../types/tool.js';
import { WalletService } from '../services/walletService.js';

const walletService = new WalletService();

export const deriveAddressTool: Tool = {
  name: 'ldk_derive_address',
  description: 'Derive Bitcoin addresses from seed using BIP84',
  inputSchema: {
    type: 'object',
    properties: {
      mnemonic: {
        type: 'string',
        description: 'BIP39 mnemonic phrase'
      },
      accountIndex: {
        type: 'number',
        description: 'Account index (default: 0)',
        default: 0
      },
      addressIndex: {
        type: 'number', 
        description: 'Address index (default: 0)',
        default: 0
      },
      isChange: {
        type: 'boolean',
        description: 'Is change address (default: false)',
        default: false
      },
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet', 'regtest'],
        description: 'Bitcoin network',
        default: 'testnet'
      }
    },
    required: ['mnemonic']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const seed = walletService.mnemonicToSeed(args.mnemonic);
      const derivation = walletService.deriveAddress(
        seed,
        args.accountIndex || 0,
        args.isChange || false,
        args.addressIndex || 0
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            address: derivation.address,
            publicKey: derivation.publicKey,
            derivationPath: derivation.derivationPath,
            network: args.network || 'testnet',
            swiftExample: `
// Swift code for address derivation in your iOS app
import BitcoinDevKit
import LightningDevKit

class AddressManager {
    private let wallet: BitcoinDevKit.Wallet
    private let network: BitcoinDevKit.Network
    
    init(mnemonic: [String], network: BitcoinDevKit.Network = .testnet) throws {
        self.network = network
        
        // Create descriptors
        let mnemonicStr = mnemonic.joined(separator: " ")
        let secretKey = DescriptorSecretKey(
            network: network,
            mnemonic: Mnemonic(mnemonic: mnemonicStr),
            password: nil
        )
        
        // BIP84 descriptors (native segwit)
        let descriptor = Descriptor(
            descriptor: "wpkh(\\(secretKey.asString())/84'/\\(network == .bitcoin ? "0" : "1")'/0'/0/*)",
            network: network
        )
        
        let changeDescriptor = Descriptor(
            descriptor: "wpkh(\\(secretKey.asString())/84'/\\(network == .bitcoin ? "0" : "1")'/0'/1/*)",
            network: network
        )
        
        // Initialize wallet
        let walletDB = DatabaseConfig.memory
        wallet = try BitcoinDevKit.Wallet(
            descriptor: descriptor,
            changeDescriptor: changeDescriptor,
            network: network,
            databaseConfig: walletDB
        )
    }
    
    func getNewAddress() throws -> AddressInfo {
        let addressInfo = try wallet.getAddress(addressIndex: .new)
        
        return AddressInfo(
            address: addressInfo.address.asString(),
            index: addressInfo.index,
            keychain: addressInfo.keychain,
            isChange: addressInfo.keychain == .external ? false : true
        )
    }
    
    func getAddress(at index: UInt32, isChange: Bool = false) throws -> String {
        let keychain: KeychainKind = isChange ? .internal : .external
        let addressInfo = try wallet.getAddress(addressIndex: .peek(index: index))
        
        return addressInfo.address.asString()
    }
    
    func validateAddress(_ address: String) -> Bool {
        do {
            _ = try Address(address: address, network: network)
            return true
        } catch {
            return false
        }
    }
}

struct AddressInfo {
    let address: String
    let index: UInt32
    let keychain: KeychainKind
    let isChange: Bool
}

// SwiftUI view for address management
struct AddressManagerView: View {
    @State private var addresses: [AddressInfo] = []
    @State private var showingNewAddress = false
    @State private var selectedAddress: AddressInfo?
    @State private var copiedAddress: String?
    
    var body: some View {
        List {
            Section {
                Button(action: generateNewAddress) {
                    Label("Generate New Address", systemImage: "plus.circle")
                        .foregroundColor(.accentColor)
                }
            }
            
            Section("Receive Addresses") {
                ForEach(addresses.filter { !$0.isChange }, id: \\.address) { address in
                    AddressRow(
                        address: address,
                        isCopied: copiedAddress == address.address,
                        onCopy: { copyAddress(address.address) }
                    )
                }
            }
        }
        .navigationTitle("Addresses")
        .task {
            loadAddresses()
        }
        .sheet(isPresented: $showingNewAddress) {
            if let address = selectedAddress {
                NewAddressView(addressInfo: address) {
                    showingNewAddress = false
                    selectedAddress = nil
                    loadAddresses()
                }
            }
        }
    }
    
    func generateNewAddress() {
        do {
            let addressManager = try AddressManager(
                mnemonic: LDKManager.shared.getMnemonic()
            )
            let newAddress = try addressManager.getNewAddress()
            selectedAddress = newAddress
            showingNewAddress = true
        } catch {
            // Handle error
        }
    }
    
    func loadAddresses() {
        // Load existing addresses from wallet
        do {
            let addressManager = try AddressManager(
                mnemonic: LDKManager.shared.getMnemonic()
            )
            
            var loadedAddresses: [AddressInfo] = []
            
            // Load up to 20 addresses
            for i in 0..<20 {
                let address = try addressManager.getAddress(at: UInt32(i))
                loadedAddresses.append(AddressInfo(
                    address: address,
                    index: UInt32(i),
                    keychain: .external,
                    isChange: false
                ))
            }
            
            addresses = loadedAddresses
        } catch {
            // Handle error
        }
    }
    
    func copyAddress(_ address: String) {
        UIPasteboard.general.string = address
        copiedAddress = address
        
        // Reset after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if copiedAddress == address {
                copiedAddress = nil
            }
        }
    }
}

struct AddressRow: View {
    let address: AddressInfo
    let isCopied: Bool
    let onCopy: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Index \\(address.index)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if isCopied {
                    Label("Copied", systemImage: "checkmark")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
            
            HStack {
                Text(address.address)
                    .font(.system(.caption, design: .monospaced))
                    .lineLimit(1)
                    .truncationMode(.middle)
                
                Button(action: onCopy) {
                    Image(systemName: "doc.on.doc")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
            }
        }
        .padding(.vertical, 4)
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