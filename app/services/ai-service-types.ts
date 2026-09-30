// Interfaz para la respuesta de la API
export interface AISegmentResponse {
  success: boolean;
  message?: string;
  segments?: any[];
  error?: string;
  code?: string;
  jobId?: string;
  rawResponse?: string;
  details?: any;
  data?: any;
  apiUrl?: string; // URL de la API para ayudar en la depuración
}

// Interfaz para los parámetros de la solicitud
export interface BuildSegmentsParams {
  url?: string;
  segmentCount?: number;
  mode?: 'create' | 'analyze' | 'update';
  analysisType?: 'general' | 'icp' | 'topics';
  provider?: string;
  modelId?: string;
  includeScreenshot?: boolean;
  user_id: string;
  site_id: string;
  segment_id?: string;
}

/**
 * Interface for build experiments parameters
 */
export interface BuildExperimentsParams {
  url?: string;
  experimentCount?: number;
  mode?: 'create' | 'analyze' | 'update';
  provider?: string;
  modelId?: string;
  includeScreenshot?: boolean;
  user_id: string;
  site_id: string;
}

/**
 * Interface for build campaigns parameters
 */
export interface BuildCampaignsParams {
  url?: string;
  campaignCount?: number;
  mode?: 'create' | 'analyze' | 'update';
  provider?: string;
  modelId?: string;
  includeScreenshot?: boolean;
  user_id: string;
  site_id: string;
}

/**
 * Interface for build content parameters
 */
export interface BuildContentParams {
  url?: string;
  contentCount?: number;
  mode?: 'create' | 'analyze' | 'update';
  provider?: string;
  modelId?: string;
  includeScreenshot?: boolean;
  user_id: string;
  site_id: string;
}
