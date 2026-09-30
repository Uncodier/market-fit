import { createClient } from "@/lib/supabase/client"
import { apiClient } from "@/app/services/api-client-service"
import type { AISegmentResponse, BuildExperimentsParams, BuildCampaignsParams, BuildContentParams } from "./ai-service-types"
import { isDemoModeActive } from "@/lib/demo-utils"
import { aiRequestState } from "./ai-request-state"

/**
 * Service to build experiments using AI
 */
export async function buildExperimentsWithAI(params: BuildExperimentsParams): Promise<AISegmentResponse> {
  // If a request is already in progress, return an error
  if (aiRequestState.inProgress && !(await isDemoModeActive())) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Mark that a request is in progress
  aiRequestState.inProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      aiRequestState.inProgress = false; // Release the lock
      return {
        success: false,
        error: "Authentication required. Please sign in to continue."
      };
    }
    
    // Prepare parameters according to the correct structure
    const requestParams = {
      // The URL should be the selected site URL or the one provided in the parameters
      url: params.url,
      experimentCount: params.experimentCount || 2, // Default to 2 experiments
      mode: params.mode || "create",
      provider: params.provider || "openai",
      modelId: params.modelId || "gpt-4o",
      includeScreenshot: params.includeScreenshot !== false,
      // Include user_id and site_id directly in the main object
      user_id: params.user_id,
      site_id: params.site_id,
      // Additional metadata if needed
      metadata: {
        // Any other metadata needed
      }
    };
    
    console.log("Calling AI service for experiments with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.post(
        '/api/site/experiments',
        requestParams
      );
      
      // Check if the response contains a non-empty 'errors' array
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        aiRequestState.inProgress = false; // Release the lock
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      aiRequestState.inProgress = false; // Release the lock
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          code: response.error?.code,
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError) {
      console.error("Network error in buildExperimentsWithAI:", fetchError);
      
      // Provide more detailed information about the network error
      let errorMessage = "Network error occurred while connecting to the server";
      let errorDetails = {};
      
      if (fetchError instanceof Error) {
        errorMessage = `Network error: ${fetchError.message}`;
        errorDetails = {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        };
        
        // Check if it's a CORS error or connection refused
        if (
          fetchError.message.includes('CORS') || 
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('Network request failed') ||
          fetchError.message.includes('Connection refused')
        ) {
          errorMessage = `Cannot connect to API server at ${apiClient.getApiUrl()}. Please check if the server is running and accessible.`;
        }
      }
      
      aiRequestState.inProgress = false; // Release the lock
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Include the API URL to help with debugging
      };
    }
  } catch (error) {
    console.error("Error in buildExperimentsWithAI:", error);
    aiRequestState.inProgress = false; // Release the lock
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Service to build campaigns using AI
 */
export async function buildCampaignsWithAI(params: BuildCampaignsParams): Promise<AISegmentResponse> {
  // If a request is already in progress, return an error
  if (aiRequestState.inProgress && !(await isDemoModeActive())) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Mark that a request is in progress
  aiRequestState.inProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      aiRequestState.inProgress = false; // Release the lock
      return {
        success: false,
        error: "Authentication required. Please sign in to continue."
      };
    }
    
    // Prepare parameters according to the correct structure
    const requestParams = {
      // The URL should be the selected site URL or the one provided in the parameters
      url: params.url,
      campaignCount: params.campaignCount || 3, // Default to 3 campaigns
      mode: params.mode || "create",
      provider: params.provider || "openai",
      modelId: params.modelId || "gpt-4o",
      includeScreenshot: params.includeScreenshot !== false,
      // Include user_id and site_id directly in the main object
      user_id: params.user_id,
      site_id: params.site_id,
      // Additional metadata if needed
      metadata: {
        // Any other metadata needed
      }
    };
    
    console.log("Calling AI service for campaigns with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.post(
        '/api/workflow/buildCampaigns',
        requestParams
      );
      
      // Check if the response contains a non-empty 'errors' array
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        aiRequestState.inProgress = false; // Release the lock
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      aiRequestState.inProgress = false; // Release the lock
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          code: response.error?.code,
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError) {
      console.error("Network error in buildCampaignsWithAI:", fetchError);
      
      // Provide more detailed information about the network error
      let errorMessage = "Network error occurred while connecting to the server";
      let errorDetails = {};
      
      if (fetchError instanceof Error) {
        errorMessage = `Network error: ${fetchError.message}`;
        errorDetails = {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        };
        
        // Check if it's a CORS error or connection refused
        if (
          fetchError.message.includes('CORS') || 
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('Network request failed') ||
          fetchError.message.includes('Connection refused')
        ) {
          errorMessage = `Cannot connect to API server at ${apiClient.getApiUrl()}. Please check if the server is running and accessible.`;
        }
      }
      
      aiRequestState.inProgress = false; // Release the lock
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Include the API URL to help with debugging
      };
    }
  } catch (error) {
    console.error("Error in buildCampaignsWithAI:", error);
    aiRequestState.inProgress = false; // Release the lock
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Service to build content using AI
 */
export async function buildContentWithAI(params: BuildContentParams): Promise<AISegmentResponse> {
  // If a request is already in progress, return an error
  if (aiRequestState.inProgress && !(await isDemoModeActive())) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Mark that a request is in progress
  aiRequestState.inProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      aiRequestState.inProgress = false; // Release the lock
      return {
        success: false,
        error: "Authentication required. Please sign in to continue."
      };
    }
    
    // Prepare parameters according to the correct structure
    const requestParams = {
      // The URL should be the selected site URL or the one provided in the parameters
      url: params.url,
      contentCount: params.contentCount || 3, // Default to 3 content pieces
      mode: params.mode || "create",
      provider: params.provider || "openai",
      modelId: params.modelId || "gpt-4o",
      includeScreenshot: params.includeScreenshot !== false,
      // Include user_id and site_id directly in the main object
      user_id: params.user_id,
      site_id: params.site_id,
      // Additional metadata if needed
      metadata: {
        // Any other metadata needed
      }
    };
    
    console.log("Calling AI service for content with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.post(
        '/api/workflow/buildContent',
        requestParams
      );
      
      // Check if the response contains a non-empty 'errors' array
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        aiRequestState.inProgress = false; // Release the lock
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      aiRequestState.inProgress = false; // Release the lock
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          code: response.error?.code,
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError) {
      console.error("Network error in buildContentWithAI:", fetchError);
      
      // Provide more detailed information about the network error
      let errorMessage = "Network error occurred while connecting to the server";
      let errorDetails = {};
      
      if (fetchError instanceof Error) {
        errorMessage = `Network error: ${fetchError.message}`;
        errorDetails = {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        };
        
        // Check if it's a CORS error or connection refused
        if (
          fetchError.message.includes('CORS') || 
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('Network request failed') ||
          fetchError.message.includes('Connection refused')
        ) {
          errorMessage = `Cannot connect to API server at ${apiClient.getApiUrl()}. Please check if the server is running and accessible.`;
        }
      }
      
      aiRequestState.inProgress = false; // Release the lock
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Include the API URL to help with debugging
      };
    }
  } catch (error) {
    console.error("Error in buildContentWithAI:", error);
    aiRequestState.inProgress = false; // Release the lock
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
