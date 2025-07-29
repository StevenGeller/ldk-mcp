import * as bitcoin from 'bitcoinjs-lib';
import * as bolt11 from 'bolt11';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import { 
  LightningInvoice, 
  Channel, 
  NodeInfo, 
  Payment, 
  PaymentStatus,
  ChannelState,
  FeeEstimate 
} from '../types/lightning.js';

const ECPair = ECPairFactory(ecc);

// Mock Lightning service that simulates LDK functionality
export class LightningService {
  private channels: Map<string, Channel> = new Map();
  private payments: Map<string, Payment> = new Map();
  private nodeInfo: NodeInfo;
  private network: bitcoin.Network;

  constructor(network: 'mainnet' | 'testnet' | 'regtest' = 'testnet') {
    this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : 
                   network === 'testnet' ? bitcoin.networks.testnet :
                   bitcoin.networks.regtest as bitcoin.Network;
    
    // Initialize mock node info
    this.nodeInfo = {
      nodeId: this.generateNodeId(),
      alias: 'LDK MCP Node',
      numChannels: 0,
      numUsableChannels: 0,
      numPeers: 0,
      blockHeight: 800000,
      syncedToChain: true,
      version: '0.0.124'
    };
  }

  private generateNodeId(): string {
    const keyPair = ECPair.makeRandom({ network: this.network });
    return keyPair.publicKey.toString('hex');
  }

  async generateInvoice(
    amountMsat: number,
    description?: string,
    expiry: number = 3600
  ): Promise<LightningInvoice> {
    const preimage = crypto.randomBytes(32);
    const paymentHash = crypto.createHash('sha256').update(preimage).digest();
    
    const invoice: bolt11.PaymentRequestObject = {
      network: (this.network === bitcoin.networks.bitcoin ? 'bc' : 
                this.network === bitcoin.networks.testnet ? 'tb' : 'bcrt') as any,
      timestamp: Math.floor(Date.now() / 1000),
      tags: [
        { tagName: 'payment_hash', data: paymentHash.toString('hex') },
        { tagName: 'description', data: description || 'LDK MCP Invoice' },
        { tagName: 'expire_time', data: expiry }
      ],
      millisatoshis: amountMsat.toString()
    };

    const privateKey = ECPair.makeRandom({ network: this.network }).privateKey!;
    const encoded = bolt11.encode(invoice);
    const signed = bolt11.sign(encoded, privateKey);

    return {
      bolt11: signed.paymentRequest || '',
      paymentHash: paymentHash.toString('hex'),
      amountMsat,
      description: description || '',
      expiryTime: expiry,
      timestamp: invoice.timestamp || 0
    };
  }

  async payInvoice(bolt11Invoice: string): Promise<Payment> {
    try {
      const decoded = bolt11.decode(bolt11Invoice);
      const paymentHash = decoded.tags.find(t => t.tagName === 'payment_hash')?.data as string;
      const amountMsat = parseInt(decoded.millisatoshis || '0');
      const description = decoded.tags.find(t => t.tagName === 'description')?.data as string;

      const payment: Payment = {
        paymentHash,
        amountMsat,
        status: PaymentStatus.Succeeded,
        timestamp: Date.now(),
        description,
        bolt11: bolt11Invoice,
        feeMsat: Math.floor(amountMsat * 0.001), // 0.1% fee
        paymentPreimage: crypto.randomBytes(32).toString('hex')
      };

      this.payments.set(paymentHash, payment);
      return payment;
    } catch (error) {
      throw new Error(`Failed to pay invoice: ${error}`);
    }
  }

  async createChannel(
    remotePubkey: string,
    capacityMsat: number,
    pushMsat: number = 0
  ): Promise<Channel> {
    const channelId = crypto.randomBytes(32).toString('hex');
    const fundingTxid = crypto.randomBytes(32).toString('hex');
    
    const channel: Channel = {
      channelId,
      shortChannelId: `800000x${Math.floor(Math.random() * 1000)}x${Math.floor(Math.random() * 10)}`,
      remotePubkey,
      fundingTxid,
      capacityMsat,
      localBalanceMsat: capacityMsat - pushMsat,
      remoteBalanceMsat: pushMsat,
      state: ChannelState.Open,
      isUsable: true
    };

    this.channels.set(channelId, channel);
    this.nodeInfo.numChannels++;
    this.nodeInfo.numUsableChannels++;
    
    return channel;
  }

  async closeChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    channel.state = ChannelState.Closing;
    channel.isUsable = false;
    this.nodeInfo.numUsableChannels--;
    
    // Simulate async closing
    setTimeout(() => {
      channel.state = ChannelState.Closed;
      this.channels.delete(channelId);
      this.nodeInfo.numChannels--;
    }, 5000);

    return true;
  }

  async getChannelStatus(): Promise<Channel[]> {
    return Array.from(this.channels.values());
  }

  async getNodeInfo(): Promise<NodeInfo> {
    return this.nodeInfo;
  }

  async getBalance(): Promise<{ totalMsat: number; spendableMsat: number }> {
    let totalMsat = 0;
    let spendableMsat = 0;

    for (const channel of this.channels.values()) {
      if (channel.state === ChannelState.Open) {
        totalMsat += channel.localBalanceMsat;
        if (channel.isUsable) {
          // Reserve 1% for fees
          spendableMsat += Math.floor(channel.localBalanceMsat * 0.99);
        }
      }
    }

    return { totalMsat, spendableMsat };
  }

  async decodeInvoice(bolt11Invoice: string): Promise<any> {
    try {
      const decoded = bolt11.decode(bolt11Invoice);
      return {
        paymentHash: decoded.tags.find(t => t.tagName === 'payment_hash')?.data,
        amountMsat: decoded.millisatoshis ? parseInt(decoded.millisatoshis) : null,
        description: decoded.tags.find(t => t.tagName === 'description')?.data,
        expiry: decoded.tags.find(t => t.tagName === 'expire_time')?.data,
        timestamp: decoded.timestamp,
        payee: decoded.payeeNodeKey,
        network: decoded.network
      };
    } catch (error) {
      throw new Error(`Failed to decode invoice: ${error}`);
    }
  }

  async listPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async estimateFee(amountMsat: number): Promise<FeeEstimate> {
    // Simple fee estimation
    const baseFee = 1000; // 1 sat base fee
    const proportionalMillionths = 1000; // 0.1%
    const estimatedFeeMsat = baseFee + Math.floor(amountMsat * proportionalMillionths / 1000000);
    
    return {
      baseFee,
      proportionalMillionths,
      estimatedFeeMsat,
      estimatedDurationSeconds: 60 // 1 minute estimate
    };
  }

  async backupState(): Promise<string> {
    const state = {
      nodeInfo: this.nodeInfo,
      channels: Array.from(this.channels.entries()),
      payments: Array.from(this.payments.entries()),
      timestamp: Date.now()
    };
    
    return Buffer.from(JSON.stringify(state)).toString('base64');
  }

  async restoreState(backup: string): Promise<boolean> {
    try {
      const state = JSON.parse(Buffer.from(backup, 'base64').toString());
      this.nodeInfo = state.nodeInfo;
      this.channels = new Map(state.channels);
      this.payments = new Map(state.payments);
      return true;
    } catch (error) {
      throw new Error(`Failed to restore state: ${error}`);
    }
  }
}