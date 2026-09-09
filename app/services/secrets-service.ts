export class SecretsService {
  private static instance: SecretsService;

  private constructor() {}

  static getInstance(): SecretsService {
    if (!SecretsService.instance) {
      SecretsService.instance = new SecretsService();
    }
    return SecretsService.instance;
  }

  async storeSecret(siteId: string, provider: string, useCase: string, name: string, secretValue: string): Promise<boolean> {
    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'store',
          siteId,
          provider,
          useCase,
          name,
          secretValue,
        }),
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Error storing secret:', error);
      return false;
    }
  }

  async checkSecretExists(siteId: string, provider: string, useCase: string): Promise<boolean> {
    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'check',
          siteId,
          provider,
          useCase,
        }),
      });

      const data = await response.json();
      return data.exists === true;
    } catch (error) {
      console.error('Error checking secret:', error);
      return false;
    }
  }

  async deleteSecret(siteId: string, provider: string, useCase: string): Promise<boolean> {
    try {
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'delete',
          siteId,
          provider,
          useCase,
        }),
      });

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Error deleting secret:', error);
      return false;
    }
  }
}

export const secretsService = SecretsService.getInstance();
