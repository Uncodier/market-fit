import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Copy, BarChart, Users, Globe, PieChart, TrendingUp, CheckCircle2, MessageSquare } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Segment, AdPlatform, getKeywords } from "../page"
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"
import { useTheme } from '@/app/context/ThemeContext'

// Updated dummy data for audience analysis based on the provided JSON
const dummyAudienceData = {
  audienceProfile: {
    adPlatforms: {
      googleAds: {
        demographics: {
          ageRanges: [
            "25-34",
            "35-44"
          ],
          gender: [
            "male",
            "female"
          ],
          parentalStatus: [
            "parent",
            "non-parent"
          ],
          householdIncome: [
            "top 20%",
            "top 30%"
          ]
        },
        interests: [
          "Artificial Intelligence",
          "Machine Learning",
          "Software Development",
          "Cloud Computing",
          "Tech Gadgets"
        ],
        inMarketSegments: [
          "Software Development Tools",
          "Cloud Services",
          "AI and Machine Learning Software",
          "Computer Hardware",
          "Developer Education"
        ],
        locations: [
          "United States",
          "Canada",
          "United Kingdom",
          "Australia"
        ],
        geoTargeting: {
          countries: [
            "US",
            "CA",
            "UK",
            "AU"
          ],
          regions: [
            "California",
            "New York",
            "Texas",
            "Ontario",
            "London"
          ],
          cities: [
            "San Francisco",
            "New York",
            "Los Angeles",
            "Toronto",
            "London"
          ]
        }
      },
      facebookAds: {
        demographics: {
          age: [
            25,
            26,
            27,
            28,
            29,
            30,
            31,
            32,
            33,
            34,
            35,
            36,
            37,
            38,
            39,
            40,
            41,
            42,
            43,
            44,
            45
          ],
          education: [
            "College grad",
            "In grad school",
            "Master's degree"
          ],
          generation: [
            "Millennials",
            "Gen X"
          ]
        },
        interests: [
          "Artificial Intelligence",
          "Machine Learning",
          "Software Engineering",
          "Tech startups",
          "Cloud Computing"
        ],
        locations: {
          countries: [
            "United States",
            "Canada",
            "United Kingdom",
            "Australia"
          ],
          regions: [
            "California",
            "New York",
            "Texas",
            "Florida",
            "Ontario"
          ],
          cities: [
            "Los Angeles",
            "New York",
            "Chicago",
            "Toronto",
            "London"
          ],
          zips: [
            "90210",
            "10001",
            "60601",
            "M5V",
            "SW1A"
          ]
        },
        languages: [
          "English"
        ]
      },
      linkedInAds: {
        demographics: {
          age: [
            "25-34",
            "35-54"
          ],
          education: [
            "Bachelor's Degree",
            "Master's Degree"
          ],
          jobExperience: [
            "Mid-Senior level",
            "Director"
          ]
        },
        jobTitles: [
          "Software Engineer",
          "AI Specialist",
          "Machine Learning Engineer",
          "Tech Lead",
          "Cloud Architect"
        ],
        industries: [
          "Information Technology",
          "Software Development",
          "Tech Startups",
          "Cloud Computing",
          "Artificial Intelligence"
        ],
        companySize: [
          "11-50",
          "51-200",
          "201-500"
        ],
        locations: {
          countries: [
            "United States",
            "Canada",
            "United Kingdom",
            "Australia"
          ],
          regions: [
            "West Coast",
            "East Coast",
            "Midwest",
            "Southeast"
          ],
          metropolitanAreas: [
            "San Francisco Bay Area",
            "Greater New York City Area",
            "Greater Los Angeles Area"
          ]
        }
      },
      tiktokAds: {
        demographics: {
          age: [
            "18-24",
            "25-34",
            "35-44"
          ],
          gender: [
            "male",
            "female"
          ],
          location: [
            "Urban areas",
            "Tech hubs"
          ]
        },
        interests: [
          "AI Development",
          "Machine Learning",
          "Software Engineering",
          "Tech Innovations",
          "Startup Culture"
        ],
        behaviors: [
          "App installs: Development tools",
          "Engagement: Tech tutorials",
          "Shopping: Tech gadgets",
          "Tech forum participants"
        ],
        creatorCategories: [
          "Tech Reviewers",
          "Software Developers",
          "AI Enthusiasts",
          "Tech Influencers"
        ],
        locations: {
          countries: [
            "United States",
            "Canada",
            "United Kingdom",
            "Australia"
          ],
          regions: [
            "California",
            "New York",
            "Texas",
            "Ontario",
            "London"
          ],
          cities: [
            "San Francisco",
            "New York",
            "Los Angeles",
            "Toronto",
            "London"
          ]
        },
        languages: [
          "English"
        ]
      }
    }
  }
}

