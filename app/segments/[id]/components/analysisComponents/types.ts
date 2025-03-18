import { Segment, AdPlatform } from "../../page";

// Define our new platform type
export type NewAdPlatformType = "googleAds" | "facebookAds" | "linkedInAds" | "tiktokAds";

// Copy states for the UI
export interface CopyStates {
  interests: boolean;
  demographics: boolean;
  behavior: boolean;
  regional: boolean;
}

// Age distribution data type
export interface AgeDistribution {
  age: string;
  percentage: number;
}

// Gender distribution data type
export interface GenderDistribution {
  gender: string;
  percentage: number;
  color: string;
}

// Performance metric data type
export interface PerformanceMetric {
  name: string;
  value: number;
  change: number;
  icon: React.ReactNode;
}

// Region data for map visualization
export interface RegionData {
  name: string;
  coordinates: [number, number];
  value: number;
  color: string;
}

// Audience profile data structure
export interface AudienceProfileData {
  adPlatforms: {
    googleAds?: {
      demographics?: {
        ageRanges?: string[];
        gender?: string[];
        parentalStatus?: string[];
        householdIncome?: string[];
      };
      interests?: string[];
      inMarketSegments?: string[];
      locations?: string[];
      geoTargeting?: {
        countries?: string[];
        regions?: string[];
        cities?: string[];
      };
    };
    facebookAds?: {
      demographics?: {
        age?: number[];
        education?: string[];
        generation?: string[];
      };
      interests?: string[];
      locations?: {
        countries?: string[];
        regions?: string[];
        cities?: string[];
        zips?: string[];
      };
      languages?: string[];
    };
    linkedInAds?: {
      demographics?: {
        age?: string[];
        education?: string[];
        jobExperience?: string[];
      };
      jobTitles?: string[];
      industries?: string[];
      companySize?: string[];
      locations?: {
        countries?: string[];
        regions?: string[];
        metropolitanAreas?: string[];
      };
    };
    tiktokAds?: {
      demographics?: {
        age?: string[];
        gender?: string[];
        location?: string[];
      };
      interests?: string[];
      behaviors?: string[];
      creatorCategories?: string[];
      locations?: {
        countries?: string[];
        regions?: string[];
        cities?: string[];
      };
      languages?: string[];
    };
  };
}

// Platform-specific behavior types
export interface GoogleBehavior {
  inMarketSegments: string[];
  interests: string[];
}

export interface FacebookBehavior {
  interests: string[];
  locations: string[];
}

export interface LinkedInBehavior {
  jobTitles: string[];
  industries: string[];
  companySize: string[];
}

export interface TikTokBehavior {
  interests: string[];
  behaviors: string[];
  creatorCategories: string[];
}

// Common props for all components
export interface AnalysisComponentProps {
  selectedAdPlatform: NewAdPlatformType;
  copyStates: CopyStates;
  copyToClipboard: (text: string, id: keyof CopyStates) => Promise<void>;
  isDarkMode: boolean;
} 