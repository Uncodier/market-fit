import { createClient } from "@/lib/supabase/client";

// Get API server URL from environment variables
const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '';

// Ensure URL has proper protocol
const getFullApiUrl = (baseUrl: string) => {
  if (!baseUrl) return '';
  
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl;
  }
  
  return `http://${baseUrl}`;
};

// Full URL with protocol
const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL);

// Log the API server URL in development
if (process.env.NODE_ENV === 'development') {
  console.log('API Server URL:', FULL_API_SERVER_URL);
}

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
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('No session found');
  }

  if (!FULL_API_SERVER_URL) {
    throw new Error('API server URL is not configured');
  }

  const API_URL = `${FULL_API_SERVER_URL}/api/keys`;
  
  // Log the full URL in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Making request to:', API_URL);
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      
      // If the response is HTML (error page)
      if (contentType && contentType.includes('text/html')) {
        const htmlContent = await response.text();
        console.error('Server returned HTML:', htmlContent);
        throw new Error('Server returned an HTML error page instead of JSON');
      }
      
      // Try to parse as JSON, but handle text responses too
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `Server error: ${response.status} ${response.statusText}`);
      } catch (parseError) {
        const textContent = await response.text();
        console.error('Server returned:', textContent);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('Error creating API key:', error);
    throw error;
  }
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