// Definir tipo para los datos regionales
type RegionData = {
  name: string;
  coordinates: [number, number]; // Tupla de dos números
  value: number;
  color: string;
}

// Regional data for map visualization
const regionData: RegionData[] = [
  { name: "United States", coordinates: [-95.7129, 37.0902], value: 65, color: "#4338ca" },
  { name: "Canada", coordinates: [-106.3468, 56.1304], value: 45, color: "#6366f1" },
  { name: "United Kingdom", coordinates: [-3.4359, 55.3781], value: 30, color: "#8b5cf6" },
  { name: "Germany", coordinates: [10.4515, 51.1657], value: 25, color: "#a78bfa" },
  { name: "France", coordinates: [2.2137, 46.2276], value: 20, color: "#c4b5fd" },
  { name: "Australia", coordinates: [133.7751, -25.2744], value: 15, color: "#818cf8" }
]

// Performance metrics data
const performanceData = [
  { name: "Visitors", value: 125000, change: 12.5, icon: <Users className="h-4 w-4" /> },
  { name: "Clicks", value: 45000, change: 8.3, icon: <CheckCircle2 className="h-4 w-4" /> },
  { name: "Conversions", value: 3200, change: 15.7, icon: <MessageSquare className="h-4 w-4" /> },
  { name: "CTR", value: 3.6, change: -2.1, icon: <TrendingUp className="h-4 w-4" /> }
]

// Age distribution data
const ageDistributionData = [
  { age: "18-24", percentage: 35 },
  { age: "25-34", percentage: 45 },
  { age: "35-44", percentage: 15 },
  { age: "45-54", percentage: 3 },
  { age: "55+", percentage: 2 }
]

// Gender distribution data
const genderDistributionData = [
  { gender: "Female", percentage: 55, color: "#ec4899" },
  { gender: "Male", percentage: 42, color: "#3b82f6" },
  { gender: "Other", percentage: 3, color: "#10b981" }
]

interface SegmentAnalysisTabProps {
  segment: Segment
}

// Define our new platform type
type NewAdPlatformType = "googleAds" | "facebookAds" | "linkedInAds" | "tiktokAds";

// Mapping function to convert between new platform names and original ones
const mapPlatformToOriginal = (platform: NewAdPlatformType): AdPlatform => {
  switch (platform) {
    case "googleAds": return "google";
    case "facebookAds": return "facebook";
    case "linkedInAds": return "linkedin";
    case "tiktokAds": return "twitter"; // Mapping TikTok to Twitter for backward compatibility
    default: return platform as AdPlatform;
  }
};

// Definir tipos para los datos de comportamiento de cada plataforma
type GoogleBehavior = {
  inMarketSegments: string[];
  interests: string[];
}

type FacebookBehavior = {
  interests: string[];
  locations: {
    countries: string[];
    regions: string[];
    cities: string[];
    zips: string[];
  };
}

type LinkedInBehavior = {
  jobTitles: string[];
  industries: string[];
  companySize: string[];
}

type TwitterBehavior = {
  interests: string[];
  behaviors: string[];
  creatorCategories: string[];
}

