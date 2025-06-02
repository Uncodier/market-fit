import { createClient } from "@/lib/supabase/client";

// API key predeterminada para el cliente (en desarrollo)
const CLIENT_API_KEY = 'market-fit-dev-api-key';

export interface SecureToken {
  id: string;
  site_id: string;
  token_type: string;
  identifier: string;
  last_used?: string;
  created_at: string;
  updated_at: string;
}

export type TokenType = 'email' | 'whatsapp' | 'twilio_whatsapp' | 'api';

class SecureTokensService {
  private supabase: any;
  private apiKey: string;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSupabase();
    }
    
    // Usar la API key de las variables de entorno o la predeterminada
    this.apiKey = 
      (typeof window !== 'undefined' && (window as any).__API_KEY__) || 
      process.env.NEXT_PUBLIC_API_KEY || 
      CLIENT_API_KEY;
  }

  private async initSupabase() {
    if (!this.supabase) {
      this.supabase = createClient();
    }
  }

  /**
   * Store a token securely with SHA-256 encryption
   * @param siteId - The site ID
   * @param tokenType - Type of token (email, whatsapp, api)
   * @param tokenValue - The sensitive token value to encrypt
   * @param identifier - Human readable identifier (e.g. email address)
   * @returns The token ID if successful
   */
  async storeToken(
    siteId: string,
    tokenType: TokenType,
    tokenValue: string,
    identifier: string
  ): Promise<string | null> {
    try {
      console.log(`storeToken called: siteId=${siteId}, tokenType=${tokenType}, identifier=${identifier}`);
      
      // Enviar la solicitud con la API key
      const response = await fetch('/api/secure-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          operation: 'store',
          siteId,
          tokenType,
          tokenValue,
          identifier
        })
      });
      
      console.log(`storeToken response status: ${response.status}`);
      
      if (response.status === 401) {
        console.log('API Key authentication failed');
        return null;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error storing secure token:', errorData);
        return null;
      }
      
      const data = await response.json();
      console.log(`storeToken success, tokenId: ${data.tokenId}`);
      return data.tokenId;
    } catch (error) {
      console.error('Exception storing secure token:', error);
      return null;
    }
  }

  /**
   * Verify a token against stored hash (for SHA-256 tokens)
   * @param siteId - The site ID
   * @param tokenType - Type of token (email, whatsapp, api)
   * @param tokenValue - The value to verify against stored hash
   * @param identifier - The identifier for the token
   * @returns True if the token is valid
   */
  async verifyToken(
    siteId: string, 
    tokenType: TokenType,
    tokenValue: string,
    identifier: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/secure-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          operation: 'verify',
          siteId,
          tokenType,
          tokenValue,
          identifier
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error verifying secure token:', errorData);
        return false;
      }
      
      const data = await response.json();
      return data.isValid;
    } catch (error) {
      console.error('Exception verifying token:', error);
      return false;
    }
  }

  /**
   * Get a decrypted token value
   * Note: With SHA-256 encryption, we cannot retrieve original values
   * This method is maintained for backward compatibility but will return null
   * Use verifyToken() to check token validity instead
   * 
   * @param siteId - The site ID
   * @param tokenType - Type of token (email, whatsapp, api)
   * @param identifier - The identifier for the token
   * @returns Always returns null with SHA-256 encryption
   * @deprecated Use verifyToken instead
   */
  async getToken(
    siteId: string, 
    tokenType: TokenType, 
    identifier: string
  ): Promise<string | null> {
    console.warn('getToken is deprecated with SHA-256 encryption. Use verifyToken instead.');
    return null;
  }

  /**
   * Delete a token
   * @param siteId - The site ID
   * @param tokenType - Type of token (email, whatsapp, api)
   * @param identifier - The identifier for the token
   * @returns True if the token was deleted
   */
  async deleteToken(
    siteId: string, 
    tokenType: TokenType, 
    identifier: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/secure-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          operation: 'delete',
          siteId,
          tokenType,
          identifier
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error deleting secure token:', errorData);
        return false;
      }
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Exception deleting secure token:', error);
      return false;
    }
  }

  /**
   * Get all tokens for a site
   * @param siteId - The site ID
   * @param tokenType - Optional token type to filter by
   * @returns List of token metadata (without the encrypted values)
   */
  async getTokens(
    siteId: string, 
    tokenType?: TokenType
  ): Promise<SecureToken[]> {
    try {
      await this.initSupabase();
      
      let query = this.supabase
        .from('secure_tokens')
        .select('id, site_id, token_type, identifier, last_used, created_at, updated_at')
        .eq('site_id', siteId);
      
      if (tokenType) {
        query = query.eq('token_type', tokenType);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error listing secure tokens:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Exception listing secure tokens:', error);
      return [];
    }
  }

  /**
   * Check if the user is authenticated before attempting secure token operations
   * @returns True if authenticated
   * @deprecated No longer needed with API key authentication
   */
  async checkAuthentication(): Promise<boolean> {
    console.warn('checkAuthentication is deprecated. API key authentication is now used instead.');
    return true;
  }

  /**
   * Check if a token exists
   * @param siteId - The site ID
   * @param tokenType - Type of token
   * @param identifier - The identifier for the token
   * @returns True if the token exists
   */
  async hasToken(
    siteId: string, 
    tokenType: TokenType, 
    identifier: string
  ): Promise<boolean> {
    try {
      // Send request with API key
      const response = await fetch('/api/secure-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          operation: 'check',
          siteId,
          tokenType,
          identifier
        })
      });
      
      if (response.status === 401) {
        console.log('API Key authentication failed');
        return false;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error checking token existence:', errorData);
        return false;
      }
      
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Exception checking token existence:', error);
      return false;
    }
  }

  /**
   * Verify email credentials for a site
   * @param siteId - The site ID
   * @param email - The email identifier 
   * @param password - The password to verify
   * @returns True if credentials match
   */
  async verifyEmailPassword(siteId: string, email: string, password: string): Promise<boolean> {
    return this.verifyToken(siteId, 'email', password, email || 'default');
  }

  /**
   * Store email credentials securely with SHA-256
   * @param siteId - The site ID
   * @param email - The email address
   * @param password - The password to encrypt and store
   * @returns Success indicator
   */
  async storeEmailCredentials(siteId: string, email: string, password: string): Promise<boolean> {
    const result = await this.storeToken(siteId, 'email', password, email || 'default');
    return !!result;
  }

  /**
   * Verify WhatsApp token for a site
   * @param siteId - The site ID
   * @param token - The token to verify
   * @param phoneNumber - The phone number identifier (e.g., +1234567890)
   * @returns True if token is valid
   */
  async verifyWhatsAppToken(siteId: string, token: string, phoneNumber: string): Promise<boolean> {
    return this.verifyToken(siteId, 'twilio_whatsapp', token, phoneNumber);
  }

  /**
   * Store WhatsApp token securely with SHA-256
   * @param siteId - The site ID
   * @param token - The token to encrypt and store
   * @param phoneNumber - The phone number identifier (e.g., +1234567890)
   * @returns Success indicator
   */
  async storeWhatsAppToken(siteId: string, token: string, phoneNumber: string): Promise<boolean> {
    const result = await this.storeToken(siteId, 'twilio_whatsapp', token, phoneNumber);
    return !!result;
  }

  /**
   * Check if WhatsApp token exists for a site
   * @param siteId - The site ID
   * @param phoneNumber - The phone number identifier (e.g., +1234567890)
   * @returns True if token exists
   */
  async hasWhatsAppToken(siteId: string, phoneNumber: string): Promise<boolean> {
    return this.hasToken(siteId, 'twilio_whatsapp', phoneNumber);
  }

  /**
   * Check if email credentials exist for a site
   * @param siteId - The site ID
   * @param email - The email identifier
   * @returns True if credentials exist
   */
  async hasEmailCredentials(siteId: string, email: string): Promise<boolean> {
    return this.hasToken(siteId, 'email', email || 'default');
  }
}

export const secureTokensService = new SecureTokensService(); 