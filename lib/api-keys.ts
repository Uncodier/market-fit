import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/app/services/api-client-service";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: 'active' | 'expired' | 'revoked';
  scopes: string[];
  site_id: string;
  user_id: string;
  key_hash: string;
  last_used_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  metadata: {
    rate_limits?: {
      requests_per_minute?: number;
      concurrent_requests?: number;
    };
    allowed_ips?: string[];
  } | null;
}

export interface CreateApiKeyParams {
  name: string;
  scopes: string[];
  site_id: string;
  user_id: string;
  expirationDays?: number;
  prefix?: string;
  metadata?: {
    rate_limits?: {
      requests_per_minute?: number;
      concurrent_requests?: number;
    };
    allowed_ips?: string[];
  };
}

export interface CreateApiKeyResponse {
  apiKey: string;
  id: string;
  prefix: string;
  expires_at: string;
}

export async function createApiKey(params: CreateApiKeyParams): Promise<CreateApiKeyResponse> {
  const response = await apiClient.post<CreateApiKeyResponse>('/api/keys', params);

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to create API key');
  }

  return response.data!;
}

export async function listApiKeys(siteId: string): Promise<ApiKey[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function revokeApiKey(keyId: string, siteId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from('api_keys')
    .update({ 
      status: 'revoked',
      updated_at: new Date().toISOString()
    })
    .eq('id', keyId)
    .eq('site_id', siteId);

  if (error) {
    throw new Error(error.message);
  }
} 