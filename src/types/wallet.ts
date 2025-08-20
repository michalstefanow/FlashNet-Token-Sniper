export interface Wallet {
  address: string;
  privateKey: string;            // Encrypted
  mnemonic?: string;             // Encrypted, optional
  network: 'MAINNET' | 'REGTEST';
  balance?: WalletBalance;       // Last known balance
  createdAt: Date;
  lastBalanceCheck?: Date;
}

export interface WalletBalance {
  confirmed: string;             // Confirmed BTC balance (satoshis)
  unconfirmed: string;          // Unconfirmed BTC balance (satoshis)
  total: string;                // Total balance (satoshis)
  btc: string;                  // Human readable BTC amount
  usd?: number;                 // USD value if available
  lastUpdated: Date;
}

export interface WalletGenerationOptions {
  network: 'MAINNET' | 'REGTEST';
  useCustomEntropy?: boolean;
  customEntropy?: Buffer;
}

export interface WalletImportOptions {
  privateKey?: string;
  mnemonic?: string;
  network: 'MAINNET' | 'REGTEST';
}

export interface TransactionInput {
  txid: string;
  vout: number;
  scriptPubKey: string;
  amount: number;               // satoshis
}

export interface TransactionOutput {
  address: string;
  amount: number;               // satoshis
}

export interface UnsignedTransaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  fee: number;                  // satoshis
  estimatedSize: number;        // bytes
}

export interface SignedTransaction {
  hex: string;
  txid: string;
  size: number;
  fee: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}