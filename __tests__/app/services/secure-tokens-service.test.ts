import { secureTokensService } from '../secure-tokens-service';
import fetch from 'jest-fetch-mock';

// Mock fetch globally
global.fetch = fetch as any;

describe('SecureTokensService', () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  it('should store a token successfully', async () => {
    fetch.mockResponseOnce(JSON.stringify({ success: true, tokenId: 'fake-uuid' }));

    const result = await secureTokensService.storeToken(
      'site-123', 
      'api',
      'test-token-value',
      'test-identifier'
    );

    expect(result).toBe('fake-uuid');
    expect(fetch).toHaveBeenCalledWith('/api/secure-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'store',
        siteId: 'site-123',
        tokenType: 'api',
        tokenValue: 'test-token-value',
        identifier: 'test-identifier'
      }),
      credentials: 'include'
    });
  });

  it('should handle errors when storing a token', async () => {
    fetch.mockResponseOnce(JSON.stringify({ error: 'Failed to store token' }), { status: 500 });

    const result = await secureTokensService.storeToken(
      'site-123', 
      'api',
      'test-token-value',
      'test-identifier'
    );

    expect(result).toBeNull();
  });

  it('should verify a token successfully', async () => {
    fetch.mockResponseOnce(JSON.stringify({ isValid: true }));

    const result = await secureTokensService.verifyToken(
      'site-123', 
      'api',
      'test-token-value',
      'test-identifier'
    );

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/secure-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'verify',
        siteId: 'site-123',
        tokenType: 'api',
        tokenValue: 'test-token-value',
        identifier: 'test-identifier'
      }),
      credentials: 'include'
    });
  });

  it('should handle errors when verifying a token', async () => {
    fetch.mockResponseOnce(JSON.stringify({ error: 'Failed to verify token' }), { status: 500 });

    const result = await secureTokensService.verifyToken(
      'site-123', 
      'api',
      'test-token-value',
      'test-identifier'
    );

    expect(result).toBe(false);
  });

  it('should check if a token exists', async () => {
    fetch.mockResponseOnce(JSON.stringify({ exists: true }));

    const result = await secureTokensService.hasToken(
      'site-123', 
      'api',
      'test-identifier'
    );

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/secure-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'check',
        siteId: 'site-123',
        tokenType: 'api',
        identifier: 'test-identifier'
      }),
      credentials: 'include'
    });
  });

  it('should delete a token successfully', async () => {
    fetch.mockResponseOnce(JSON.stringify({ success: true }));

    const result = await secureTokensService.deleteToken(
      'site-123', 
      'api',
      'test-identifier'
    );

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/secure-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: 'delete',
        siteId: 'site-123',
        tokenType: 'api',
        identifier: 'test-identifier'
      }),
      credentials: 'include'
    });
  });

  it('should handle getToken method properly (deprecated)', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    const result = await secureTokensService.getToken(
      'site-123', 
      'api',
      'test-identifier'
    );

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'getToken is deprecated with SHA-256 encryption. Use verifyToken instead.'
    );
    
    consoleSpy.mockRestore();
  });
}); 