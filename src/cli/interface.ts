import inquirer from 'inquirer';
import chalk from 'chalk';
import { CommandHandler } from './commands';
import { Profile, Snipe } from '../types/profile';
import { ProfileSummary, SnipeDisplay, DisplayConfig } from '../types/cli';
import { NetworkDetector, NetworkStatusEvent } from '../core/network-detector';

export class CLIInterface {
  private commandHandler: CommandHandler;
  private displayConfig: DisplayConfig;
  private isRunning = false;

  constructor(baseDir: string) {
    this.commandHandler = new CommandHandler(baseDir);
    this.displayConfig = this.createDisplayConfig();
  }

  /**
   * Create display configuration with Clunkers theme
   */
  private createDisplayConfig(): DisplayConfig {
    return {
      colors: {
        primary: '#00D9FF',     // Neon blue (lightning)
        secondary: '#2C2F33',   // Dark gray
        success: '#00FF88',     // Neon green
        warning: '#FFD700',     // Gold
        error: '#FF6B6B',       // Red
        muted: '#99AAB5'        // Light gray
      },
      symbols: {
        bullet: '•',
        arrow: '→',
        check: '✅',
        cross: '❌',
        loading: '🔄'
      },
      truncateLength: {
        address: 10,
        hash: 8
      }
    };
  }

  /**
   * Start the CLI interface
   */
  public async start(): Promise<void> {
    this.isRunning = true;
    
    // Display banner
    this.displayBanner();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
    
    // Check for existing profiles
    await this.checkExistingProfiles();
    
    // Main CLI loop
    while (this.isRunning) {
      try {
        await this.showMainMenu();
      } catch (error) {
        console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
        
        const { continueChoice } = await inquirer.prompt([{
          type: 'confirm',
          name: 'continueChoice',
          message: 'Continue?',
          default: true
        }]);
        
        if (!continueChoice) {
          this.isRunning = false;
        }
      }
    }
    
    await this.cleanup();
  }

