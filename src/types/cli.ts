export interface CLIState {
  currentProfile?: string;
  isMonitoring: boolean;
  networkStatus: NetworkStatus;
  lastCommand?: string;
  debug: boolean;
}

export interface NetworkStatus {
  isOnline: boolean;
  network: 'MAINNET' | 'REGTEST';
  lastCheck: Date;
  latency?: number;            // ms
  consecutiveFailures: number;
}

export interface CLICommand {
  name: string;
  description: string;
  handler: (args: string[]) => Promise<void>;
  validate?: (args: string[]) => boolean;
  help?: string;
}

export interface MenuOption {
  key: string;
  label: string;
  action: () => Promise<void>;
  enabled?: boolean;
}

export interface MonitoringDisplay {
  profileName: string;
  activeSnipeCount: number;
  totalSnipeCount: number;
  networkStatus: NetworkStatus;
  uptime: number;              // seconds
  lastMainnetCheck: Date;
  quitRequested: boolean;
}

export interface ProfileSummary {
  name: string;
  snipeCount: number;
  activeSnipeCount: number;
  totalWallets: number;
  fundedWallets: number;
  lastUsed: Date;
  isLocked: boolean;
  status: ProfileStatus;
}

export type ProfileStatus = 
  | 'IDLE'          // Not running
  | 'MONITORING'    // Currently monitoring for mainnet
  | 'EXECUTING'     // Executing snipes
  | 'LOCKED'        // Locked by another process
  | 'ERROR';        // Error state

export interface SnipeDisplay {
  index: number;
  id: string;
  tokenAddress: string;        // Truncated for display
  tokenSymbol?: string;
  amountBtc: string;
  walletAddress: string;       // Truncated for display
  isActive: boolean;
  status: string;
  walletFunded?: boolean;
  estimatedTokens?: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

// Input validation types
export interface AddSnipeInput {
  tokenAddress: string;
  amountBtc: string;
}

export interface CreateProfileInput {
  name: string;
}

export interface TestSnipeInput {
  snipeIndex: number;
}

// Display configuration
export interface DisplayConfig {
  colors: {
    primary: string;           // Neon blue #00D9FF
    secondary: string;         // Dark gray
    success: string;           // Green
    warning: string;           // Yellow
    error: string;             // Red
    muted: string;             // Light gray
  };
  symbols: {
    bullet: string;
    arrow: string;
    check: string;
    cross: string;
    loading: string;
  };
  truncateLength: {
    address: number;           // Character length for address display
    hash: number;              // Character length for hash display
  };
}