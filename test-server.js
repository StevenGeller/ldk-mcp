#!/usr/bin/env node

import { spawn } from 'child_process';
import readline from 'readline';

console.log('Testing LDK MCP Server...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for interactive communication
const rl = readline.createInterface({
  input: server.stdout,
  output: process.stdout
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('Server output:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server log:', data.toString());
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Send test messages
async function runTests() {
  console.log('Server started. Sending test requests...\n');
  
  // Test 1: List tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  
  console.log('Test 1: Listing available tools');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Give server time to respond
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Generate invoice
  const generateInvoiceRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'ldk_generate_invoice',
      arguments: {
        amountSats: 10000,
        description: 'Test invoice',
        expirySeconds: 3600
      }
    }
  };
  
  console.log('\nTest 2: Generating Lightning invoice');
  server.stdin.write(JSON.stringify(generateInvoiceRequest) + '\n');
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\nTest complete. Press Ctrl+C to exit.');
}

// Run tests after server starts
setTimeout(runTests, 500);

// Handle exit
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.kill();
  process.exit(0);
});