#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Import all tools
import { generateInvoiceTool } from './tools/generateInvoice.js';
import { payInvoiceTool } from './tools/payInvoice.js';
import { getChannelStatusTool } from './tools/getChannelStatus.js';
import { getNodeInfoTool } from './tools/getNodeInfo.js';
import { backupStateTool } from './tools/backupState.js';
import { keychainTestTool } from './tools/iosKeychainTest.js';
import { backgroundTestTool } from './tools/iosBackgroundTest.js';
import { pushNotificationTool } from './tools/iosPushNotification.js';
import { biometricAuthTool } from './tools/iosBiometricAuth.js';
import { createChannelTool } from './tools/createChannel.js';
import { closeChannelTool } from './tools/closeChannel.js';
import { getBalanceTool } from './tools/getBalance.js';
import { decodeInvoiceTool } from './tools/decodeInvoice.js';
import { listPaymentsTool } from './tools/listPayments.js';
import { estimateFeeTool } from './tools/estimateFee.js';
import { generateMnemonicTool } from './tools/generateMnemonic.js';
import { deriveAddressTool } from './tools/deriveAddress.js';
import { getSwiftCodeTool } from './tools/getSwiftCode.js';
import { getArchitectureTool } from './tools/getArchitecture.js';
import { testScenarioTool } from './tools/testScenario.js';
import { networkGraphTool } from './tools/networkGraph.js';
import { eventHandlingTool } from './tools/eventHandling.js';
import { chainSyncTool } from './tools/chainSync.js';

// Aggregate all tools
const tools = [
  generateInvoiceTool,
  payInvoiceTool,
  getChannelStatusTool,
  getNodeInfoTool,
  backupStateTool,
  keychainTestTool,
  backgroundTestTool,
  pushNotificationTool,
  biometricAuthTool,
  createChannelTool,
  closeChannelTool,
  getBalanceTool,
  decodeInvoiceTool,
  listPaymentsTool,
  estimateFeeTool,
  generateMnemonicTool,
  deriveAddressTool,
  getSwiftCodeTool,
  getArchitectureTool,
  testScenarioTool,
  networkGraphTool,
  eventHandlingTool,
  chainSyncTool,
];

// Create server instance
const server = new Server(
  {
    name: 'ldk-mcp',
    version: '1.0.0',
    description: 'MCP server for Lightning Development Kit (LDK) - Real-time Lightning expertise for iOS wallet development',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Tool ${name} not found`
    );
  }

  try {
    const result = await tool.execute(args || {});
    return {
      content: result.content
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error.message}`
      );
    }
    throw error;
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('LDK MCP Server started successfully');
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});