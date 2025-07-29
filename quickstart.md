# LDK MCP Server Quick Start

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Build the project:**
```bash
npm run build
```

3. **Configure Claude Desktop:**

Add this to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ldk-mcp": {
      "command": "node",
      "args": ["/Users/steven/Programming/mcp/ldk-mcp/dist/index.js"]
    }
  }
}
```

4. **Restart Claude Desktop**

## Testing the Server

In a new Claude conversation, try:

```
Generate a Lightning invoice for 10,000 sats
```

The LDK MCP server should provide:
- A valid Lightning invoice
- Swift code for displaying it in iOS
- QR code generation example

## Example Usage

### Basic Payment Flow
```
1. Create a Lightning invoice for receiving payment
2. Show me how to display this in SwiftUI with a QR code
3. Implement payment handling with biometric authentication
```

### Channel Management
```
1. Show me the architecture for Lightning channel management
2. Create a test channel with 1M sats capacity
3. Run a channel lifecycle test scenario
```

### iOS Integration
```
1. Test iOS Keychain integration for seed storage
2. Implement background Lightning sync
3. Add push notifications for incoming payments
```

## Troubleshooting

If the MCP server doesn't appear:
1. Check the path in your config is correct
2. Ensure Claude Desktop was restarted
3. Check logs at: `~/Library/Logs/Claude/`

## Next Steps

- Explore all available tools with `ldk_*` prefix
- Check out test scenarios for complete examples
- Use architecture guides for production patterns