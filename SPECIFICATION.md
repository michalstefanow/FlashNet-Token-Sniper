# CLUNKERS - FlashNet Token Sniper Specification

## Project Overview

**Clunkers** is a command-line token sniping tool designed to detect when FlashNet mainnet returns online and immediately execute pre-configured token snipes. The tool uses a profile-based system to manage multiple sniping strategies independently.

## Core Concept

### The Problem
- FlashNet mainnet is currently offline
- When it returns, AKITA and UTXO tokens will become available for trading
- We need to be FIRST to snipe these tokens, not reactive to other traders
- Manual trading will be too slow - need automated execution

### The Solution
- Monitor FlashNet mainnet health every 2 seconds
- Pre-configure snipe targets (token addresses + BTC amounts)
- Generate dedicated wallet for each snipe (parallel execution)
- Execute all snipes instantly when mainnet returns
- Profile system for managing multiple strategies/friends

## Technical Architecture

### Project Structure
```
/Users/benitodiskau/Desktop/Zap/clunkers/
├── src/
│   ├── cli/
│   │   ├── interface.ts         # Interactive CLI menu
│   │   ├── commands.ts          # CLI command handlers
│   │   └── monitoring.ts        # Monitoring mode interface
│   ├── core/
│   │   ├── profile-manager.ts   # Profile CRUD operations
│   │   ├── wallet-manager.ts    # Wallet generation & management
│   │   ├── snipe-engine.ts      # Core sniping logic
│   │   └── network-detector.ts  # Mainnet health detection
│   ├── services/
│   │   ├── flashnet-client.ts   # FlashNet AMM API client
│   │   ├── sparkscan-client.ts  # SparkScan API client (optional)
│   │   └── discord-notifier.ts  # Discord webhook notifications
│   ├── types/
│   │   ├── profile.ts           # Profile & snipe type definitions
│   │   ├── wallet.ts            # Wallet type definitions
│   │   └── api.ts               # API response types
│   └── utils/
│       ├── encryption.ts        # Private key encryption
│       ├── validation.ts        # Input validation
│       └── lock-manager.ts      # Profile lock file management
├── profiles/                    # Profile storage directory
│   ├── [profile-name]/
│   │   ├── config.json          # Profile configuration
│   │   ├── wallets.json         # Encrypted wallet data
│   │   └── .lock               # Process lock file
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Core Features

### 1. Profile Management
- **Create Profile**: `create-profile [name]`
- **Switch Profile**: `switch-profile [name]`
- **List Profiles**: `list-profiles`
- **Delete Profile**: `delete-profile [name]`

**Profile Storage**:
- Location: `./profiles/[profile-name]/`
- Persistence: Survives CLI restarts
- Independence: Each profile can run in separate terminal
- Lock System: Prevents running same profile twice

### 2. Snipe Management
- **Add Snipe**: `add-snipe [token_address] [btc_amount]`
- **List Snipes**: `list-snipes`
- **Toggle Snipe**: `toggle-snipe [index]` (activate/deactivate)
- **Remove Snipe**: `remove-snipe [index]`
- **Test Snipe**: `test-snipe [index]` (execute on regtest)

**Snipe Configuration**:
- Input Format: BTC amounts only (e.g., 0.05, 0.1)
- Token Input: Either token address or pool ID
- States: Active/Inactive per snipe
- Validation: Pool existence check via FlashNet API

### 3. Wallet Management
- **Generation**: One fresh wallet per snipe
- **Display**: Show wallet address for manual funding
- **Security**: Encrypted private key storage
- **Persistence**: Wallets survive CLI restarts
- **Independence**: Each wallet can execute parallel swaps

### 4. Network Detection
- **Mainnet Monitoring**: 2-second polling of `https://api.amm.flashnet.xyz/v1/ping`
- **Health Check**: Verify `status === 'ok'` response
- **Instant Trigger**: Execute all active snipes when mainnet returns
- **Network Context**: Clear distinction between REGTEST and MAINNET

### 5. Trade Execution
- **Authentication**: FlashNet challenge-response flow
- **Pool Discovery**: Fetch pool data for token addresses
- **Swap Execution**: Execute buy orders with slippage protection
- **Parallel Processing**: Multiple snipes execute simultaneously
- **Retry Logic**: 20 attempts with exponential backoff (2s → 5s max delay)

