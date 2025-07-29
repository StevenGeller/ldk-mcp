import { Tool, ToolResult } from '../types/tool.js';
import { IOSService } from '../services/iosService.js';

const iosService = new IOSService();

export const keychainTestTool: Tool = {
  name: 'ios_keychain_test',
  description: 'Validate private key storage patterns with iOS Keychain',
  inputSchema: {
    type: 'object',
    properties: {
      keyType: {
        type: 'string',
        enum: ['seed', 'privateKey', 'channelSecrets'],
        description: 'Type of key to test',
        default: 'seed'
      },
      testValue: {
        type: 'string',
        description: 'Test value to store (will be encrypted)'
      }
    },
    required: ['keyType']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const testValue = args.testValue || `test_${args.keyType}_${Date.now()}`;
      const result = await iosService.testKeychain(args.keyType, testValue);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...result,
            keyType: args.keyType,
            recommendations: [
              'Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly for maximum security',
              'Enable biometric protection for sensitive operations',
              'Implement secure key deletion on app uninstall',
              'Use unique identifiers for each key type',
              'Consider using Secure Enclave for key generation'
            ]
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