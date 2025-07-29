# LDK MCP Server

Real-time Lightning Development Kit (LDK) expertise for accelerating iOS Lightning wallet development. This MCP server provides instant access to LDK APIs, Swift patterns with proper Bindings namespace usage, comprehensive event handling, NetworkGraph with RapidGossipSync, and multiple chain synchronization methods.

## 🚀 Features

### Lightning Development Tools
- **Invoice Generation** - Create real Lightning invoices with proper encoding
- **Payment Processing** - Test payment flows with simulated Lightning operations  
- **Channel Management** - Open, monitor, and close Lightning channels
- **Balance Tracking** - Monitor channel liquidity and wallet balances
- **Fee Estimation** - Calculate routing fees and on-chain costs

### iOS Development Integration
- **Keychain Security** - iOS Keychain patterns for secure key storage
- **Background Processing** - Lightning sync in iOS background tasks
- **Push Notifications** - Payment notification implementation
- **Biometric Auth** - Touch/Face ID integration for Lightning operations

### Architecture & Best Practices
- **Swift Code Examples** - Production-ready LDK Swift implementations
- **Project Structure** - Recommended iOS Lightning wallet architecture
- **Security Patterns** - Best practices for key management and crypto
- **Testing Scenarios** - Complete test scenarios for Lightning operations

## 📦 Installation

1. **Clone the repository:**
```bash
git clone https://github.com/StevenGeller/ldk-mcp.git
cd ldk-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

4. **Configure MCP Client:**

Add to your MCP client configuration file:

Configuration varies by MCP client. For example configurations, see the documentation.

```json
{
  "mcpServers": {
    "ldk-mcp": {
      "command": "node",
      "args": ["/path/to/ldk-mcp/dist/index.js"],
      "env": {
        "NETWORK": "testnet"
      }
    }
  }
}
```

5. **Restart Claude Desktop**

## 🛠️ Available Tools

### Lightning Operations

#### `ldk_generate_invoice`
Generate Lightning invoices for testing payment flows.
```typescript
await ldk_generate_invoice({
  amountSats: 10000,
  description: "Test payment",
  expirySeconds: 3600
})
```

#### `ldk_pay_invoice`
Simulate Lightning payments for development.
```typescript
await ldk_pay_invoice({
  invoice: "lnbc10000n1...",
  maxFeeSats: 50
})
```

#### `ldk_create_channel`
Open Lightning channels with configuration options.
```typescript
await ldk_create_channel({
  remotePubkey: "02abc...",
  capacitySats: 1000000,
  pushSats: 100000,
  isPublic: false
})
```

#### `ldk_channel_status`
Monitor channel states and balances.
```typescript
await ldk_channel_status({
  includeOffline: true
})
```

### iOS Integration Tools

#### `ios_keychain_test`
Test iOS Keychain integration for secure storage.
```typescript
await ios_keychain_test({
  keyType: "seed",
  testValue: "test_data"
})
```

#### `ios_background_test`
Implement Lightning background sync.
```typescript
await ios_background_test({
  taskType: "sync"
})
```

#### `ios_biometric_auth`
Integrate Touch/Face ID with Lightning operations.
```typescript
await ios_biometric_auth({
  operation: "send_payment",
  requireAuth: true
})
```

### Development Helpers

#### `ldk_get_swift_code`
Get production-ready Swift code examples.
```typescript
await ldk_get_swift_code({
  operation: "channel_manager_setup"
})
```

#### `ldk_get_architecture`
Access architectural patterns and best practices.
```typescript
await ldk_get_architecture({
  topic: "security_architecture"
})
```

#### `ldk_test_scenario`
Run complete Lightning development scenarios.
```typescript
await ldk_test_scenario({
  scenario: "multi_hop_payment"
})
```

## 💡 Usage Examples

### Quick Start: Building a Lightning Invoice Feature

```swift
// 1. Use MCP to generate a test invoice
const invoice = await ldk_generate_invoice({
  amountSats: 5000,
  description: "Coffee payment"
})

// 2. Get the Swift implementation
const swiftCode = await ldk_get_swift_code({
  operation: "payment_handling"
})

// 3. The MCP server provides complete SwiftUI code with:
// - QR code generation
// - Invoice display
// - Payment handling
// - Error management
```

### Advanced: Implementing Channel Management

```swift
// 1. Get architecture guidance
const architecture = await ldk_get_architecture({
  topic: "channel_management"
})

// 2. Create test channel
const channel = await ldk_create_channel({
  remotePubkey: "02...",
  capacitySats: 500000
})

// 3. Run test scenarios
const test = await ldk_test_scenario({
  scenario: "channel_lifecycle"
})
```

## 🏗️ Development Workflow

### 1. Initial Setup
```bash
# Request initial setup
"Help me set up a new iOS Lightning wallet project"

# MCP provides:
# - Complete project structure
# - LDK initialization code  
# - Security setup
# - Basic UI components
```

### 2. Feature Implementation
```bash
# Request specific features
"Implement Lightning payment sending with biometric authentication"

# MCP provides:
# - Swift implementation
# - Security best practices
# - UI/UX patterns
# - Test scenarios
```

### 3. Testing & Validation
```bash
# Test your implementation
"Run a multi-hop payment test scenario"

# MCP provides:
# - Test setup code
# - Mock Lightning network
# - Validation steps
# - Debugging guidance
```

## 🔧 Configuration

### Environment Variables
- `NETWORK` - Bitcoin network: `mainnet`, `testnet`, or `regtest` (default: `testnet`)
- `LOG_LEVEL` - Logging verbosity: `debug`, `info`, `warn`, `error` (default: `info`)

### Custom Configuration
Create a `.env` file in the project root:
```env
NETWORK=testnet
LOG_LEVEL=debug
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run specific test scenarios:
```bash
npm test -- --testNamePattern="Lightning payment"
```

## 📚 Documentation

### Swift/iOS Integration
- [LDK Swift Bindings Documentation](https://lightningdevkit.org/docs)
- [iOS Background Processing Guide](docs/ios-background.md)
- [Security Best Practices](docs/security.md)

### Lightning Development
- [Channel Management](docs/channels.md)
- [Payment Routing](docs/routing.md)
- [Fee Estimation](docs/fees.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Lightning Dev Kit](https://lightningdevkit.org/) for the amazing Lightning implementation
- [Bitcoin Dev Kit](https://bitcoindevkit.org/) for on-chain wallet functionality
- The Lightning Network community for protocol development

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/StevenGeller/ldk-mcp/issues)
- **Discussions:** [GitHub Discussions](https://github.com/StevenGeller/ldk-mcp/discussions)
- **Lightning Dev Chat:** [LDK Discord](https://discord.gg/lightningdevkit)

---

Built with ⚡ for the Lightning Network community