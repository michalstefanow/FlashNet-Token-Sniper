# CLUNKERS 🔵⚡

**FlashNet Token Sniper - Dark. Technical. Lightning Fast.**

A professional-grade automated token sniping system for the FlashNet AMM, designed to execute trades the moment FlashNet mainnet comes back online.

## 🎯 Features

- **⚡ Lightning Fast**: 2-second mainnet detection, <10-second trade execution
- **🔒 Secure**: Encrypted wallet storage with AES-256-GCM
- **📊 Professional**: Interactive CLI with real-time status updates
- **🎨 Dark Theme**: "Clunkers" aesthetic - technical and minimalist
- **🔄 Multi-Profile**: Manage multiple sniping strategies independently
- **📱 Discord Integration**: Rich notifications with neon blue theme
- **🧪 Testing**: Full regtest support for safe validation

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- NPM or Yarn
- FlashNet wallet with BTC for trading

### Installation

1. **Clone and setup**:
   ```bash
   cd clunkers
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

## 📋 Environment Configuration

Create a `.env` file with the following:

```bash
# Required: FlashNet API URLs
FLASHNET_MAINNET_URL=https://api.amm.flashnet.xyz/v1
FLASHNET_REGTEST_URL=https://api.amm.makebitcoingreatagain.dev/v1

# Optional: SparkScan API (for token validation)
SPARKSCAN_API_KEY=your_sparkscan_api_key_here
SPARKSCAN_BASE_URL=https://api.sparkscan.io

# Optional: Discord notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_here

# Security (auto-generated if not provided)
ENCRYPTION_KEY=

# Network settings
DEFAULT_NETWORK=REGTEST
MAINNET_POLL_INTERVAL=2000
MAX_RETRY_ATTEMPTS=20
```

## 🎮 Usage

### Main Interface

The CLI provides an interactive menu system:

```
╔═══════════════════════════════════════════════════════════════╗
║                     CLUNKERS                                  ║
║           FlashNet Token Sniper - Dark. Technical. Fast.     ║
╚═══════════════════════════════════════════════════════════════╝

Profile: akita-snipes
Network: 🟢 MAINNET MONITORING

═══ PROFILE MANAGEMENT ═══
📁 Create Profile
🔄 Switch Profile  
📋 List Profiles
🗑️ Delete Profile

═══ SNIPE MANAGEMENT ═══
📍 Add Snipe
📊 List Snipes
🔀 Toggle Snipe
🧪 Test Snipe (REGTEST)

═══ MONITORING ═══
🔍 Start Monitoring
📊 Network Status
```

### Basic Workflow

1. **Create a profile**:
   ```
   > Create Profile
   Profile name: akita-snipes
   ✅ Created profile: akita-snipes
   ```

2. **Add snipes**:
   ```
   > Add Snipe
   Token address: a1b2c3d4e5f6789...
   BTC amount: 0.05
   📍 Added snipe: a1b2c3d4e5... → 0.05 BTC
      Wallet: sp1wallet123...
   ```

3. **Test on regtest**:
   ```
   > Test Snipe (REGTEST)
   🧪 Test simulation successful on REGTEST:
      Token: AKITA
      Amount In: 0.05 BTC
      Expected Out: 1000000 tokens
      Price Impact: 2.5%
   ```

4. **Start monitoring**:
   ```
   > Start Monitoring
   🔍 Started monitoring for 2 active snipes
   
   ═══ MONITORING MODE ═══
   Status: Monitoring...
   🟢 MAINNET IS ONLINE! EXECUTING SNIPES...
   ```

## 🏗️ Architecture

### Core Components

- **ProfileManager**: Multi-profile system with file-based persistence
- **WalletManager**: HD wallet generation with secure encryption
- **FlashNetClient**: Complete FlashNet AMM API integration
- **NetworkDetector**: 2-second polling for mainnet health detection
- **SnipeEngine**: Parallel trade execution with retry logic
- **DiscordNotifier**: Rich embed notifications with Clunkers theme

### Data Flow

```
Network Detection → Profile Validation → Wallet Authentication
       ↓
   Pool Discovery → Swap Simulation → Trade Execution
       ↓
   Discord Alerts → Results Logging → Profile Updates
