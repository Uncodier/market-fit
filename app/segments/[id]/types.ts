export type AdPlatform = "facebook" | "google" | "linkedin" | "tiktok"

export interface AdPlatformData {
  googleAds?: {
    demographics?: {
      ageRanges?: string[];
      gender?: string[];
    };
    interests?: string[];
    inMarketSegments?: string[];
    locations?: string[] | {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
    geoTargeting?: {
      countries: string[];
      regions: string[];
      cities: string[];
    };
  };
  facebookAds?: {
    demographics?: {
      age?: number[] | string[];
      gender?: string[];
    };
    interests?: string[];
    locations?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
  };
  linkedInAds?: {
    demographics?: {
      age?: string[];
      gender?: string[];
    };
    industries?: string[];
    jobTitles?: string[];
    locations?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
  };
  tiktokAds?: {
    demographics?: {
      age?: string[];
      gender?: string[];
    };
    interests?: string[];
    behaviors?: string[];
    creatorCategories?: string[];
    locations?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
  };
}

export interface AudienceProfileData {
  adPlatforms: AdPlatformData;
  [key: string]: any;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  audience: string | null;
  language: string | null;
  size: string | null;
  engagement: number | null;
  created_at: string;
  url: string | null;
  analysis: any;
  topics: {
    blog: string[];
    newsletter: string[];
  } | null;
  is_active: boolean;
  estimated_value: number | null;
  icp: any;
}
