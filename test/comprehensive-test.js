#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

class MCPTester {
  constructor() {
    this.server = null;
    this.requestId = 1;
    this.responses = new Map();
    this.testResults = [];
  }

  async start() {
    console.log('🚀 Starting LDK MCP Server Tests...\n');
    
    // Start the MCP server
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle server output
    let buffer = '';
    this.server.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            if (response.id && this.responses.has(response.id)) {
              this.responses.get(response.id).resolve(response);
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
      }
    });

    this.server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    this.server.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  async sendRequest(method, params = {}) {
    const id = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.responses.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.responses.has(id)) {
          this.responses.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  async testListTools() {
    console.log('📋 Test 1: Listing available tools...');
    try {
      const response = await this.sendRequest('tools/list');
      
      if (!response.result || !response.result.tools) {
        throw new Error('Invalid response format');
      }
      
      const tools = response.result.tools;
      console.log(`✅ Found ${tools.length} tools`);
      
      // Verify expected tools exist
      const expectedTools = [
        'ldk_generate_invoice',
        'ldk_pay_invoice',
        'ldk_create_channel',
        'ldk_channel_status',
        'ldk_network_graph',
        'ldk_event_handling',
        'ldk_chain_sync',
        'ios_keychain_test',
        'ios_background_test',
        'ios_biometric_auth'
      ];
      
      for (const toolName of expectedTools) {
        const tool = tools.find(t => t.name === toolName);
        if (!tool) {
          throw new Error(`Missing expected tool: ${toolName}`);
        }
        if (!tool.inputSchema) {
          throw new Error(`Tool ${toolName} missing input schema`);
        }
      }
      
      this.testResults.push({ test: 'List Tools', status: 'PASS' });
      return tools;
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      this.testResults.push({ test: 'List Tools', status: 'FAIL', error: error.message });
      throw error;
    }
  }

  async testTool(toolName, args, expectedFields = []) {
    console.log(`\n🔧 Testing tool: ${toolName}`);
    try {
      const response = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      if (!response.result || !response.result.content) {
        throw new Error('Invalid tool response format');
      }

      const content = response.result.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Invalid content format');
      }

      const result = JSON.parse(content.text);
      
      // Check for success
      if (result.success === false) {
        throw new Error(`Tool returned error: ${result.error}`);
      }

      // Verify expected fields
      for (const field of expectedFields) {
        if (!(field in result)) {
          throw new Error(`Missing expected field: ${field}`);
        }
      }

      console.log(`✅ ${toolName} passed`);
      this.testResults.push({ test: toolName, status: 'PASS' });
      return result;
    } catch (error) {
      console.error(`❌ ${toolName} failed: ${error.message}`);
      this.testResults.push({ test: toolName, status: 'FAIL', error: error.message });
      throw error;
    }
  }

  async runAllTests() {
    try {
      // Test 1: List tools
      const tools = await this.testListTools();

      // Test 2: Generate Invoice
      await this.testTool('ldk_generate_invoice', {
        amountSats: 10000,
        description: 'Test invoice',
        expirySeconds: 3600
      }, ['success', 'invoice', 'paymentHash', 'swiftExample']);

      // Test 3: Decode Invoice
      const invoiceResult = await this.testTool('ldk_generate_invoice', {
        amountSats: 5000,
        description: 'Decode test'
      }, ['invoice']);
      
      await this.testTool('ldk_decode_invoice', {
        invoice: invoiceResult.invoice
      }, ['success', 'paymentHash', 'amountMsat', 'description']);

      // Test 4: Channel Status
      await this.testTool('ldk_channel_status', {
        includeOffline: true
      }, ['success', 'channels', 'swiftExample']);

      // Test 5: Node Info
      await this.testTool('ldk_node_info', {}, 
        ['success', 'nodeInfo', 'swiftExample']);

      // Test 6: Balance
      await this.testTool('ldk_get_balance', {}, 
        ['success', 'balance', 'swiftExample']);

      // Test 7: Generate Mnemonic
      await this.testTool('ldk_generate_mnemonic', {
        wordCount: 12
      }, ['success', 'mnemonic', 'seed', 'swiftExample']);

      // Test 8: Swift Code Generation
      await this.testTool('ldk_get_swift_code', {
        operation: 'channel_manager_setup'
      }, ['success', 'operation', 'swiftCode']);

      // Test 9: Architecture Guide
      await this.testTool('ldk_get_architecture', {
        topic: 'security_architecture'
      }, ['success', 'topic', 'content']);

      // Test 10: Network Graph
      await this.testTool('ldk_network_graph', {
        operation: 'setup'
      }, ['success', 'operation', 'swiftCode']);

      // Test 11: Event Handling
      await this.testTool('ldk_event_handling', {
        eventType: 'payment_events'
      }, ['success', 'eventType', 'swiftCode']);

      // Test 12: Chain Sync
      await this.testTool('ldk_chain_sync', {
        syncMethod: 'electrum_sync'
      }, ['success', 'syncMethod', 'swiftCode']);

      // Test 13: iOS Keychain
      await this.testTool('ios_keychain_test', {
        keyType: 'seed',
        testValue: 'test_data_123'
      }, ['success', 'keyType', 'swiftExample']);

      // Test 14: iOS Background
      await this.testTool('ios_background_test', {
        taskType: 'sync'
      }, ['success', 'taskType', 'swiftExample']);

      // Test 15: iOS Biometric
      await this.testTool('ios_biometric_auth', {
        operation: 'send_payment',
        requireAuth: true
      }, ['success', 'operation', 'swiftExample']);

      // Test error handling
      console.log('\n🔍 Testing error handling...');
      try {
        await this.testTool('ldk_decode_invoice', {
          invoice: 'invalid_invoice'
        });
        throw new Error('Should have failed with invalid invoice');
      } catch (error) {
        if (error.message.includes('Failed to decode invoice')) {
          console.log('✅ Error handling works correctly');
          this.testResults.push({ test: 'Error Handling', status: 'PASS' });
        } else {
          throw error;
        }
      }

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
    }
  }

  async cleanup() {
    if (this.server) {
      this.server.kill();
    }
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    
    for (const result of this.testResults) {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
    
    console.log('\n------------------------');
    console.log(`Total: ${this.testResults.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    return failed === 0;
  }
}

// Run tests
async function main() {
  const tester = new MCPTester();
  
  try {
    await tester.start();
    await tester.runAllTests();
    const success = tester.printResults();
    
    if (!success) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

main();