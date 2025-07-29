export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
  amountMsat: number;
  description?: string;
  expiryTime: number;
  timestamp: number;
}

export interface Channel {
  channelId: string;
  shortChannelId?: string;
  remotePubkey: string;
  fundingTxid: string;
  capacityMsat: number;
  localBalanceMsat: number;
  remoteBalanceMsat: number;
  state: ChannelState;
  isUsable: boolean;
}

export enum ChannelState {
  Pending = 'pending',
  Open = 'open',
  Closing = 'closing',
  Closed = 'closed',
  ForceClosing = 'force_closing',
}

export interface NodeInfo {
  nodeId: string;
  alias: string;
  numChannels: number;
  numUsableChannels: number;
  numPeers: number;
  blockHeight: number;
  syncedToChain: boolean;
  version: string;
}

export interface Payment {
  paymentHash: string;
  paymentPreimage?: string;
  amountMsat: number;
  status: PaymentStatus;
  timestamp: number;
  description?: string;
  bolt11?: string;
  feeMsat?: number;
}

export enum PaymentStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
}

export interface FeeEstimate {
  baseFee: number;
  proportionalMillionths: number;
  estimatedFeeMsat: number;
  estimatedDurationSeconds: number;
}