export interface ICPProfileData {
  id: string;
  name: string;
  description: string;
  demographics: {
    ageRange: {
      primary: string;
      secondary: string;
    };
    gender: {
      distribution: string;
    };
    locations: Array<{
      type: string;
      name: string;
      relevance: string;
    }>;
    education: {
      primary: string;
      secondary: string[];
    };
    income: {
      currency: string;
      level: string;
      range: string;
    };
    languages: Array<{
      name: string;
      proficiency: string;
      relevance: string;
    }>;
  };
  psychographics: {
    values: Array<{
      name: string;
      importance: string;
      description: string;
    }>;
    interests: string[];
    goals: Array<{
      name: string;
      priority: string;
      description: string;
    }>;
    challenges: Array<{
      name: string;
      severity: string;
      description: string;
    }>;
    motivations: Array<{
      name: string;
      strength: string;
      description: string;
    }>;
  };
  behavioralTraits: {
    onlineBehavior: {
      deviceUsage: {
        primary: string;
        secondary: string;
        tertiary: string;
      };
      socialPlatforms: Array<{
        name: string;
        usageFrequency: string;
        engagementLevel: string;
        relevance: string;
      }>;
      browsingHabits: {
        peakHours: string[];
        contentPreferences: string[];
      };
    };
    purchasingBehavior: {
      decisionFactors: Array<{
        name: string;
        importance: string;
        description: string;
      }>;
      priceRange: {
        subscription: {
          monthly: {
            preference: string;
            optimal: string;
          };
          annual: {
            preference: string;
            optimal: string;
          };
        };
        oneTime: {
          preference: string;
          optimal: string;
        };
      };
      purchaseFrequency: {
        software: string;
        hardware: string;
        education: string;
      };
    };
    contentConsumption: {
      preferredFormats: Array<{
        type: string;
        preference: string;
        idealLength?: string;
        idealDuration?: string;
      }>;
      researchHabits: {
        depth: string;
        sources: string[];
        timeSpent: string;
      };
    };
  };
  professionalContext: {
    industries: string[];
    roles: Array<{
      title: string;
      relevance: string;
    }>;
    companySize: {
      primary: string;
      secondary: string[];
    };
    decisionMakingPower: {
      level: string;
      description: string;
    };
    painPoints: Array<{
      name: string;
      severity: string;
      description: string;
    }>;
    tools: {
      current: string[];
      desired: string[];
    };
  };
  customAttributes: Array<{
    name: string;
    value: string;
    description: string;
  }>;
}

export interface ICPAnalysisResponse {
  url: string;
  segment_id: string;
  profile: ICPProfileData;
  createdInDatabase: boolean;
  analysisMetadata: {
    modelUsed: string;
    aiProvider: string;
    confidenceLevel: string;
    analysisDate: string;
    processingTime: string;
    dataSourcesUsed: string[];
  };
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  icp?: {
    id: string;
    role?: string;
    company_size?: string;
    industry?: string;
    age_range?: string;
    pain_points?: string[];
    goals?: string[];
    budget?: string;
    decision_maker?: boolean;
    location?: string;
    experience?: string;
    profile?: ICPProfileData;
  };
} 