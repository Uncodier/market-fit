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

export interface TeamInvitationParams {
  email: string;
  role: string;
  name?: string;
  position?: string;
  siteId: string;
  siteName: string;
}

export interface TeamInvitationPayload {
  siteId: string;
  siteName: string;
  teamMembers: Array<{
    email: string;
    role: string;
    name?: string;
    position?: string;
  }>;
}

export interface TeamInvitationResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Send team member invitation via external API
 * @param params - Invitation parameters
 * @returns Promise with invitation result
 */
export async function sendTeamInvitation(params: TeamInvitationParams): Promise<TeamInvitationResponse> {
  try {
    // Get Supabase session for authentication
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No authentication session found');
    }

    if (!FULL_API_SERVER_URL) {
      throw new Error('API server URL is not configured');
    }

    const API_URL = `${FULL_API_SERVER_URL}/api/teamMembers/invite`;
    
    // Create the payload structure expected by the API
    const payload: TeamInvitationPayload = {
      siteId: params.siteId,
      siteName: params.siteName,
      teamMembers: [
        {
          email: params.email,
          role: params.role,
          name: params.name,
          position: params.position
        }
      ]
    };
    
    // Log the request in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Sending team invitation to:', API_URL);
      console.log('Invitation payload:', { 
        ...payload, 
        teamMembers: payload.teamMembers.map(m => ({ ...m, email: '***@***' }))
      }); // Hide emails in logs
    }

    // Make the API call
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
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
    
    if (data.success) {
      return {
        success: true,
        message: data.message || 'Invitation sent successfully'
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to send invitation'
      };
    }

  } catch (error) {
    console.error('Error sending team invitation:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 