  /**
   * Display Clunkers banner
   */
  private displayBanner(): void {
    console.clear();
    console.log(chalk.hex(this.displayConfig.colors.primary)(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║      ██████╗██╗     ██╗   ██╗███╗   ██╗██╗  ██╗███████╗██████╗║
  ║     ██╔════╝██║     ██║   ██║████╗  ██║██║ ██╔╝██╔════╝██╔══██║
  ║     ██║     ██║     ██║   ██║██╔██╗ ██║█████╔╝ █████╗  ██████╔╝
  ║     ██║     ██║     ██║   ██║██║╚██╗██║██╔═██╗ ██╔══╝  ██╔══██║
  ║     ╚██████╗███████╗╚██████╔╝██║ ╚████║██║  ██╗███████╗██║  ██║
  ║      ╚═════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
  ║                                                               ║
  ║           ${chalk.gray('FlashNet Token Sniper - Dark. Technical. Fast.')}           ║
  ╚═══════════════════════════════════════════════════════════════╝
    `));
  }

  /**
   * Check for existing profiles on startup
   */
  private async checkExistingProfiles(): Promise<void> {
    const result = await this.commandHandler.listProfiles();
    
    if (result.success && result.data && result.data.length > 0) {
      console.log(chalk.gray('Found existing profiles:'));
      this.displayProfiles(result.data);
      console.log();
    }
  }

  /**
   * Show main menu
   */
  private async showMainMenu(): Promise<void> {
    this.displayStatus();
    
    const currentProfile = this.commandHandler.getCurrentProfile();
    const networkStatus = this.commandHandler.getNetworkStatus();
    
    const choices = [
      new inquirer.Separator(chalk.hex(this.displayConfig.colors.primary)('═══ PROFILE MANAGEMENT ═══')),
      { name: '📁 Create Profile', value: 'create-profile' },
      { name: '🔄 Switch Profile', value: 'switch-profile' },
      { name: '📋 List Profiles', value: 'list-profiles' },
      { name: '🗑️  Delete Profile', value: 'delete-profile' },
      
      new inquirer.Separator(chalk.hex(this.displayConfig.colors.primary)('═══ SNIPE MANAGEMENT ═══')),
      { name: '📍 Add Snipe', value: 'add-snipe', disabled: !currentProfile },
      { name: '📊 List Snipes', value: 'list-snipes', disabled: !currentProfile },
      { name: '💰 Show Wallet Addresses', value: 'show-wallets', disabled: !currentProfile },
      { name: '🔀 Toggle Snipe', value: 'toggle-snipe', disabled: !currentProfile },
      { name: '🗑️  Remove Snipe', value: 'remove-snipe', disabled: !currentProfile },
      { name: '🧪 Test Snipe (REGTEST)', value: 'test-snipe', disabled: !currentProfile },
      
      new inquirer.Separator(chalk.hex(this.displayConfig.colors.primary)('═══ MONITORING ═══')),
      { name: '🔍 Start Monitoring', value: 'start-monitoring', disabled: !currentProfile },
      { name: '⏹️  Stop Monitoring', value: 'stop-monitoring', disabled: !networkStatus.data?.isMonitoring },
      { name: '📊 Network Status', value: 'network-status' },
      
      new inquirer.Separator(chalk.hex(this.displayConfig.colors.primary)('═══ SYSTEM ═══')),
      { name: '❌ Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Select action:',
      choices,
      pageSize: 20
    }]);

    await this.handleAction(action);
  }

  /**
   * Display current status
   */
  private displayStatus(): void {
    const currentProfile = this.commandHandler.getCurrentProfile();
    const networkStatus = this.commandHandler.getNetworkStatus();
    const status = networkStatus.data;

    console.clear();
    this.displayBanner();

    // Profile status
    if (currentProfile) {
      const activeSnipes = currentProfile.snipes.filter(s => s.isActive).length;
      const totalSnipes = currentProfile.snipes.length;
      
      console.log(chalk.hex(this.displayConfig.colors.primary)('Profile:'), chalk.cyan(currentProfile.name));
      console.log(chalk.gray('Snipes:'), `${chalk.green(activeSnipes)} active / ${chalk.gray(totalSnipes)} total`);
    } else {
      console.log(chalk.yellow('⚠️  No profile selected'));
    }

    // Network status
    const networkColor = status?.isOnline ? this.displayConfig.colors.success : this.displayConfig.colors.error;
    const networkIcon = status?.isOnline ? '🟢' : '🔴';
    const monitoringStatus = status?.isMonitoring ? chalk.yellow('MONITORING') : chalk.gray('IDLE');
    
    console.log(chalk.gray('Network:'), `${networkIcon} ${chalk.hex(networkColor)(status?.network || 'UNKNOWN')} ${monitoringStatus}`);
    
    if (status?.latency) {
      console.log(chalk.gray('Latency:'), `${status.latency}ms`);
    }
    
    console.log();
  }

  /**
   * Handle menu actions
   */
  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case 'create-profile':
        await this.handleCreateProfile();
        break;
      case 'switch-profile':
        await this.handleSwitchProfile();
        break;
      case 'list-profiles':
        await this.handleListProfiles();
        break;
      case 'delete-profile':
        await this.handleDeleteProfile();
        break;
      case 'add-snipe':
        await this.handleAddSnipe();
        break;
      case 'list-snipes':
        await this.handleListSnipes();
        break;
      case 'show-wallets':
        await this.handleShowWallets();
        break;
      case 'toggle-snipe':
        await this.handleToggleSnipe();
        break;
      case 'remove-snipe':
        await this.handleRemoveSnipe();
        break;
      case 'test-snipe':
        await this.handleTestSnipe();
        break;
      case 'start-monitoring':
        await this.handleStartMonitoring();
        break;
      case 'stop-monitoring':
        await this.handleStopMonitoring();
        break;
      case 'network-status':
        await this.handleNetworkStatus();
        break;
      case 'exit':
        this.isRunning = false;
        break;
    }
  }

  /**
   * Handle create profile
   */
  private async handleCreateProfile(): Promise<void> {
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Profile name:',
      validate: (input) => {
        if (!input.trim()) return 'Profile name is required';
        if (input.length > 50) return 'Profile name too long';
        return true;
      }
    }]);

    const result = await this.commandHandler.createProfile(name.trim());
    this.displayResult(result);
    await this.pressAnyKey();
  }

  /**
   * Handle switch profile
   */
  private async handleSwitchProfile(): Promise<void> {
    const profilesResult = await this.commandHandler.listProfiles();
    
    if (!profilesResult.success || !profilesResult.data || profilesResult.data.length === 0) {
      console.log(chalk.yellow('No profiles available. Create one first.'));
      await this.pressAnyKey();
      return;
    }

    const choices = profilesResult.data.map((p: ProfileSummary) => ({
      name: `${p.name} (${p.activeSnipeCount}/${p.snipeCount} snipes)`,
      value: p.name
    }));

    const { profileName } = await inquirer.prompt([{
      type: 'list',
      name: 'profileName',
      message: 'Select profile:',
      choices
    }]);

    const result = await this.commandHandler.switchProfile(profileName);
    this.displayResult(result);
    await this.pressAnyKey();
  }

  /**
   * Handle list profiles
   */
  private async handleListProfiles(): Promise<void> {
    const result = await this.commandHandler.listProfiles();
    
    if (result.success && result.data) {
      this.displayProfiles(result.data);
    } else {
      this.displayResult(result);
    }
    
    await this.pressAnyKey();
  }

  /**
   * Handle delete profile
   */
  private async handleDeleteProfile(): Promise<void> {
    const profilesResult = await this.commandHandler.listProfiles();
    
    if (!profilesResult.success || !profilesResult.data || profilesResult.data.length === 0) {
      console.log(chalk.yellow('No profiles available.'));
      await this.pressAnyKey();
      return;
    }

    const choices = profilesResult.data.map((p: ProfileSummary) => ({
      name: p.name,
      value: p.name
    }));

    const { profileName } = await inquirer.prompt([{
      type: 'list',
      name: 'profileName',
      message: 'Select profile to delete:',
      choices
    }]);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete profile '${profileName}'?`,
      default: false
    }]);

