export interface Profile {
  name: string;
  createdAt: Date;
  lastUsed: Date;
  snipes: Snipe[];
  settings: ProfileSettings;
}

export interface ProfileSettings {
  defaultAmount: string;          // Default BTC amount for new snipes
  maxRetries: number;             // Default: 20
  retryDelay: number;             // Default: 2s initial, 5s max
  enableDiscordAlerts: boolean;   // Discord webhook notifications
  slippageTolerance: number;      // Default: 10%
  network: 'MAINNET' | 'REGTEST'; // Current network preference
}

export interface Snipe {
  id: string;
  tokenAddress: string;           // Token address or pool ID
  amountBtc: string;             // BTC amount to spend
  walletAddress: string;          // FlashNet wallet address (Spark)
  bitcoinAddress?: string;        // Bitcoin Taproot address for funding
  encryptedMnemonic: string;      // Encrypted wallet mnemonic
  isActive: boolean;             // Active/Inactive state
  poolData?: PoolData;           // Fetched pool information
  createdAt: Date;
  lastTestedAt?: Date;           // Last regtest execution
  executedAt?: Date;             // Mainnet execution timestamp
  status: SnipeStatus;
}

export interface PoolData {
  poolId: string;
  tokenSymbol: string;
  tokenName: string;
  currentPrice: number;
  estimatedTokens: string;       // Estimated tokens to receive
  slippageTolerance: number;
  liquidityBtc: number;
  bondingProgress: number;       // 0-100 percentage
  isGraduated: boolean;
  network: 'MAINNET' | 'REGTEST';
  lastUpdated: Date;
}

export type SnipeStatus = 
  | 'CREATED'       // Just created, not tested
  | 'VALIDATED'     // Pool data fetched successfully
  | 'TESTED'        // Successfully tested on regtest
  | 'READY'         // Ready for mainnet execution
  | 'EXECUTING'     // Currently executing trade
  | 'SUCCESS'       // Successfully executed
  | 'FAILED'        // Execution failed
  | 'RETRYING';     // Retrying after failure

export interface ProfileLock {
  profileName: string;
  pid: number;
  timestamp: Date;
  hostname: string;
}

export interface SnipeResult {
  snipeId: string;
  success: boolean;
  transactionHash?: string;
  tokensReceived?: string;
  actualPrice?: number;
  slippage?: number;
  gasUsed?: number;
  error?: string;
  executionTime: number; // milliseconds
  attempts: number;
}