export function SegmentAnalysisTab({ segment }: SegmentAnalysisTabProps) {
  const [selectedAdPlatform, setSelectedAdPlatform] = useState<NewAdPlatformType>("facebookAds")
  const [copyStates, setCopyStates] = useState({
    keywords: false,
    demographics: false,
    behavior: false,
    regional: false
  })
  const { isDarkMode } = useTheme()

  const handlePlatformChange = (platform: NewAdPlatformType) => {
    setSelectedAdPlatform(platform)
  }

  const copyToClipboard = async (text: string, id: keyof typeof copyStates) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStates(prev => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  // Get platform display name
  const getPlatformDisplayName = (platform: NewAdPlatformType): string => {
    switch (platform) {
      case "googleAds": return "Google";
      case "facebookAds": return "Facebook";
      case "linkedInAds": return "LinkedIn";
      case "tiktokAds": return "TikTok";
      default: return platform;
    }
  }

  // Get platform-specific data
  const platformData = dummyAudienceData.audienceProfile.adPlatforms[selectedAdPlatform]

  // Función para obtener datos específicos de Google
  const getGoogleBehavior = () => {
    if (selectedAdPlatform === 'googleAds') {
      return {
        inMarketSegments: dummyAudienceData.audienceProfile.adPlatforms.googleAds.inMarketSegments,
        interests: dummyAudienceData.audienceProfile.adPlatforms.googleAds.interests
      } as GoogleBehavior;
    }
    return null;
  }

  // Función para obtener datos específicos de Facebook
  const getFacebookBehavior = () => {
    if (selectedAdPlatform === 'facebookAds') {
      return {
        interests: dummyAudienceData.audienceProfile.adPlatforms.facebookAds.interests,
        locations: dummyAudienceData.audienceProfile.adPlatforms.facebookAds.locations
      } as FacebookBehavior;
    }
    return null;
  }

  // Función para obtener datos específicos de LinkedIn
  const getLinkedInBehavior = () => {
    if (selectedAdPlatform === 'linkedInAds') {
      return {
        jobTitles: dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.jobTitles,
        industries: dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.industries,
        companySize: dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.companySize
      } as LinkedInBehavior;
    }
    return null;
  }

  // Función para obtener datos específicos de Twitter/TikTok
  const getTikTokBehavior = () => {
    if (selectedAdPlatform === 'tiktokAds') {
      return {
        interests: dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.interests,
        behaviors: dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.behaviors,
        creatorCategories: dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.creatorCategories
      } as TwitterBehavior;
    }
    return null;
  }

  // Get keywords using the mapping function
  const getKeywordsForPlatform = () => {
    // Instead of using the imported getKeywords function, we'll use data from our JSON
    if (selectedAdPlatform === 'googleAds') {
      return [
        ...dummyAudienceData.audienceProfile.adPlatforms.googleAds.interests,
        ...dummyAudienceData.audienceProfile.adPlatforms.googleAds.inMarketSegments
      ];
    } else if (selectedAdPlatform === 'facebookAds') {
      return [
        ...dummyAudienceData.audienceProfile.adPlatforms.facebookAds.interests
      ];
    } else if (selectedAdPlatform === 'linkedInAds') {
      return [
        ...dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.jobTitles,
        ...dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.industries
      ];
    } else if (selectedAdPlatform === 'tiktokAds') {
      return [
        ...dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.interests,
        ...dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.behaviors
      ];
    }
    
    return [];
  }

  // Helper function to get age range display for the current platform
  const getAgeRangeDisplay = () => {
    if (selectedAdPlatform === 'googleAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.googleAds.demographics.ageRanges.join(', ');
    } else if (selectedAdPlatform === 'facebookAds') {
      const ages = dummyAudienceData.audienceProfile.adPlatforms.facebookAds.demographics.age;
      return `${Math.min(...ages)}-${Math.max(...ages)}`;
    } else if (selectedAdPlatform === 'linkedInAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.demographics.age.join(', ');
    } else if (selectedAdPlatform === 'tiktokAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.demographics.age.join(', ');
    }
    return 'N/A';
  }

  // Helper function to get gender display for the current platform
  const getGenderDisplay = () => {
    if (selectedAdPlatform === 'googleAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.googleAds.demographics.gender.join(', ');
    } else if (selectedAdPlatform === 'tiktokAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.demographics.gender.join(', ');
    }
    return 'N/A';
  }

  // Helper function to get interests for the current platform
  const getInterestsForPlatform = () => {
    if (selectedAdPlatform === 'googleAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.googleAds.interests;
    } else if (selectedAdPlatform === 'facebookAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.facebookAds.interests;
    } else if (selectedAdPlatform === 'linkedInAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.industries;
    } else if (selectedAdPlatform === 'tiktokAds') {
      return dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.interests;
    }
    return [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-2xl font-semibold">Audience Analysis</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Ad Platform</span>
            <Select
              value={selectedAdPlatform}
              onValueChange={(value: NewAdPlatformType) => handlePlatformChange(value)}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facebookAds">Facebook Ads</SelectItem>
                <SelectItem value="googleAds">Google Ads</SelectItem>
                <SelectItem value="linkedInAds">LinkedIn Ads</SelectItem>
                <SelectItem value="tiktokAds">TikTok Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Performance Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceData.map((metric, index) => (
          <Card key={index} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.name}</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {typeof metric.value === 'number' && metric.name === 'CTR' 
                      ? `${metric.value}%` 
                      : metric.value.toLocaleString()}
                  </h3>
                </div>
                <div className={`p-2 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  {metric.icon}
                </div>
              </div>
              <div className="mt-2 flex items-center">
                <span className={`text-sm font-medium ${metric.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metric.change >= 0 ? '+' : ''}{metric.change}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">vs last period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demographics Card */}
        <Card className="border-none shadow-sm">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Demographics</CardTitle>
                <CardDescription>
                  Audience demographics for {getPlatformDisplayName(selectedAdPlatform)} Ads
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const demographicsData = {
                    ageRange: getAgeRangeDisplay(),
                    gender: getGenderDisplay(),
                    interests: getInterestsForPlatform()
                  };
                  copyToClipboard(JSON.stringify(demographicsData, null, 2), 'demographics');
                }}
                className="flex items-center justify-center relative"
              >
                <div className="flex items-center justify-center min-w-0">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  <span>{copyStates.demographics ? "Copied!" : "Copy Demographics"}</span>
                </div>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Age Range</h4>
                  <p className="text-base font-medium">{getAgeRangeDisplay()}</p>
                  
                  <div className="mt-4 space-y-2">
                    {ageDistributionData.map((item, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{item.age}</span>
                          <span>{item.percentage}%</span>
                        </div>
                        <div className={`w-full h-2 rounded-full ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}>
                          <div 
                            className="h-full rounded-full bg-indigo-500" 
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Gender</h4>
                  <p className="text-base font-medium">{getGenderDisplay()}</p>
                  
                  <div className="mt-4">
                    <div className="flex h-4 mb-2">
                      {genderDistributionData.map((item, index) => (
                        <div 
                          key={index}
                          className="h-full rounded-sm first:rounded-l-full last:rounded-r-full"
                          style={{ 
                            width: `${item.percentage}%`, 
                            backgroundColor: item.color 
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs">
                      {genderDistributionData.map((item, index) => (
                        <div key={index} className="flex items-center">
                          <div 
                            className="w-2 h-2 rounded-full mr-1"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.gender} ({item.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Interests</h4>
                <div className="flex flex-wrap gap-2">
                  {getInterestsForPlatform().map((interest: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {interest}
                    </Badge>
                  )) || <p className="text-sm text-muted-foreground">No interests available</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Behavior Card */}
        <Card className="border-none shadow-sm">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Behavior</CardTitle>
                <CardDescription>
                  Audience behavior for {getPlatformDisplayName(selectedAdPlatform)} Ads
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  let behaviorData;
                  if (selectedAdPlatform === 'googleAds') {
                    behaviorData = {
                      inMarketSegments: getGoogleBehavior()?.inMarketSegments || [],
                      geoTargeting: dummyAudienceData.audienceProfile.adPlatforms.googleAds.geoTargeting
                    };
                  } else if (selectedAdPlatform === 'facebookAds') {
                    behaviorData = {
                      education: dummyAudienceData.audienceProfile.adPlatforms.facebookAds.demographics.education,
                      generation: dummyAudienceData.audienceProfile.adPlatforms.facebookAds.demographics.generation
                    };
                  } else if (selectedAdPlatform === 'linkedInAds') {
                    behaviorData = {
                      jobTitles: dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.jobTitles,
                      companySize: dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.companySize
                    };
                  } else if (selectedAdPlatform === 'tiktokAds') {
                    behaviorData = {
                      behaviors: dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.behaviors,
                      creatorCategories: dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.creatorCategories
                    };
                  }
                  copyToClipboard(JSON.stringify(behaviorData, null, 2), 'behavior');
                }}
                className="flex items-center justify-center relative"
              >
                <div className="flex items-center justify-center min-w-0">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  <span>{copyStates.behavior ? "Copied!" : "Copy Behavior"}</span>
                </div>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-6">
              {selectedAdPlatform === 'googleAds' && (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">In-Market Segments</h4>
                    <div className="space-y-2">
                      {getGoogleBehavior()?.inMarketSegments?.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          <p className="text-sm">{item}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No in-market segments available</p>}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Geo Targeting</h4>
                    <div className="flex flex-wrap gap-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.googleAds.geoTargeting.countries.map((item: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {item}
                        </Badge>
                      )) || <p className="text-sm text-muted-foreground">No geo targeting data available</p>}
                    </div>
                  </div>
                </>
              )}
              
              {selectedAdPlatform === 'facebookAds' && (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Education</h4>
                    <div className="space-y-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.facebookAds.demographics.education.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          <p className="text-sm">{item}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No education data available</p>}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Generation</h4>
                    <div className="space-y-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.facebookAds.demographics.generation.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          <p className="text-sm">{item}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No generation data available</p>}
                    </div>
                  </div>
                </>
              )}
              
              {selectedAdPlatform === 'linkedInAds' && (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Job Titles</h4>
                    <div className="space-y-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.jobTitles.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          <p className="text-sm">{item}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No job titles data available</p>}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Company Size</h4>
                    <div className="space-y-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.linkedInAds.companySize.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          <p className="text-sm">{item}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No company size data available</p>}
                    </div>
                  </div>
                </>
              )}
              
              {selectedAdPlatform === 'tiktokAds' && (
                <>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Behaviors</h4>
                    <div className="space-y-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.behaviors.map((item: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                          <p className="text-sm">{item}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground">No behaviors data available</p>}
                    </div>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Creator Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {dummyAudienceData.audienceProfile.adPlatforms.tiktokAds.creatorCategories.map((item: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {item}
                        </Badge>
                      )) || <p className="text-sm text-muted-foreground">No creator categories available</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keywords and Regional Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-lg">Keyword Analysis</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => copyToClipboard(getKeywordsForPlatform().join(", "), 'keywords')}
                className="flex items-center justify-center relative"
                disabled={getKeywordsForPlatform().length === 0}
              >
                <div className="flex items-center justify-center min-w-0">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  <span>
                    {copyStates.keywords ? "Copied!" : "Copy Keywords"}
                  </span>
                </div>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-medium text-base mb-3">
                  Keywords for {getPlatformDisplayName(selectedAdPlatform)} Ads
                </h3>
                <div className="flex flex-wrap gap-2">
                  {getKeywordsForPlatform().length > 0 ? (
                    getKeywordsForPlatform().map((keyword: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {keyword}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No keywords available for this platform</p>
                  )}
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-base">
                    Estimated SAM for Selection
                  </h3>
                  <div className="flex items-center">
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 dark:border-green-900 px-2 py-0.5 text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      <span>+12.5%</span>
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">
                      {selectedAdPlatform === 'googleAds' ? '2.4M' : 
                       selectedAdPlatform === 'facebookAds' ? '3.8M' : 
                       selectedAdPlatform === 'linkedInAds' ? '1.2M' : 
                       '4.5M'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Potential users</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                      <span className="text-xs font-medium">Current</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                      <span className="text-xs text-muted-foreground">Potential</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full" 
                      style={{ 
                        width: selectedAdPlatform === 'googleAds' ? '45%' : 
                               selectedAdPlatform === 'facebookAds' ? '65%' : 
                               selectedAdPlatform === 'linkedInAds' ? '25%' : 
                               '75%' 
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-muted-foreground">Market penetration</span>
                    <span className="text-xs font-medium">
                      {selectedAdPlatform === 'googleAds' ? '45%' : 
                       selectedAdPlatform === 'facebookAds' ? '65%' : 
                       selectedAdPlatform === 'linkedInAds' ? '25%' : 
                       '75%'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-medium">Segment Size</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Based on {getPlatformDisplayName(selectedAdPlatform)} data</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {selectedAdPlatform === 'googleAds' ? '$4.8B' : 
                         selectedAdPlatform === 'facebookAds' ? '$7.2B' : 
                         selectedAdPlatform === 'linkedInAds' ? '$2.4B' : 
                         '$9.0B'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">Estimated market value</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Regional Distribution</CardTitle>
                <CardDescription>
                  Geographic distribution of your audience
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const regionalData = {
                    regions: regionData.map(region => ({
                      name: region.name,
                      value: region.value
                    }))
                  };
                  copyToClipboard(JSON.stringify(regionalData, null, 2), 'regional');
                }}
                className="flex items-center justify-center relative"
              >
                <div className="flex items-center justify-center min-w-0">
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  <span>{copyStates.regional ? "Copied!" : "Copy Regional Data"}</span>
                </div>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[450px] w-full">
              <ComposableMap
                projectionConfig={{
                  scale: 140,
                }}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <Geographies geography="/world-110m.json">
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={isDarkMode ? "#334155" : "#f1f5f9"}
                        stroke={isDarkMode ? "#1e293b" : "#e2e8f0"}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: isDarkMode ? "#475569" : "#e2e8f0" },
                          pressed: { outline: "none" },
                        }}
                      />
                    ))
                  }
                </Geographies>
                {regionData.map(({ name, coordinates, value, color }) => (
                  <Marker key={name} coordinates={coordinates}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <circle
                            r={Math.max(value / 10, 3)}
                            fill={color}
                            stroke="#fff"
                            strokeWidth={1}
                            opacity={0.8}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm font-medium">{name}</div>
                          <div className="text-xs">{value}% of audience</div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Marker>
                ))}
              </ComposableMap>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              {regionData.map((region) => (
                <div key={region.name} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="text-xs">{region.name} ({region.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 