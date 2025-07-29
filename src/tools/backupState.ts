import { Tool, ToolResult } from '../types/tool.js';
import { LightningService } from '../services/lightningService.js';

const lightningService = new LightningService();

export const backupStateTool: Tool = {
  name: 'ldk_backup_state',
  description: 'Test channel backup and restore flows',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['backup', 'restore'],
        description: 'Action to perform'
      },
      backupData: {
        type: 'string',
        description: 'Base64 encoded backup data (required for restore)'
      }
    },
    required: ['action']
  },
  execute: async (args: any): Promise<ToolResult> => {
    try {
      if (args.action === 'backup') {
        const backup = await lightningService.backupState();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'backup',
              backupData: backup,
              backupSize: Buffer.from(backup, 'base64').length,
              timestamp: new Date().toISOString(),
              swiftExample: `
// Swift code for channel backup in your iOS app
import LightningDevKit
import Foundation

class LDKBackupManager {
    private let fileManager = FileManager.default
    private let backupDirectory: URL
    
    init() throws {
        // Create backup directory in app's documents
        let documentsPath = fileManager.urls(for: .documentDirectory, 
                                           in: .userDomainMask).first!
        backupDirectory = documentsPath.appendingPathComponent("ldk_backups")
        
        try fileManager.createDirectory(at: backupDirectory, 
                                      withIntermediateDirectories: true)
    }
    
    // Backup channel state
    func backupChannels() throws {
        let channelManager = LDKManager.shared.channelManager
        let channels = channelManager.listChannels()
        
        // Serialize channel monitors
        var backupData: [String: Data] = [:]
        
        for channel in channels {
            let channelId = channel.getChannelId()
            let monitor = LDKManager.shared.getChannelMonitor(channelId: channelId)
            
            if let serialized = monitor?.write() {
                backupData[channelId.toHex()] = Data(serialized)
            }
        }
        
        // Add channel manager state
        if let managerBytes = channelManager.write() {
            backupData["channel_manager"] = Data(managerBytes)
        }
        
        // Add network graph
        if let graphBytes = LDKManager.shared.networkGraph.write() {
            backupData["network_graph"] = Data(graphBytes)
        }
        
        // Create timestamped backup
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let backupFile = backupDirectory
            .appendingPathComponent("backup_\\(timestamp).json")
        
        let jsonData = try JSONEncoder().encode(backupData)
        try jsonData.write(to: backupFile)
        
        // Also save to iCloud if available
        saveToICloud(data: jsonData, timestamp: timestamp)
        
        print("Backup saved: \\(backupFile.lastPathComponent)")
    }
    
    // Restore from backup
    func restoreFromBackup(backupFile: URL) throws {
        let jsonData = try Data(contentsOf: backupFile)
        let backupData = try JSONDecoder().decode([String: Data].self, from: jsonData)
        
        // Restore channel monitors first
        for (channelIdHex, monitorData) in backupData {
            if channelIdHex == "channel_manager" || channelIdHex == "network_graph" {
                continue
            }
            
            let monitor = try ChannelMonitor.read(
                ser: [UInt8](monitorData),
                arg: LDKManager.shared.keysManager
            )
            
            // Persist restored monitor
            LDKManager.shared.persistChannelMonitor(monitor: monitor)
        }
        
        // Then restore channel manager
        if let managerData = backupData["channel_manager"] {
            // This requires rebuilding the channel manager with monitors
            try LDKManager.shared.restoreChannelManager(
                serialized: [UInt8](managerData),
                monitors: getRestoredMonitors()
            )
        }
        
        print("Restore completed successfully")
    }
    
    // Automatic backup on important events
    func setupAutomaticBackup() {
        // Backup after channel updates
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleChannelUpdate),
            name: .ldkChannelUpdated,
            object: nil
        )
        
        // Backup periodically
        Timer.scheduledTimer(withTimeInterval: 3600, repeats: true) { _ in
            try? self.backupChannels()
        }
    }
    
    @objc private func handleChannelUpdate() {
        // Debounce backups to avoid too frequent saves
        NSObject.cancelPreviousPerformRequests(
            withTarget: self,
            selector: #selector(performBackup),
            object: nil
        )
        
        perform(#selector(performBackup), with: nil, afterDelay: 5.0)
    }
    
    @objc private func performBackup() {
        try? backupChannels()
    }
    
    // iCloud backup
    private func saveToICloud(data: Data, timestamp: String) {
        guard let containerURL = FileManager.default.url(
            forUbiquityContainerIdentifier: nil
        ) else { return }
        
        let iCloudBackup = containerURL
            .appendingPathComponent("Documents")
            .appendingPathComponent("ldk_backup_\\(timestamp).json")
        
        do {
            try data.write(to: iCloudBackup)
            print("Backup saved to iCloud")
        } catch {
            print("iCloud backup failed: \\(error)")
        }
    }
}

// Extension for Notification.Name
extension Notification.Name {
    static let ldkChannelUpdated = Notification.Name("ldkChannelUpdated")
}`.trim()
            }, null, 2)
          }]
        };
      } else if (args.action === 'restore') {
        if (!args.backupData) {
          throw new Error('Backup data required for restore');
        }
        
        const success = await lightningService.restoreState(args.backupData);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success,
              action: 'restore',
              message: success ? 'State restored successfully' : 'Restore failed'
            }, null, 2)
          }]
        };
      } else {
        throw new Error('Invalid action. Use "backup" or "restore"');
      }
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