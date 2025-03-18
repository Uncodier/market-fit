import { Users, CheckCircle2, MessageSquare, TrendingUp } from "@/app/components/ui/icons";
import { AgeDistribution, GenderDistribution, PerformanceMetric, RegionData } from "./types";
import React from "react";

// Updated dummy data for audience analysis based on the provided JSON
export const dummyAudienceData = {
  audienceProfile: {
    adPlatforms: {
      googleAds: {
        demographics: {
          ageRanges: [
            "18-24",
            "45-54"
          ],
          gender: [
            "female",
            "male"
          ],
          parentalStatus: [
            "non-parent",
            "parent"
          ],
          householdIncome: [
            "middle 50%",
            "top 10%"
          ]
        },
        interests: [
          "Digital Marketing",
          "E-commerce",
          "Online Shopping",
          "Social Media",
          "Mobile Apps"
        ],
        inMarketSegments: [
          "Marketing Software",
          "E-commerce Platforms",
          "Digital Advertising Tools",
          "Social Media Management",
          "Business Analytics"
        ],
        locations: [
          "Japan",
          "Germany",
          "Brazil",
          "Spain"
        ],
        geoTargeting: {
          countries: [
            "JP",
            "DE",
            "BR",
            "ES"
          ],
          regions: [
            "Tokyo",
            "Bavaria",
            "São Paulo",
            "Catalonia",
            "Madrid"
          ],
          cities: [
            "Tokyo",
            "Munich",
            "São Paulo",
            "Barcelona",
            "Madrid"
          ]
        }
      },
      facebookAds: {
        demographics: {
          age: [
            18,
            19,
            20,
            21,
            22,
            23,
            24,
            45,
            46,
            47,
            48,
            49,
            50,
            51,
            52,
            53,
            54
          ],
          education: [
            "High school",
            "Some college",
            "Doctorate degree"
          ],
          generation: [
            "Gen Z",
            "Baby Boomers"
          ]
        },
        interests: [
          "Online Shopping",
          "Digital Marketing",
          "E-commerce",
          "Social Media Marketing",
          "Business Analytics"
        ],
        locations: {
          countries: [
            "Japan",
            "Germany",
            "Brazil",
            "Spain"
          ],
          regions: [
            "Tokyo",
            "Bavaria",
            "São Paulo",
            "Catalonia",
            "Madrid"
          ],
          cities: [
            "Tokyo",
            "Munich",
            "São Paulo",
            "Barcelona",
            "Madrid"
          ],
          zips: [
            "100-0001",
            "80331",
            "01000-000",
            "08001",
            "28001"
          ]
        },
        languages: [
          "Japanese",
          "German",
          "Portuguese",
          "Spanish"
        ]
      },
      linkedInAds: {
        demographics: {
          age: [
            "18-24",
            "45-54"
          ],
          education: [
            "High School",
            "Doctorate"
          ],
          jobExperience: [
            "Entry level",
            "Executive"
          ]
        },
        jobTitles: [
          "Marketing Manager",
          "E-commerce Specialist",
          "Digital Marketing Coordinator",
          "Social Media Manager",
          "Business Analyst"
        ],
        industries: [
          "Retail",
          "E-commerce",
          "Digital Marketing",
          "Consumer Goods",
          "Online Media"
        ],
        companySize: [
          "1-10",
          "501-1000",
          "1001+"
        ],
        locations: {
          countries: [
            "Japan",
            "Germany",
            "Brazil",
            "Spain"
          ],
          regions: [
            "Kanto",
            "Southern Germany",
            "Southeast Brazil",
            "Northeast Spain"
          ],
          metropolitanAreas: [
            "Greater Tokyo Area",
            "Munich Metropolitan Region",
            "Greater São Paulo",
            "Barcelona Metropolitan Area"
          ]
        }
      },
      tiktokAds: {
        demographics: {
          age: [
            "13-17",
            "18-24",
            "45-54"
          ],
          gender: [
            "female",
            "male"
          ],
          location: [
            "Urban areas",
            "Suburban areas"
          ]
        },
        interests: [
          "Fashion",
          "Beauty",
          "Lifestyle",
          "Food & Beverage",
          "Travel"
        ],
        behaviors: [
          "App installs: Shopping apps",
          "Engagement: Product reviews",
          "Shopping: Fashion items",
          "Lifestyle enthusiasts"
        ],
        creatorCategories: [
          "Fashion Influencers",
          "Beauty Gurus",
          "Lifestyle Vloggers",
          "Food Critics"
        ],
        locations: {
          countries: [
            "Japan",
            "Germany",
            "Brazil",
            "Spain"
          ],
          regions: [
            "Tokyo",
            "Bavaria",
            "São Paulo",
            "Catalonia",
            "Madrid"
          ],
          cities: [
            "Tokyo",
            "Munich",
            "São Paulo",
            "Barcelona",
            "Madrid"
          ]
        },
        languages: [
          "Japanese",
          "German",
          "Portuguese",
          "Spanish"
        ]
      }
    }
  }
};

// Regional data for map visualization
export const regionData: RegionData[] = [
  { name: "Japan", coordinates: [138.2529, 36.2048], value: 78, color: "#f43f5e" },
  { name: "Germany", coordinates: [10.4515, 51.1657], value: 62, color: "#ec4899" },
  { name: "Brazil", coordinates: [-51.9253, -14.2350], value: 55, color: "#d946ef" },
  { name: "Spain", coordinates: [-3.7492, 40.4637], value: 48, color: "#a855f7" },
  { name: "Mexico", coordinates: [-102.5528, 23.6345], value: 35, color: "#8b5cf6" },
  { name: "South Korea", coordinates: [127.7669, 35.9078], value: 29, color: "#6366f1" }
];

// Performance metrics data with proper React typing
export const performanceData: PerformanceMetric[] = [
  { name: "Visitors", value: 87500, change: -5.2, icon: React.createElement(Users, { className: "h-4 w-4" }) },
  { name: "Clicks", value: 32400, change: 14.7, icon: React.createElement(CheckCircle2, { className: "h-4 w-4" }) },
  { name: "Conversions", value: 4850, change: -3.8, icon: React.createElement(MessageSquare, { className: "h-4 w-4" }) },
  { name: "CTR", value: 5.2, change: 8.9, icon: React.createElement(TrendingUp, { className: "h-4 w-4" }) }
];

// Age distribution data
export const ageDistributionData: AgeDistribution[] = [
  { age: "13-17", percentage: 12 },
  { age: "18-24", percentage: 38 },
  { age: "25-34", percentage: 22 },
  { age: "35-44", percentage: 8 },
  { age: "45-54", percentage: 15 },
  { age: "55+", percentage: 5 }
];

// Gender distribution data
export const genderDistributionData: GenderDistribution[] = [
  { gender: "Female", percentage: 62, color: "#f43f5e" },
  { gender: "Male", percentage: 35, color: "#0ea5e9" },
  { gender: "Other", percentage: 3, color: "#84cc16" }
]; 