```

## 🔧 Advanced Configuration

### Profile Structure

```
profiles/
└── profile-name/
    ├── config.json      # Profile settings and snipes
    ├── wallets.json     # Encrypted wallet data
    └── .lock           # Process lock file
```

### Snipe Configuration

Each snipe contains:
- **Token Address**: 64-char hex or pool ID
- **BTC Amount**: Amount to spend (e.g., "0.05")
- **Wallet**: Dedicated generated wallet
- **Status**: CREATED → VALIDATED → TESTED → READY → SUCCESS/FAILED

### Risk Management

Built-in safeguards:
- **Maximum Slippage**: 10% default, configurable
- **Retry Logic**: 20 attempts with exponential backoff
- **Position Limits**: Configurable per-trade maximums
- **Dry Run Mode**: Test without real transactions

## 🧪 Testing

### Regtest Validation

Before mainnet execution:

1. **Test individual snipes**:
   ```bash
   > Test Snipe (REGTEST)
   # Validates pool discovery, authentication, and swap simulation
   ```

2. **Network connectivity**:
   ```bash
   > Network Status
   # Shows current network status and latency
   ```

3. **Discord notifications**:
   ```bash
   # Test webhook in development
   # Sends test embed to verify Discord integration
   ```

## 📊 Monitoring & Alerts

### Discord Notifications

Rich embeds for all events:
- **🧪 Test Executions**: Regtest validation results
- **🚀 Snipe Started**: When mainnet detection triggers
- **✅ Success**: Successful trade execution with details
- **❌ Failure**: Failed trades with error information
- **🔍 Monitoring**: Status updates and mainnet detection

### Performance Metrics

Track key performance indicators:
- **Detection Latency**: <2 seconds from mainnet return
- **Execution Speed**: <10 seconds total trade completion
- **Success Rate**: Percentage of successful snipes
- **Slippage**: Actual vs expected price difference

## 🔒 Security

### Wallet Security

- **HD Wallets**: BIP32/BIP39 standard key derivation
- **AES-256-GCM**: Military-grade encryption for private keys
- **One Wallet Per Snipe**: Isolated wallets for parallel execution
- **Secure Memory**: Best-effort sensitive data clearing

### API Security

- **HTTPS Only**: All API communications encrypted
- **Rate Limiting**: Respectful API usage patterns
- **Authentication**: Challenge-response for FlashNet trades
- **Input Validation**: Comprehensive validation for all inputs

## 🚨 Important Notes

### Mainnet Usage

⚠️ **CRITICAL**: Always test on regtest before mainnet execution
⚠️ **FUNDS**: Only use funds you can afford to lose  
⚠️ **SLIPPAGE**: High volatility can cause significant slippage
⚠️ **NETWORK**: Ensure stable internet connection for monitoring

### Legal Compliance

- **Jurisdiction**: Ensure automated trading is legal in your jurisdiction
- **Tax Implications**: Keep records for tax reporting
- **Risk Management**: Set appropriate position sizes

## 🛠️ Development

### Build Commands

```bash
npm run build      # Compile TypeScript
npm run dev        # Development mode with ts-node
npm start          # Build and run production
npm run snipe      # Alias for start
```

### Project Structure

```
src/
├── cli/           # Interactive CLI interface
├── core/          # Core business logic
├── services/      # External API integrations  
├── types/         # TypeScript type definitions
├── utils/         # Utility functions
└── index.ts       # Main entry point
```

## 📈 Performance Targets

- **Mainnet Detection**: <2 seconds
- **Trade Execution**: <10 seconds total
- **Parallel Snipes**: Unlimited (one wallet each)
- **Success Rate**: >80% under normal conditions
- **Uptime**: >99.5% when monitoring

## 🤝 Contributing

This is a specialized trading tool. Contributions welcome for:
- Performance optimizations
- Additional network support
- Enhanced security features
- Better error handling

## ⚠️ Disclaimer

This software is for educational and research purposes. Cryptocurrency trading involves significant risk. The authors are not responsible for any financial losses. Always do your own research and trade responsibly.

---

**CLUNKERS** - *Dark. Technical. Lightning Fast.* ⚡

Built for the FlashNet ecosystem with precision engineering and professional-grade reliability.