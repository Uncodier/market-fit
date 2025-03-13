import { ICPAnalysisResponse, ICPProfileData } from "./types";

export const sampleICPProfile: ICPProfileData = {
  id: "icp_47f14b99-cfe9-4269-aad2-6ae50161de99_m86ln584",
  name: "Business Leaders and Executives",
  description: "Executives and business leaders seeking AI-powered solutions to optimize business management and operations",
  demographics: {
    ageRange: {
      primary: "35-50",
      secondary: "30-55"
    },
    gender: {
      distribution: "Balanced with slight male majority"
    },
    locations: [
      {
        type: "region",
        name: "North America",
        relevance: "High"
      },
      {
        type: "region",
        name: "Europe",
        relevance: "High"
      },
      {
        type: "region",
        name: "Latin America",
        relevance: "Medium"
      }
    ],
    education: {
      primary: "Master's Degree",
      secondary: [
        "Bachelor's Degree",
        "Doctorate"
      ]
    },
    income: {
      currency: "USD",
      level: "High",
      range: "100,000-250,000 annually"
    },
    languages: [
      {
        name: "English",
        proficiency: "Native",
        relevance: "Very high"
      },
      {
        name: "Spanish",
        proficiency: "Intermediate-advanced",
        relevance: "High"
      }
    ]
  },
  psychographics: {
    values: [
      {
        name: "Efficiency",
        importance: "Very high",
        description: "Value optimizing operations to achieve better results"
      },
      {
        name: "Innovation",
        importance: "High",
        description: "Appreciate adopting new technologies and approaches"
      },
      {
        name: "Leadership",
        importance: "High",
        description: "Seek to lead their teams effectively and with vision"
      },
      {
        name: "Results-driven",
        importance: "High",
        description: "Focus on achieving tangible business outcomes"
      }
    ],
    interests: [
      "Business management",
      "Artificial intelligence",
      "Automation",
      "Leadership development",
      "Productivity tools"
    ],
    goals: [
      {
        name: "Operational efficiency",
        priority: "High",
        description: "Streamline operations to reduce costs and increase productivity"
      },
      {
        name: "Scalability",
        priority: "High",
        description: "Grow the business sustainably and efficiently"
      },
      {
        name: "Employee performance",
        priority: "Medium",
        description: "Enhance the performance and satisfaction of their teams"
      },
      {
        name: "Strategic decision-making",
        priority: "Medium",
        description: "Make informed decisions based on accurate data"
      }
    ],
    challenges: [
      {
        name: "Time management",
        severity: "High",
        description: "Balancing multiple responsibilities and tasks effectively"
      },
      {
        name: "Technology integration",
        severity: "High",
        description: "Seamlessly integrating new technologies into existing systems"
      },
      {
        name: "Data overload",
        severity: "Medium",
        description: "Managing and making sense of large volumes of data"
      }
    ],
    motivations: [
      {
        name: "Business growth",
        strength: "High",
        description: "Desire to expand and grow their business successfully"
      },
      {
        name: "Innovation leadership",
        strength: "Medium-high",
        description: "Drive to be at the forefront of industry innovation"
      },
      {
        name: "Operational excellence",
        strength: "Very high",
        description: "Achieve high levels of efficiency and effectiveness in operations"
      }
    ]
  },
  behavioralTraits: {
    onlineBehavior: {
      deviceUsage: {
        primary: "Desktop",
        secondary: "Mobile",
        tertiary: "Tablet"
      },
      socialPlatforms: [
        {
          name: "LinkedIn",
          usageFrequency: "Daily",
          engagementLevel: "High",
          relevance: "Very high"
        },
        {
          name: "Twitter",
          usageFrequency: "Weekly",
          engagementLevel: "Medium",
          relevance: "High"
        },
        {
          name: "Facebook",
          usageFrequency: "Weekly",
          engagementLevel: "Medium",
          relevance: "Medium-high"
        }
      ],
      browsingHabits: {
        peakHours: [
          "Morning (6:00-9:00)",
          "Afternoon (12:00-14:00)"
        ],
        contentPreferences: [
          "Industry news",
          "Leadership articles",
          "Case studies"
        ]
      }
    },
    purchasingBehavior: {
      decisionFactors: [
        {
          name: "ROI",
          importance: "High",
          description: "Focus on the return on investment when making purchases"
        },
        {
          name: "Ease of Integration",
          importance: "High",
          description: "Prefer solutions that integrate smoothly with existing systems"
        },
        {
          name: "Scalability",
          importance: "Medium-high",
          description: "Value solutions that can scale with business growth"
        }
      ],
      priceRange: {
        subscription: {
          monthly: {
            preference: "100-500 USD",
            optimal: "Around 300 USD"
          },
          annual: {
            preference: "1000-5000 USD",
            optimal: "Around 3000 USD"
          }
        },
        oneTime: {
          preference: "500-3000 USD",
          optimal: "Around 1500 USD"
        }
      },
      purchaseFrequency: {
        software: "Semi-annually",
        hardware: "Annually",
        education: "Quarterly"
      }
    },
    contentConsumption: {
      preferredFormats: [
        {
          type: "Webinars",
          preference: "High",
          idealDuration: "30-60 minutes"
        },
        {
          type: "Whitepapers",
          preference: "Medium-high",
          idealLength: "10-20 pages"
        },
        {
          type: "Podcasts",
          preference: "Medium",
          idealDuration: "20-40 minutes"
        }
      ],
      researchHabits: {
        depth: "Deep",
        sources: [
          "Industry reports",
          "Expert opinions",
          "Case studies"
        ],
        timeSpent: "3-5 hours before important decisions"
      }
    }
  },
  professionalContext: {
    industries: [
      "Technology",
      "Finance",
      "Healthcare",
      "Manufacturing"
    ],
    roles: [
      {
        title: "CEO",
        relevance: "Very high"
      },
      {
        title: "COO",
        relevance: "High"
      },
      {
        title: "CIO",
        relevance: "Medium-high"
      },
      {
        title: "VP of Operations",
        relevance: "Medium"
      }
    ],
    companySize: {
      primary: "Medium (51-200)",
      secondary: [
        "Large (201-500)",
        "Enterprise (500+)"
      ]
    },
    decisionMakingPower: {
      level: "High",
      description: "Hold significant influence and final decision-making power"
    },
    painPoints: [
      {
        name: "Operational inefficiencies",
        severity: "High",
        description: "Struggle with optimizing processes for better efficiency"
      },
      {
        name: "Employee productivity",
        severity: "Medium",
        description: "Challenges in maintaining high levels of employee performance"
      },
      {
        name: "Data management",
        severity: "Medium",
        description: "Difficulties in managing and utilizing data effectively"
      }
    ],
    tools: {
      current: [
        "Microsoft Office Suite",
        "Salesforce",
        "Slack",
        "Zoom",
        "Asana"
      ],
      desired: [
        "AI-driven analytics tools",
        "Advanced CRM systems",
        "Automation platforms"
      ]
    }
  },
  customAttributes: [
    {
      name: "Technology adoption level",
      value: "Early majority",
      description: "Adopt new technologies after they have been tested by early adopters"
    },
    {
      name: "Communication style",
      value: "Formal and strategic",
      description: "Prefer structured and strategic communication"
    },
    {
      name: "Price sensitivity",
      value: "Low",
      description: "Willing to invest in high-quality solutions with proven ROI"
    },
    {
      name: "Specialization level",
      value: "High",
      description: "Possess deep expertise in their industry and role"
    }
  ]
};

export const sampleICPAnalysisResponse: ICPAnalysisResponse = {
  url: "https://partner.ceo",
  segment_id: "47f14b99-cfe9-4269-aad2-6ae50161de99",
  profile: sampleICPProfile,
  createdInDatabase: false,
  analysisMetadata: {
    modelUsed: "claude-3-5-sonnet-20240620",
    aiProvider: "openai",
    confidenceLevel: "High",
    analysisDate: "2025-03-13T00:16:57.652Z",
    processingTime: "49117 ms",
    dataSourcesUsed: [
      "Site content analysis",
      "Segment data"
    ]
  }
}; 