    if (confirm) {
      const result = await this.commandHandler.deleteProfile(profileName);
      this.displayResult(result);
    } else {
      console.log(chalk.gray('Cancelled.'));
    }
    
    await this.pressAnyKey();
  }

  /**
   * Handle add snipe
   */
  private async handleAddSnipe(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'tokenAddress',
        message: 'Token address or pool ID:',
        validate: (input) => {
          if (!input.trim()) return 'Token address is required';
          return true;
        }
      },
      {
        type: 'input',
        name: 'amountBtc',
        message: 'BTC amount:',
        default: '0.05',
        validate: (input) => {
          const num = parseFloat(input);
          if (isNaN(num) || num <= 0) return 'Invalid amount';
          return true;
        }
      }
    ]);

    const result = await this.commandHandler.addSnipe(answers.tokenAddress.trim(), answers.amountBtc.trim());
    this.displayResult(result);
    await this.pressAnyKey();
  }

  /**
   * Handle list snipes
   */
  private async handleListSnipes(): Promise<void> {
    const result = await this.commandHandler.listSnipes();
    
    if (result.success && result.data) {
      this.displaySnipes(result.data);
    } else {
      this.displayResult(result);
    }
    
    await this.pressAnyKey();
  }

  /**
   * Handle show wallet addresses for funding
   */
  private async handleShowWallets(): Promise<void> {
    const snipesResult = await this.commandHandler.listSnipes();
    
    if (!snipesResult.success || !snipesResult.data || snipesResult.data.length === 0) {
      console.log(chalk.yellow('No snipes configured. Add snipes first to generate wallets.'));
      await this.pressAnyKey();
      return;
    }

    console.log(chalk.hex('#00D9FF')('\n💰 WALLET ADDRESSES FOR FUNDING\n'));
    console.log(chalk.yellow('⚠️  Send BTC to these addresses before starting mainnet monitoring!\n'));

    const snipes = snipesResult.data as Snipe[];
    const currentProfile = this.commandHandler.getCurrentProfile();
    const network = currentProfile?.settings.network || 'REGTEST';
    
    console.log(chalk.gray(`Network: ${network}\n`));
    
    snipes.forEach((snipe: Snipe, index: number) => {
      const status = snipe.isActive ? chalk.green('✅ ACTIVE') : chalk.gray('⏸️  INACTIVE');
      console.log(chalk.hex('#00D9FF')(`═══ Snipe #${index + 1} ${status} ═══`));
      console.log(chalk.gray('Token:'), chalk.yellow(snipe.tokenAddress.substring(0, 20) + '...'));
      console.log(chalk.gray('Amount:'), chalk.green(`${snipe.amountBtc} BTC`));
      
      // Show Spark address
      console.log(chalk.gray('Spark:'), chalk.cyan(snipe.walletAddress));
      
      // Show Bitcoin address if available
      if (snipe.bitcoinAddress) {
        console.log(chalk.gray('Bitcoin:'), chalk.hex('#FFA500')(snipe.bitcoinAddress));
        console.log(chalk.dim('        ↑ Fund this address with BTC'));
      } else {
        console.log(chalk.yellow('Bitcoin: Not available (regenerate wallet)'));
      }
      
      console.log(chalk.gray('Status:'), snipe.status);
      console.log();
    });

    console.log(chalk.hex('#00D9FF')('═'.repeat(50)));
    console.log(chalk.yellow('\n📝 IMPORTANT:'));
    console.log(chalk.gray('• Fund the ') + chalk.hex('#FFA500')('Bitcoin (bcrt1p...)') + chalk.gray(' addresses with BTC'));
    console.log(chalk.gray('• Each snipe has its own dedicated wallet'));
    console.log(chalk.gray('• Fund each wallet with the BTC amount + gas fees'));
    console.log(chalk.gray('• Wallets are encrypted and stored securely'));
    console.log(chalk.gray(`• Currently on ${network} network\n`));

    await this.pressAnyKey();
  }

  /**
   * Handle toggle snipe
   */
  private async handleToggleSnipe(): Promise<void> {
    const snipesResult = await this.commandHandler.listSnipes();
    
    if (!snipesResult.success || !snipesResult.data || snipesResult.data.length === 0) {
      console.log(chalk.yellow('No snipes configured.'));
      await this.pressAnyKey();
      return;
    }

    const choices = snipesResult.data.map((snipe: Snipe, index: number) => ({
      name: `${index + 1}. ${snipe.tokenAddress.substring(0, 10)}... → ${snipe.amountBtc} BTC ${snipe.isActive ? '✅' : '⏸️'}`,
      value: (index + 1).toString()
    }));

    const { snipeIndex } = await inquirer.prompt([{
      type: 'list',
      name: 'snipeIndex',
      message: 'Select snipe to toggle:',
      choices
    }]);

    const result = await this.commandHandler.toggleSnipe(snipeIndex);
    this.displayResult(result);
    await this.pressAnyKey();
  }

  /**
   * Handle remove snipe
   */
  private async handleRemoveSnipe(): Promise<void> {
    const snipesResult = await this.commandHandler.listSnipes();
    
    if (!snipesResult.success || !snipesResult.data || snipesResult.data.length === 0) {
      console.log(chalk.yellow('No snipes configured.'));
      await this.pressAnyKey();
      return;
    }

    const choices = snipesResult.data.map((snipe: Snipe, index: number) => ({
      name: `${index + 1}. ${snipe.tokenAddress.substring(0, 10)}... → ${snipe.amountBtc} BTC`,
      value: (index + 1).toString()
    }));

    const { snipeIndex } = await inquirer.prompt([{
      type: 'list',
      name: 'snipeIndex',
      message: 'Select snipe to remove:',
      choices
    }]);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to remove this snipe?',
      default: false
    }]);

    if (confirm) {
      const result = await this.commandHandler.removeSnipe(snipeIndex);
      this.displayResult(result);
    } else {
      console.log(chalk.gray('Cancelled.'));
    }
    
    await this.pressAnyKey();
  }

  /**
   * Handle test snipe
   */
  private async handleTestSnipe(): Promise<void> {
    const snipesResult = await this.commandHandler.listSnipes();
    
    if (!snipesResult.success || !snipesResult.data || snipesResult.data.length === 0) {
      console.log(chalk.yellow('No snipes configured.'));
      await this.pressAnyKey();
      return;
    }

    const choices = snipesResult.data.map((snipe: Snipe, index: number) => ({
      name: `${index + 1}. ${snipe.tokenAddress.substring(0, 10)}... → ${snipe.amountBtc} BTC`,
      value: (index + 1).toString()
    }));

    const { snipeIndex } = await inquirer.prompt([{
      type: 'list',
      name: 'snipeIndex',
      message: 'Select snipe to test:',
      choices
    }]);

    console.log(chalk.yellow('🧪 Testing snipe on REGTEST network...'));
    const result = await this.commandHandler.testSnipe(snipeIndex);
    this.displayResult(result);
    await this.pressAnyKey();
  }

  /**
   * Handle start monitoring
   */
  private async handleStartMonitoring(): Promise<void> {
    const result = await this.commandHandler.startMonitoring();
    this.displayResult(result);
    
    if (result.success) {
      await this.enterMonitoringMode();
    } else {
      await this.pressAnyKey();
    }
  }

  /**
   * Handle stop monitoring
   */
  private async handleStopMonitoring(): Promise<void> {
    const result = this.commandHandler.stopMonitoring();
    this.displayResult(result);
    await this.pressAnyKey();
  }

  /**
   * Handle network status
   */
  private async handleNetworkStatus(): Promise<void> {
    const result = this.commandHandler.getNetworkStatus();
    
    if (result.success && result.data) {
      console.log(chalk.hex(this.displayConfig.colors.primary)('Network Status:'));
      console.log(`  Network: ${result.data.network}`);
      console.log(`  Online: ${result.data.isOnline ? '✅' : '❌'}`);
      console.log(`  Monitoring: ${result.data.isMonitoring ? '🔍' : '⏸️'}`);
      console.log(`  Last Check: ${result.data.lastCheck}`);
      if (result.data.latency) {
        console.log(`  Latency: ${result.data.latency}ms`);
      }
    } else {
      this.displayResult(result);
    }
    
    await this.pressAnyKey();
  }

  /**
   * Enter monitoring mode
   */
  private async enterMonitoringMode(): Promise<void> {
    const networkDetector = this.commandHandler.getNetworkDetector();
    
    // Setup event listeners
    networkDetector.on('mainnet:online', (event: NetworkStatusEvent) => {
      console.log(chalk.green('🚀 MAINNET IS ONLINE! EXECUTING SNIPES...'));
      // TODO: Execute snipes
    });

    console.log(chalk.hex(this.displayConfig.colors.primary)('═══ MONITORING MODE ═══'));
    console.log(chalk.gray('Press \'q\' and Enter to quit monitoring'));
    
    const { quit } = await inquirer.prompt([{
      type: 'input',
      name: 'quit',
      message: 'Status: Monitoring...',
      validate: (input) => {
        if (input.toLowerCase() === 'q') {
          return true;
        }
        return 'Press \'q\' to quit monitoring';
      }
    }]);

    this.commandHandler.stopMonitoring();
  }

  /**
   * Display profiles
   */
  private displayProfiles(profiles: ProfileSummary[]): void {
    console.log(chalk.hex(this.displayConfig.colors.primary)('Profiles:'));
    
    for (const profile of profiles) {
      const statusIcon = profile.isLocked ? '🔒' : '📁';
      const snipeInfo = `${profile.activeSnipeCount}/${profile.snipeCount} snipes`;
      
      console.log(`  ${statusIcon} ${chalk.cyan(profile.name)} - ${chalk.gray(snipeInfo)}`);
    }
  }

  /**
   * Display snipes
   */
  private displaySnipes(snipes: Snipe[]): void {
    console.log(chalk.hex(this.displayConfig.colors.primary)('\n📊 CONFIGURED SNIPES\n'));
    
    for (let i = 0; i < snipes.length; i++) {
      const snipe = snipes[i]!;
      const statusIcon = snipe.isActive ? chalk.green('✅ ACTIVE') : chalk.gray('⏸️  INACTIVE');
      
      console.log(chalk.hex('#00D9FF')(`═══ Snipe #${i + 1} ${statusIcon} ═══`));
      console.log(chalk.gray('Token:'), chalk.yellow(snipe.tokenAddress.substring(0, 30) + '...'));
      console.log(chalk.gray('Amount:'), chalk.green(`${snipe.amountBtc} BTC`));
      console.log(chalk.gray('Wallet:'), chalk.cyan(snipe.walletAddress));
      console.log(chalk.gray('Status:'), snipe.status);
      if (snipe.lastTestedAt) {
        console.log(chalk.gray('Last tested:'), new Date(snipe.lastTestedAt).toLocaleString());
      }
      console.log();
    }
    
    if (snipes.length > 0) {
      console.log(chalk.yellow('💡 TIP: Use "💰 Show Wallet Addresses" to see funding instructions'));
    }
  }

  /**
   * Display command result
   */
  private displayResult(result: any): void {
    if (result.success) {
      if (result.message) {
        console.log(result.message);
      }
    } else {
      console.log(chalk.red('❌'), result.error || 'Command failed');
    }
  }

  /**
   * Wait for user input
   */
  private async pressAnyKey(): Promise<void> {
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Press Enter to continue...'
    }]);
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const cleanup = async () => {
      console.log(chalk.yellow('\n🛑 Shutting down...'));
      await this.cleanup();
      process.exit(0);
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGHUP', cleanup);
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    this.isRunning = false;
    await this.commandHandler.cleanup();
    console.log(chalk.gray('👋 Goodbye!'));
  }
}