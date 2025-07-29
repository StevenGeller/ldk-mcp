import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

export class WalletService {
  private network: bitcoin.Network;

  constructor(network: 'mainnet' | 'testnet' | 'regtest' = 'testnet') {
    this.network = network === 'mainnet' ? bitcoin.networks.bitcoin : 
                   network === 'testnet' ? bitcoin.networks.testnet :
                   bitcoin.networks.regtest;
  }

  generateMnemonic(strength: 128 | 256 = 256): string {
    return bip39.generateMnemonic(strength);
  }

  mnemonicToSeed(mnemonic: string, passphrase: string = ''): Buffer {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }
    return bip39.mnemonicToSeedSync(mnemonic, passphrase);
  }

  deriveAddress(
    seed: Buffer,
    accountIndex: number = 0,
    isChange: boolean = false,
    addressIndex: number = 0
  ): {
    address: string;
    publicKey: string;
    privateKey: string;
    derivationPath: string;
  } {
    const root = bip32.fromSeed(seed, this.network);
    
    // BIP84 (native segwit) derivation path
    const purpose = 84;
    const coinType = this.network === bitcoin.networks.bitcoin ? 0 : 1;
    const change = isChange ? 1 : 0;
    
    const path = `m/${purpose}'/${coinType}'/${accountIndex}'/${change}/${addressIndex}`;
    const child = root.derivePath(path);
    
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: this.network
    });

    if (!address) {
      throw new Error('Failed to derive address');
    }

    return {
      address,
      publicKey: child.publicKey.toString('hex'),
      privateKey: child.privateKey!.toString('hex'),
      derivationPath: path
    };
  }

  createMultisigAddress(
    publicKeys: string[],
    requiredSignatures: number
  ): {
    address: string;
    redeemScript: string;
    witnessScript: string;
  } {
    const pubkeys = publicKeys.map(hex => Buffer.from(hex, 'hex'));
    
    const p2ms = bitcoin.payments.p2ms({
      m: requiredSignatures,
      pubkeys,
      network: this.network
    });

    const p2wsh = bitcoin.payments.p2wsh({
      redeem: p2ms,
      network: this.network
    });

    if (!p2wsh.address || !p2ms.output || !p2wsh.redeem?.output) {
      throw new Error('Failed to create multisig address');
    }

    return {
      address: p2wsh.address,
      redeemScript: p2ms.output.toString('hex'),
      witnessScript: p2wsh.redeem.output.toString('hex')
    };
  }

  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }

  getAddressInfo(address: string): {
    type: string;
    network: string;
    isValid: boolean;
  } {
    try {
      const decoded = bitcoin.address.fromBech32(address);
      
      let type = 'unknown';
      if (decoded.version === 0) {
        type = decoded.data.length === 20 ? 'p2wpkh' : 'p2wsh';
      } else if (decoded.version === 1) {
        type = 'p2tr';
      }

      const network = decoded.prefix === 'bc' ? 'mainnet' : 
                     decoded.prefix === 'tb' ? 'testnet' : 
                     decoded.prefix === 'bcrt' ? 'regtest' : 'unknown';

      return {
        type,
        network,
        isValid: true
      };
    } catch {
      try {
        // Try legacy address format
        bitcoin.address.fromBase58Check(address);
        return {
          type: 'legacy',
          network: 'unknown',
          isValid: true
        };
      } catch {
        return {
          type: 'invalid',
          network: 'unknown',
          isValid: false
        };
      }
    }
  }
}