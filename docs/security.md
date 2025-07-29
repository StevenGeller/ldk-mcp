# Security Best Practices

## Key Management

### Secure Key Storage
```swift
import Security
import LightningDevKit

class SecureKeyManager {
    private let keychainService = "com.example.lightning.keys"
    
    // Store seed phrase securely
    func storeSeedPhrase(_ seedPhrase: [String]) throws {
        let seedData = seedPhrase.joined(separator: " ").data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "lightning_seed",
            kSecValueData as String: seedData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrSynchronizable as String: false
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.storeFailed(status)
        }
    }
    
    // Retrieve with biometric authentication
    func retrieveSeedPhrase() throws -> [String] {
        let context = LAContext()
        context.localizedReason = "Access your Lightning wallet"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: "lightning_seed",
            kSecReturnData as String: true,
            kSecUseAuthenticationContext as String: context
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let seedString = String(data: data, encoding: .utf8) else {
            throw KeychainError.retrieveFailed(status)
        }
        
        return seedString.components(separatedBy: " ")
    }
}
```

### Hardware Security Module Integration
```swift
class HardwareSecurityModule {
    // Use Secure Enclave for key generation
    func generateSecureEnclaveKey() throws -> SecKey {
        let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            nil
        )!
        
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: "com.example.lightning.signing",
                kSecAttrAccessControl as String: access
            ]
        ]
        
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw error!.takeRetainedValue() as Error
        }
        
        return privateKey
    }
}
```

## Channel Security

### Secure Channel Establishment
```swift
class SecureChannelManager {
    // Validate peer before opening channel
    func validatePeerForChannel(nodeId: String, amount: UInt64) async throws {
        // Check peer reputation
        let reputation = try await checkNodeReputation(nodeId)
        guard reputation.score > 0.7 else {
            throw ChannelError.untrustedPeer
        }
        
        // Verify node is well-connected
        let connectivity = try await analyzeNodeConnectivity(nodeId)
        guard connectivity.channelCount > 10 else {
            throw ChannelError.poorlyConnectedPeer
        }
        
        // Check for suspicious patterns
        let riskAnalysis = try await performRiskAnalysis(nodeId, amount)
        guard riskAnalysis.riskLevel == .low else {
            throw ChannelError.highRiskPeer
        }
    }
    
    // Monitor channel for anomalies
    func monitorChannelSecurity(channelId: [UInt8; 32]) {
        // Set up alerts for unusual activity
        channelMonitor.setAlertThresholds(
            maxHTLCs: 100,
            maxValueInFlight: 1_000_000, // sats
            minReserve: 10_000 // sats
        )
        
        // Log all force closes for analysis
        channelMonitor.onForceClose = { reason in
            SecurityLogger.log(.forceClose, channelId: channelId, reason: reason)
        }
    }
}
```

## Payment Security

### Payment Verification
```swift
class PaymentSecurityManager {
    // Verify invoice before payment
    func verifyInvoice(_ invoice: String) throws -> Bindings.Bolt11Invoice {
        let parsedInvoice = try Bindings.Bolt11Invoice.fromStr(s: invoice)
        
        // Check expiry
        guard !parsedInvoice.isExpired() else {
            throw PaymentError.expiredInvoice
        }
        
        // Verify amount limits
        if let amount = parsedInvoice.amountMilliSatoshis() {
            let amountSats = amount / 1000
            guard amountSats <= maxPaymentAmount else {
                throw PaymentError.amountTooHigh
            }
        }
        
        // Check destination reputation
        let payeePubkey = parsedInvoice.payeePubKey()
        let reputation = checkNodeReputation(payeePubkey)
        guard reputation.isValid else {
            throw PaymentError.untrustedPayee
        }
        
        return parsedInvoice
    }
    
    // Secure payment proof storage
    func storePaymentProof(_ payment: PaymentInfo) throws {
        let proofData = try JSONEncoder().encode(payment)
        
        try secureStorage.store(
            data: proofData,
            identifier: "payment_\(payment.paymentHash)",
            encrypted: true,
            authenticated: true
        )
    }
}
```

## Network Security

### Tor Integration
```swift
class TorLightningNetwork {
    let torClient: TorClient
    
    func connectOverTor() async throws {
        // Initialize Tor
        try await torClient.start()
        
        // Configure LDK to use Tor proxy
        let torProxy = SocketAddress.hostname(
            hostname: "127.0.0.1",
            port: 9050
        )
        
        peerManager.setProxy(torProxy)
    }
    
    // Generate .onion address for node
    func generateOnionAddress() throws -> String {
        let onionKey = try torClient.generateV3Key()
        let onionAddress = try torClient.publishService(
            key: onionKey,
            port: 9735
        )
        
        return onionAddress
    }
}
```

## Backup Security

### Encrypted Backups
```swift
class SecureBackupManager {
    // Encrypt channel state for backup
    func encryptChannelBackup(_ channelManager: Bindings.ChannelManager) throws -> Data {
        let backup = channelManager.serialize()
        
        // Generate encryption key from user passphrase
        let salt = try generateRandomBytes(count: 32)
        let key = try deriveKey(
            passphrase: userPassphrase,
            salt: salt,
            iterations: 100_000
        )
        
        // Encrypt with AES-256-GCM
        let encrypted = try AES.GCM.seal(
            backup,
            using: key,
            nonce: AES.GCM.Nonce()
        )
        
        // Combine salt + nonce + ciphertext
        var backupData = Data()
        backupData.append(salt)
        backupData.append(encrypted.nonce)
        backupData.append(encrypted.ciphertext)
        backupData.append(encrypted.tag)
        
        return backupData
    }
    
    // Secure cloud backup
    func backupToCloud(_ encryptedData: Data) async throws {
        // Additional encryption layer for cloud
        let cloudKey = try deriveCloudKey()
        let doubleEncrypted = try encrypt(encryptedData, with: cloudKey)
        
        // Upload with integrity verification
        let checksum = SHA256.hash(data: doubleEncrypted)
        try await cloudStorage.upload(
            data: doubleEncrypted,
            checksum: checksum,
            identifier: "lightning_backup_\(Date().timeIntervalSince1970)"
        )
    }
}
```

## Security Monitoring

### Anomaly Detection
```swift
class SecurityMonitor {
    func detectAnomalies() {
        // Monitor for unusual payment patterns
        paymentMonitor.onAnomalyDetected = { anomaly in
            switch anomaly {
            case .unusuallyHighPayment(let amount):
                requireUserConfirmation(for: amount)
            case .rapidPaymentSequence(let count):
                temporarilyBlockPayments(reason: "Unusual activity detected")
            case .suspiciousRoutingPath(let path):
                logSecurityEvent(.suspiciousRouting, details: path)
            }
        }
        
        // Channel monitoring
        channelMonitor.onSecurityEvent = { event in
            switch event {
            case .forceCloseAttempt:
                notifyUser("Channel force close attempted")
            case .unusualFeeUpdate(let newFee):
                if newFee > reasonableFeeThreshold {
                    rejectFeeUpdate()
                }
            }
        }
    }
}
```

## Best Practices Summary

1. **Never store private keys in plaintext**
2. **Use hardware security features when available**
3. **Implement rate limiting for payments**
4. **Validate all external data**
5. **Monitor for anomalous behavior**
6. **Encrypt all backups**
7. **Use secure communication channels**
8. **Implement proper session management**
9. **Regular security audits**
10. **Keep dependencies updated**