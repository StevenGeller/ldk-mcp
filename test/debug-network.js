import * as bitcoin from 'bitcoinjs-lib';
import * as bolt11 from 'bolt11';
import crypto from 'crypto';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);

// Test network configurations
console.log('Testing network configurations...\n');

const network = bitcoin.networks.testnet;
console.log('Network object:', network);
console.log('Network messagePrefix:', network.messagePrefix);

// Test invoice creation
const preimage = crypto.randomBytes(32);
const paymentHash = crypto.createHash('sha256').update(preimage).digest();

const invoice = {
  network: 'tb', // Direct string
  timestamp: Math.floor(Date.now() / 1000),
  tags: [
    { tagName: 'payment_hash', data: paymentHash.toString('hex') },
    { tagName: 'description', data: 'Test invoice' },
    { tagName: 'expire_time', data: 3600 }
  ],
  millisatoshis: '10000000'
};

console.log('\nInvoice object:', invoice);

try {
  const privateKey = ECPair.makeRandom({ network }).privateKey;
  console.log('\nPrivate key generated successfully');
  
  const encoded = bolt11.encode(invoice);
  console.log('\nEncoded invoice:', encoded);
  
  const signed = bolt11.sign(encoded, privateKey);
  console.log('\nSigned invoice:', signed.paymentRequest);
  
} catch (error) {
  console.error('\nError:', error);
  console.error('Error stack:', error.stack);
}