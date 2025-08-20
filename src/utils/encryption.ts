import CryptoJS from 'crypto-js';
import crypto from 'crypto';

export class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: string;

  private constructor() {
    this.encryptionKey = this.getOrGenerateEncryptionKey();
  }

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  public encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(12); // GCM typically uses 12 bytes
      const salt = crypto.randomBytes(32);
      
      // Derive key using PBKDF2
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
      
      // Encrypt using AES-256-GCM with explicit IV - FIXED: Use createCipheriv
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from('clunkers-sniper'));
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine iv + salt + authTag + encrypted data
      const combined = Buffer.concat([
        iv,
        salt,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  public decrypt(encryptedData: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      // Extract components (12-byte IV for GCM)
      const iv = combined.subarray(0, 12);
      const salt = combined.subarray(12, 44);
      const authTag = combined.subarray(44, 60);
      const encrypted = combined.subarray(60);
      
      // Derive key using same parameters
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 100000, 32, 'sha256');
      
      // Decrypt using AES-256-GCM - FIXED: Use createDecipheriv
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(Buffer.from('clunkers-sniper'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt an object as JSON
   */
  public encryptObject<T>(obj: T): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt JSON back to object
   */
  public decryptObject<T>(encryptedData: string): T {
    const decryptedJson = this.decrypt(encryptedData);
    return JSON.parse(decryptedJson);
  }

  /**
   * Generate a cryptographically secure random string
   */
  public generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash data using SHA-256
   */
  public hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate if encrypted data can be decrypted
   */
  public validate(encryptedData: string): boolean {
    try {
      this.decrypt(encryptedData);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get or generate encryption key from environment or create new one
   */
  private getOrGenerateEncryptionKey(): string {
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (envKey && envKey.length >= 32) {
      return envKey;
    }
    
    // Generate new key if not provided
    const newKey = crypto.randomBytes(32).toString('hex');
    
    // Log warning about missing encryption key
    console.warn('⚠️  No ENCRYPTION_KEY found in environment. Generated new key.');
    console.warn('⚠️  Add this to your .env file:');
    console.warn(`ENCRYPTION_KEY=${newKey}`);
    
    return newKey;
  }

  /**
   * Securely clear sensitive data from memory
   */
  public clearFromMemory(data: string): void {
    // Overwrite string data (best effort in JavaScript)
    if (typeof data === 'string') {
      // This is a best-effort approach since JavaScript strings are immutable
      // In a production environment, consider using Buffer.alloc with explicit clearing
      data = '';
    }
  }
}

// Convenience functions for direct use
export const encrypt = (data: string): string => EncryptionService.getInstance().encrypt(data);
export const decrypt = (encryptedData: string): string => EncryptionService.getInstance().decrypt(encryptedData);
export const encryptObject = <T>(obj: T): string => EncryptionService.getInstance().encryptObject(obj);
export const decryptObject = <T>(encryptedData: string): T => EncryptionService.getInstance().decryptObject(encryptedData);
export const generateSecureRandom = (length?: number): string => EncryptionService.getInstance().generateSecureRandom(length);
export const hash = (data: string): string => EncryptionService.getInstance().hash(data);