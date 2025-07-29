# Testing LDK MCP Server

## ✅ Setup Complete!

The LDK MCP server has been successfully:
1. Built and compiled
2. Added to your Claude Desktop configuration
3. Configured with testnet by default

## 🔄 Next Step: Restart Claude Desktop

**You need to restart Claude Desktop for the changes to take effect.**

1. Quit Claude Desktop completely (Cmd+Q)
2. Launch Claude Desktop again
3. Start a new conversation

## 🧪 Test Commands

Once restarted, try these commands in a new Claude conversation:

### Test 1: Generate Invoice
```
Generate a Lightning invoice for 10,000 sats with description "Coffee payment"
```

### Test 2: Get Swift Code
```
Show me Swift code for setting up an LDK channel manager
```

### Test 3: iOS Integration
```
Test iOS Keychain integration for Lightning seed storage
```

### Test 4: Architecture Guide
```
Show me the security architecture for an iOS Lightning wallet
```

### Test 5: Complete Scenario
```
Run a basic Lightning payment test scenario
```

## 🔍 Verify MCP is Active

In the new conversation, you should see the LDK MCP tools available. They all start with:
- `ldk_*` - Lightning operations
- `ios_*` - iOS integration tools

## 📝 Example Full Workflow

```
Me: I want to build an iOS Lightning wallet with payment receiving functionality

Claude: I'll help you build an iOS Lightning wallet with payment receiving. Let me start by generating a test invoice and providing the complete Swift implementation.

[Uses ldk_generate_invoice tool]
[Uses ldk_get_swift_code tool]
[Provides complete SwiftUI implementation]
```

## 🐛 Troubleshooting

If the MCP tools don't appear:

1. Check the config file is saved correctly:
   ```bash
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. Check for errors in Claude logs:
   ```bash
   tail -f ~/Library/Logs/Claude/*.log
   ```

3. Verify the server can start manually:
   ```bash
   cd /Users/steven/Programming/mcp/ldk-mcp
   node dist/index.js
   ```

## 🎉 Ready to Use!

After restarting Claude Desktop, you'll have instant access to:
- Lightning invoice generation
- Payment processing simulation
- Channel management tools
- iOS-specific security patterns
- Complete Swift/SwiftUI code examples
- Architecture guidance
- Test scenarios

The MCP server will accelerate your iOS Lightning wallet development from days to hours!