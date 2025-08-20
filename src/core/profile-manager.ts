import path from 'path';
import { Profile, ProfileSettings, Snipe, ProfileLock } from '../types/profile';
import { ProfileSummary } from '../types/cli';
import { FileManager } from '../utils/file-manager';
import { LockManager } from '../utils/lock-manager';
import { ValidationService } from '../utils/validation';
import { EncryptionService } from '../utils/encryption';

export class ProfileManager {
  private profilesDir: string;
  private encryption: EncryptionService;

  constructor(baseDir: string) {
    this.profilesDir = path.join(baseDir, 'profiles');
    this.encryption = EncryptionService.getInstance();
    this.initializeProfilesDirectory();
  }

  /**
   * Initialize profiles directory
   */
  private async initializeProfilesDirectory(): Promise<void> {
    try {
      await FileManager.initializeProfilesDirectory(path.dirname(this.profilesDir));
    } catch (error) {
      console.error('Failed to initialize profiles directory:', error);
    }
  }

  /**
   * Create a new profile
   */
  public async createProfile(name: string, settings?: Partial<ProfileSettings>): Promise<Profile> {
    // Validate profile name
    const validation = ValidationService.validateProfileName(name);
    if (!validation.valid) {
      throw new Error(`Invalid profile name: ${validation.error}`);
    }

    // Check if profile already exists
    const exists = await this.profileExists(name);
    if (exists) {
      throw new Error(`Profile '${name}' already exists`);
    }

    try {
      // Create profile directory
      const profilePath = await FileManager.createProfileDirectory(this.profilesDir, name);

      // Create default profile configuration
      const defaultSettings: ProfileSettings = {
        defaultAmount: '0.05',
        maxRetries: 20,
        retryDelay: 2000,
        enableDiscordAlerts: true,
        slippageTolerance: 10,
        network: 'REGTEST',
        ...settings
      };

      const profile: Profile = {
        name,
        createdAt: new Date(),
        lastUsed: new Date(),
        snipes: [],
        settings: defaultSettings
      };

      // Save profile configuration
      await this.saveProfile(profile);

      console.log(`✅ Created profile: ${name}`);
      return profile;
    } catch (error) {
      throw new Error(`Failed to create profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load an existing profile
   */
  public async loadProfile(name: string): Promise<Profile | null> {
    const validation = ValidationService.validateProfileName(name);
    if (!validation.valid) {
      throw new Error(`Invalid profile name: ${validation.error}`);
    }

    try {
      const profilePath = this.getProfilePath(name);
      const configPath = FileManager.getConfigFilePath(profilePath);
      
      const config = await FileManager.readJsonFile<Profile>(configPath);
      if (!config) {
        return null;
      }

      // Convert date strings back to Date objects
      config.createdAt = new Date(config.createdAt);
      config.lastUsed = new Date(config.lastUsed);
      config.snipes = config.snipes.map(snipe => ({
        ...snipe,
        createdAt: new Date(snipe.createdAt),
        lastTestedAt: snipe.lastTestedAt ? new Date(snipe.lastTestedAt) : undefined,
        executedAt: snipe.executedAt ? new Date(snipe.executedAt) : undefined
      }));

      return config;
    } catch (error) {
      throw new Error(`Failed to load profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save profile configuration
   */
  public async saveProfile(profile: Profile): Promise<void> {
    try {
      const profilePath = this.getProfilePath(profile.name);
      const configPath = FileManager.getConfigFilePath(profilePath);
      
      // Update last used timestamp
      profile.lastUsed = new Date();

      // Create backup before saving
      await FileManager.backupFile(configPath);

      // Save configuration
      await FileManager.writeJsonFile(configPath, profile);

      // Clean up old backups
      await FileManager.cleanupBackups(configPath);
    } catch (error) {
      throw new Error(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a profile
   */
  public async deleteProfile(name: string): Promise<void> {
    const validation = ValidationService.validateProfileName(name);
    if (!validation.valid) {
      throw new Error(`Invalid profile name: ${validation.error}`);
    }

    try {
      const profilePath = this.getProfilePath(name);

      // Check if profile is locked
      const isLocked = await LockManager.isLocked(profilePath);
      if (isLocked) {
        throw new Error(`Cannot delete profile '${name}': profile is currently in use`);
      }

      // Delete profile directory
      await FileManager.deleteProfileDirectory(profilePath);
      
      console.log(`🗑️  Deleted profile: ${name}`);
    } catch (error) {
      throw new Error(`Failed to delete profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all profiles with summary information
   */
  public async listProfiles(): Promise<ProfileSummary[]> {
    try {
      const profileNames = await FileManager.listProfiles(this.profilesDir);
      const summaries: ProfileSummary[] = [];

      for (const name of profileNames) {
        try {
          const profile = await this.loadProfile(name);
          if (profile) {
            const profilePath = this.getProfilePath(name);
            const isLocked = await LockManager.isLocked(profilePath);
            const lockInfo = await LockManager.getLockInfo(profilePath);

            const summary: ProfileSummary = {
              name: profile.name,
              snipeCount: profile.snipes.length,
              activeSnipeCount: profile.snipes.filter(s => s.isActive).length,
              totalWallets: profile.snipes.length,
              fundedWallets: 0, // Will be calculated separately
              lastUsed: profile.lastUsed,
              isLocked,
              status: this.getProfileStatus(isLocked, lockInfo)
            };

            summaries.push(summary);
          }
        } catch (error) {
          console.warn(`Failed to load profile ${name}:`, error);
        }
      }

      return summaries.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    } catch (error) {
      throw new Error(`Failed to list profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add a snipe to a profile
   */
  public async addSnipe(profileName: string, tokenAddress: string, amountBtc: string): Promise<Snipe> {
    const profile = await this.loadProfile(profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    // Validate inputs
    const tokenValidation = ValidationService.validateTokenAddress(tokenAddress);
    if (!tokenValidation.valid) {
      throw new Error(`Invalid token address: ${tokenValidation.error}`);
    }

    const amountValidation = ValidationService.validateBTCAmount(amountBtc);
    if (!amountValidation.valid) {
      throw new Error(`Invalid BTC amount: ${amountValidation.error}`);
    }

    // Create new snipe
    const snipe: Snipe = {
      id: this.generateSnipeId(),
      tokenAddress: tokenAddress.trim(),
      amountBtc: amountBtc.trim().toLowerCase().replace(/btc$/, ''),
      walletAddress: '', // Will be populated when wallet is generated
      encryptedMnemonic: '', // Will be populated when wallet is generated
      isActive: true,
      createdAt: new Date(),
      status: 'CREATED'
    };

    // Add to profile
    profile.snipes.push(snipe);

    // Save profile
    await this.saveProfile(profile);

    console.log(`📍 Added snipe: ${tokenAddress.substring(0, 10)}... → ${amountBtc} BTC`);
    return snipe;
  }

  /**
   * Remove a snipe from a profile
   */
  public async removeSnipe(profileName: string, snipeId: string): Promise<void> {
    const profile = await this.loadProfile(profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    const snipeIndex = profile.snipes.findIndex(s => s.id === snipeId);
    if (snipeIndex === -1) {
      throw new Error('Snipe not found');
    }

    const snipe = profile.snipes[snipeIndex]!;
    profile.snipes.splice(snipeIndex, 1);

    await this.saveProfile(profile);

    console.log(`🗑️  Removed snipe: ${snipe.tokenAddress.substring(0, 10)}...`);
  }

  /**
   * Toggle snipe active state
   */
  public async toggleSnipe(profileName: string, snipeId: string): Promise<boolean> {
    const profile = await this.loadProfile(profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    const snipe = profile.snipes.find(s => s.id === snipeId);
    if (!snipe) {
      throw new Error('Snipe not found');
    }

    snipe.isActive = !snipe.isActive;
    await this.saveProfile(profile);

    console.log(`${snipe.isActive ? '✅' : '⏸️'} ${snipe.isActive ? 'Activated' : 'Deactivated'} snipe: ${snipe.tokenAddress.substring(0, 10)}...`);
    return snipe.isActive;
  }

  /**
   * Acquire lock for a profile
   */
  public async acquireLock(profileName: string): Promise<boolean> {
    const profilePath = this.getProfilePath(profileName);
    return await LockManager.acquireLock(profilePath, profileName);
  }

  /**
   * Release lock for a profile
   */
  public async releaseLock(profileName: string): Promise<boolean> {
    const profilePath = this.getProfilePath(profileName);
    return await LockManager.releaseLock(profilePath);
  }

  /**
   * Check if profile exists
   */
  public async profileExists(name: string): Promise<boolean> {
    const profilePath = this.getProfilePath(name);
    return await FileManager.pathExists(profilePath);
  }

  /**
   * Get profile directory path
   */
  public getProfilePath(name: string): string {
    return path.join(this.profilesDir, name);
  }

  /**
   * Setup graceful shutdown for a profile
   */
  public setupGracefulShutdown(profileName: string): void {
    const profilePath = this.getProfilePath(profileName);
    LockManager.setupGracefulShutdown(profilePath);
  }

  /**
   * Clean up stale locks across all profiles
   */
  public async cleanupStaleLocks(): Promise<number> {
    return await LockManager.cleanupStaleLocks(this.profilesDir);
  }

  /**
   * Generate unique snipe ID
   */
  private generateSnipeId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `snipe_${timestamp}_${random}`;
  }

  /**
   * Determine profile status based on lock state
   */
  private getProfileStatus(isLocked: boolean, lockInfo: ProfileLock | null): ProfileSummary['status'] {
    if (!isLocked) {
      return 'IDLE';
    }

    if (lockInfo) {
      // Could check lock timestamp or other factors to determine if monitoring, executing, etc.
      return 'MONITORING';
    }

    return 'LOCKED';
  }
}