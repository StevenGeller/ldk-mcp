import { Tool, ToolResult } from '../types/tool.js';
import { IOSService } from '../services/iosService.js';

const iosService = new IOSService();

export const backgroundTestTool: Tool = {
  name: 'ios_background_test',
  description: 'Test Lightning background processing and channel monitoring',
  inputSchema: {
    type: 'object',
    properties: {
      taskType: {
        type: 'string',
        enum: ['sync', 'monitor', 'payment'],
        description: 'Type of background task to test',
        default: 'sync'
      }
    }
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const result = await iosService.testBackgroundProcessing();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            message: result.message,
            swiftExample: result.swiftCode,
            taskType: args.taskType,
            bestPractices: [
              'Register background tasks in Info.plist',
              'Use BGProcessingTask for longer operations',
              'Implement proper task expiration handling',
              'Schedule tasks based on user behavior',
              'Monitor battery and network conditions',
              'Persist state before task completion'
            ],
            plistConfiguration: `
<!-- Add to Info.plist -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.yourapp.lightning.sync</string>
    <string>com.yourapp.lightning.monitor</string>
    <string>com.yourapp.lightning.payment</string>
</array>

<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
</array>`.trim()
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