### 6. Discord Integration
- **Theme**: "Clunkers" - dark, futuristic, technical
- **Colors**: Dark gray/black background, neon blue accents (#00D9FF)
- **Alerts**: Both REGTEST testing and MAINNET execution
- **Content**: Token address, BTC amount, status, TX hash, wallet address

## CLI Interface Design

### Main Menu
```
=== CLUNKERS FLASHNET SNIPER ===
Current Profile: [akita-snipes] (INACTIVE)
[REGTEST] Mainnet Status: OFFLINE (polling every 2s...)

Wallets: 3 generated | Active Snipes: 2/3

PROFILES:
• create-profile [name]    • switch-profile [name]
• list-profiles           • delete-profile [name]

SNIPES (akita-snipes):
[1] TOKEN123...abc → 0.05 BTC → sp1wallet123... [ACTIVE]
[2] TOKEN456...def → 0.1 BTC  → sp1wallet456... [INACTIVE]

1. add-snipe [token_address] [btc_amount]
2. list-snipes 
3. toggle-snipe [index] 
4. remove-snipe [index]
5. test-snipe [index] (execute on REGTEST)
6. start-monitoring (enter monitoring mode)
> 
```

### Monitoring Mode
```
=== MONITORING MODE ===
Profile: akita-snipes
Mainnet Status: OFFLINE (2s polling...)
Press 'q' to quit monitoring

ACTIVE SNIPES:
[1] TOKEN123...abc → 0.05 BTC → sp1wallet123...
[2] TOKEN456...def → 0.1 BTC  → sp1wallet456...

🔄 Waiting for mainnet return...
Last Check: 14:32:15 (2s ago)
```

## Environment Configuration

### Required Environment Variables
```bash
# FlashNet API Configuration
FLASHNET_MAINNET_URL=https://api.amm.flashnet.xyz/v1
FLASHNET_REGTEST_URL=https://api.amm.makebitcoingreatagain.dev/v1

# Optional: SparkScan API (for token validation)
# Replace with your actual API key. Do not commit real keys.
SPARKSCAN_API_KEY=your_sparkscan_api_key_here
SPARKSCAN_BASE_URL=https://api.sparkscan.io

# Discord Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Security
ENCRYPTION_KEY=auto-generated-on-first-run

# Development
DEBUG=false
LOG_LEVEL=info
```

## Data Models

### Profile Configuration
```typescript
interface Profile {
  name: string;
  createdAt: Date;
  lastUsed: Date;
  snipes: Snipe[];
  settings: ProfileSettings;
}

interface ProfileSettings {
  defaultAmount: string;      // Default BTC amount for new snipes
  maxRetries: number;         // Default: 20
  retryDelay: number;         // Default: 2s initial, 5s max
  enableDiscordAlerts: boolean;
}
```

### Snipe Configuration
```typescript
interface Snipe {
  id: string;
  tokenAddress: string;       // Token address or pool ID
  amountBtc: string;         // BTC amount to spend
  walletAddress: string;      // Generated wallet address
  isActive: boolean;         // Active/Inactive state
  poolData?: PoolData;       // Fetched pool information
  createdAt: Date;
}

interface PoolData {
  poolId: string;
  tokenSymbol: string;
  tokenName: string;
  currentPrice: number;
  estimatedTokens: string;   // Estimated tokens to receive
  slippageTolerance: number; // Default: 10%
}
```

### Wallet Data
```typescript
interface Wallet {
  address: string;
  privateKey: string;        // Encrypted
  network: 'MAINNET' | 'REGTEST';
  balance?: string;          // Last known balance
  createdAt: Date;
}
```

## External API Integration

### FlashNet AMM API
**Endpoints Used**:
- `GET /v1/ping` - Health check for mainnet detection
- `GET /v1/pools` - Pool discovery and data fetching
- `POST /v1/auth/challenge` - Authentication challenge
- `POST /v1/auth/verify` - Authentication verification
- `POST /v1/swap/simulate` - Pre-validate swap parameters
- `POST /v1/swap` - Execute swap transaction

**Rate Limiting**: No explicit limits documented, but implement respectful polling

### SparkScan API (Optional)
**Endpoints Used**:
- `GET /v1/tokens` - Token metadata validation
- `GET /v1/tx/latest` - Additional validation (if needed)

**Rate Limiting**: 80 requests/minute (conservative)

## Security Considerations

### Private Key Management
- **Encryption**: AES-256-GCM encryption for all private keys
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Storage**: Encrypted files in profile directories
- **Memory**: Clear sensitive data after use

### API Key Security
- **Environment Variables**: Never commit API keys to code
- **Validation**: Verify API key format on startup
- **Rotation**: Support for API key updates without restart

### Network Security
- **HTTPS Only**: All API calls use HTTPS
- **Certificate Validation**: Verify SSL certificates
- **Timeout Handling**: Prevent hanging connections

## Error Handling & Recovery

### Network Failures
- **Mainnet Detection**: Continue polling on connection failures
- **API Timeouts**: Retry with exponential backoff
- **Rate Limiting**: Respect API limits and back off gracefully

### Trade Execution Failures
- **Retry Strategy**: 20 attempts with increasing delays
- **Partial Failures**: Continue with other snipes if one fails
- **Error Logging**: Detailed logs for debugging
- **Discord Alerts**: Notify on failures with error details

### System Failures
- **Graceful Shutdown**: Save state before exit
- **Crash Recovery**: Auto-unlock profiles on restart if process crashed
- **Corruption Recovery**: Validate and repair corrupted profile data

## Performance Requirements

### Detection Speed
- **Mainnet Detection**: <2 seconds from return to detection
- **Trade Execution**: <10 seconds from detection to swap completion
- **CLI Responsiveness**: <100ms for all interactive commands

### Resource Usage
- **Memory**: <100MB per profile
- **CPU**: Minimal background usage during monitoring
- **Network**: <1MB/hour during monitoring (2s polling)

## Testing Strategy

### Manual Testing
- **REGTEST Validation**: Test all snipes on regtest before mainnet
- **Profile Management**: Verify profile creation, switching, deletion
- **Wallet Generation**: Ensure unique wallets per snipe
- **Error Scenarios**: Test network failures, invalid inputs

### Integration Testing
- **FlashNet API**: Verify all endpoints work correctly
- **Discord Webhooks**: Test notification delivery
- **File Persistence**: Verify profiles survive restarts

## Use Cases

### Primary Use Case: Mainnet Return Sniping
1. User creates profile "akita-snipes"
2. Adds AKITA token address with 0.05 BTC amount
3. Adds UTXO token address with 0.1 BTC amount
4. Funds generated wallets with BTC
5. Starts monitoring mode
6. Tool detects mainnet return
7. Executes both snipes in parallel
8. Sends Discord notifications with results

### Secondary Use Case: Friend Sniping Service
1. User creates profile "friend-john"
2. Adds friend's desired tokens with specified amounts
3. Shows friend the generated wallet addresses
4. Friend funds wallets with BTC
5. User starts monitoring in separate terminal
6. Tool executes friend's snipes when mainnet returns
7. Friend receives Discord notifications

### Testing Use Case: REGTEST Validation
1. User adds snipe for any available regtest token
2. Funds wallet with regtest BTC
3. Executes test-snipe command
4. Verifies swap execution works correctly
5. Checks Discord notification format
6. Gains confidence before mainnet sniping

## Implementation Timeline

### Phase 1: Core Infrastructure (2 hours)
- Project setup and TypeScript configuration
- Profile management system
- Wallet generation and encryption
- Basic CLI interface

### Phase 2: Network Integration (2 hours)
- FlashNet API client implementation
- Mainnet health detection
- Authentication flow
- Pool data fetching

### Phase 3: Trade Execution (2 hours)
- Swap execution logic
- Retry mechanism
- Error handling
- Discord notifications

### Phase 4: Testing & Polish (1 hour)
- REGTEST validation
- CLI polish and user experience
- Documentation and README

**Total Estimated Time: 7 hours** (with 1 hour buffer for unexpected issues)

## Success Criteria

### Functional Requirements
- ✅ Profile creation, switching, and management
- ✅ Snipe configuration and wallet generation
- ✅ Mainnet detection within 2 seconds
- ✅ Successful swap execution on regtest
- ✅ Discord notifications with correct formatting
- ✅ Profile lock system preventing duplicate runs
- ✅ Error handling and retry logic

### Performance Requirements
- ✅ <2 second mainnet detection
- ✅ <10 second trade execution
- ✅ Parallel snipe execution
- ✅ <100ms CLI responsiveness

### Usability Requirements
- ✅ Intuitive CLI interface
- ✅ Clear status indicators
- ✅ Helpful error messages
- ✅ Simple profile management

This specification provides the complete blueprint for building the Clunkers token sniper system. All requirements, design decisions, and implementation details are documented for reliable execution.
