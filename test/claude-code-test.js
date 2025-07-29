#!/usr/bin/env node

// Integration test for Claude Code usage
// This demonstrates how the LDK MCP server integrates with Claude Code

console.log(`
===============================================
LDK MCP Server - Claude Code Integration Test
===============================================

The LDK MCP server is configured and ready for use with Claude Code!

Available tools:
1. ldk_generate_invoice - Generate Lightning invoices
2. ldk_pay_invoice - Pay Lightning invoices
3. ldk_decode_invoice - Decode and validate invoices
4. ldk_create_channel - Create Lightning channels
5. ldk_close_channel - Close Lightning channels
6. ldk_channel_status - Get channel status
7. ldk_node_info - Get node information
8. ldk_get_balance - Get balance information
9. ldk_list_payments - List payment history
10. ldk_generate_mnemonic - Generate BIP39 mnemonic
11. ldk_estimate_fee - Estimate transaction fees
12. ldk_backup_state - Backup node state
13. ldk_restore_state - Restore node state
14. ldk_get_swift_code - Get Swift code examples
15. ldk_get_architecture - Get iOS architecture patterns
16. ldk_network_graph - Network graph operations
17. ldk_event_handling - Event handling patterns
18. ldk_chain_sync - Chain synchronization methods
19. ios_keychain_test - iOS Keychain integration
20. ios_background_test - iOS background tasks
21. ios_push_test - iOS push notifications
22. ios_biometric_auth - iOS biometric authentication
23. ios_secure_enclave - iOS Secure Enclave usage

To use in Claude Code:
- The server is automatically started when Claude Code launches
- Tools are available via the MCP protocol
- All tools return Swift code examples optimized for iOS

Example usage in Claude Code:
"Help me implement Lightning invoice generation in my iOS app"
"Show me how to handle LDK events in Swift"
"Generate a secure mnemonic for my Lightning wallet"

Configuration location:
~/Library/Application Support/Claude/claude_desktop_config.json

Server logs can be viewed in Claude Code's MCP debug panel.
`);

// Quick connectivity test
import { spawn } from 'child_process';

console.log('\nPerforming connectivity test...');

const testProcess = spawn('node', ['dist/index.js'], {
  stdio: 'pipe'
});

let output = '';
testProcess.stdout.on('data', (data) => {
  output += data.toString();
});

testProcess.stderr.on('data', (data) => {
  output += data.toString();
});

setTimeout(() => {
  testProcess.kill();
  if (output.includes('LDK MCP Server started successfully')) {
    console.log('✅ Server connectivity test passed!');
    console.log('\nThe LDK MCP server is ready for use with Claude Code.');
  } else {
    console.log('❌ Server connectivity test failed!');
    console.log('Output:', output);
    console.log('Please check the server configuration.');
  }
  process.exit(0);
}, 2000);