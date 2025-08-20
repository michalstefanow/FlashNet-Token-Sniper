// FlashNet API Response Types

export interface FlashNetPingResponse {
  status: 'ok' | 'error';
  timestamp: string;
  network: 'MAINNET' | 'REGTEST';
  settlementTimestamp?: string;
}

export interface FlashNetPoolResponse {
  lpPublicKey: string;
  assetAAddress: string;        // Token address (64-char hex)
  assetAReserve: string;       // Token reserves
  assetBReserve: string;       // BTC reserves
  currentPriceAInB: number;    // Price per token in BTC
  tokenSymbol?: string;
  tokenName?: string;
  bondingProgressPercent: number;
  isGraduated: boolean;
  createdAt: string;
  updatedAt: string;
  lastTradeAt?: string;
  swapCount: number;
  lpCount: number;             // Holder count
  hostName: string;            // Creator
  hostAddress?: string;        // Creator address
  status: string;
  lpFeeBps: number;
  hostFeeBps: number;
}

export interface FlashNetPoolsResponse {
  pools: FlashNetPoolResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface FlashNetAuthChallengeRequest {
  publicKey: string;
}

export interface FlashNetAuthChallengeResponse {
  challenge: string;           // 64-char hex string
  requestId: string;          // ULID
}

export interface FlashNetAuthVerifyRequest {
  publicKey: string;
  signature: string;          // ECDSA signature of challenge
  requestId: string;
}

export interface FlashNetAuthVerifyResponse {
  accessToken: string;        // JWT token
  expiresIn: number;          // seconds
  tokenType: 'Bearer';
}

export interface FlashNetSwapSimulateRequest {
  poolId: string;
  amountIn: string;           // BTC amount in satoshis
  isBuy: boolean;             // true for buying tokens
}

export interface FlashNetSwapSimulateResponse {
  amountOut: string;          // Expected token amount out
  priceImpact: number;        // Price impact percentage
  fee: string;                // Fee in BTC
  pricePerToken: number;      // Price per token after swap
  slippage: number;           // Expected slippage
}

export interface FlashNetSwapRequest {
  poolId: string;
  amountIn: string;           // BTC amount in satoshis
  minAmountOut: string;       // Minimum tokens to receive
  recipient: string;          // Wallet address
  deadline: number;           // Unix timestamp
  signature: string;          // Transaction signature
}

export interface FlashNetSwapResponse {
  transactionHash: string;
  amountOut: string;          // Actual tokens received
  pricePerToken: number;      // Final price per token
  fee: string;                // Actual fee paid
  gasUsed: number;           // Gas used for transaction
  status: 'pending' | 'confirmed' | 'failed';
}

// SparkScan API Types (Optional Integration)

export interface SparkScanTokenResponse {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  holders: number;
  network: 'MAINNET' | 'REGTEST';
}

export interface SparkScanTransactionResponse {
  id: string;
  hash: string;
  type: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockHeight: number;
  timestamp: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  network: 'MAINNET' | 'REGTEST';
}

// Discord Webhook Types

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;              // Hex color as number
  fields: DiscordEmbedField[];
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordWebhookPayload {
  username: string;
  avatar_url?: string;
  embeds: DiscordEmbed[];
}

// Error Response Types

export interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface NetworkError {
  type: 'TIMEOUT' | 'CONNECTION_FAILED' | 'DNS_FAILED' | 'RATE_LIMITED';
  message: string;
  retryAfter?: number;
  originalError?: any;
}