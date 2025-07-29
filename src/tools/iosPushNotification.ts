import { Tool, ToolResult } from '../types/tool.js';
import { IOSService } from '../services/iosService.js';

const iosService = new IOSService();

export const pushNotificationTool: Tool = {
  name: 'ios_push_notification',
  description: 'Test payment notification flows and push setup',
  inputSchema: {
    type: 'object',
    properties: {
      notificationType: {
        type: 'string',
        enum: ['payment_received', 'channel_opened', 'channel_closed', 'sync_complete'],
        description: 'Type of notification to simulate',
        default: 'payment_received'
      },
      amountSats: {
        type: 'number',
        description: 'Amount in satoshis (for payment notifications)',
        default: 1000
      }
    }
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      const result = await iosService.testPushNotification();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...result,
            notificationType: args.notificationType,
            amountSats: args.amountSats,
            implementationSteps: [
              '1. Request notification permissions on app launch',
              '2. Register for remote notifications',
              '3. Handle notification tokens and updates',
              '4. Process Lightning events in background',
              '5. Display rich notifications with payment details',
              '6. Update app badge with pending actions'
            ],
            serverIntegration: `
// Server-side notification example (Node.js)
import apn from 'apn';

class LightningNotificationServer {
  private provider: apn.Provider;
  
  constructor() {
    this.provider = new apn.Provider({
      token: {
        key: process.env.APNS_KEY_PATH,
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APPLE_TEAM_ID
      },
      production: process.env.NODE_ENV === 'production'
    });
  }
  
  async notifyPaymentReceived(
    deviceToken: string,
    paymentHash: string,
    amountSats: number,
    memo?: string
  ) {
    const notification = new apn.Notification({
      alert: {
        title: "Payment Received",
        subtitle: memo || "Lightning Payment",
        body: \`You received \${amountSats.toLocaleString()} sats\`
      },
      sound: "payment_received.wav",
      badge: 1,
      topic: "com.yourapp.bundle",
      payload: {
        type: "payment_received",
        paymentHash,
        amountSats
      },
      pushType: "alert",
      priority: 10
    });
    
    const result = await this.provider.send(notification, deviceToken);
    
    if (result.failed.length > 0) {
      console.error('Notification failed:', result.failed[0].response);
    }
    
    return result;
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