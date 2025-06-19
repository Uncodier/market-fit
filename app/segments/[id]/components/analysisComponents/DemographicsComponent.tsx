import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Copy } from "@/app/components/ui/icons";
import { BaseAnalysisComponentProps, GenderDistribution } from "./types";
import { ageDistributionData, genderDistributionData } from "./data";
import { 
  getAgeRangeDisplay, 
  getGenderDisplay, 
  getInterestsForPlatform, 
  getPlatformDisplayName,
  getParentalStatusDisplay,
  getHouseholdIncomeDisplay,
  getEducationDisplay,
  getGenerationDisplay,
  getLinkedInEducationDisplay,
  getJobExperienceDisplay
} from "./utils";
import { Segment } from "../../page";

interface DemographicsComponentProps extends Pick<BaseAnalysisComponentProps, 
  'selectedAdPlatform' | 'copyStates' | 'copyToClipboard' | 'isDarkMode'> {
  segment: Segment;
}

// Helper function to get default gender data
const getDefaultGenderData = (): GenderDistribution[] => {
  return [
    { gender: "Female", percentage: 62, color: "#f43f5e" },
    { gender: "Male", percentage: 35, color: "#0ea5e9" },
    { gender: "Other", percentage: 3, color: "#84cc16" }
  ];
};

export const DemographicsComponent: React.FC<DemographicsComponentProps> = ({ 
  segment,
  selectedAdPlatform, 
  copyStates, 
  copyToClipboard, 
  isDarkMode 
}) => {
  // Calculate age distribution based on available data
  const calculateAgeDistribution = () => {
    // Get the appropriate platform key
    const platformKey = selectedAdPlatform.replace('Ads', '').toLowerCase();
    
    // Try to access the data from the segment analysis
    try {
      let ageData: string[] = [];
      
      // Check if analysis exists and has the right structure
      if (segment?.analysis) {
        // Handle the case where analysis is an array
        if (Array.isArray(segment.analysis)) {
          const audienceProfile = segment.analysis.find(item => item.type === "audienceProfile");
          if (audienceProfile?.data?.adPlatforms?.[selectedAdPlatform]?.demographics?.age) {
            ageData = audienceProfile.data.adPlatforms[selectedAdPlatform].demographics.age;
          } else if (audienceProfile?.data?.adPlatforms?.[selectedAdPlatform]?.demographics?.ageRanges) {
            ageData = audienceProfile.data.adPlatforms[selectedAdPlatform].demographics.ageRanges;
          }
        } 
        // Handle the case where analysis is an object
        else if (segment.analysis.data?.adPlatforms?.[selectedAdPlatform]?.demographics?.age) {
          ageData = segment.analysis.data.adPlatforms[selectedAdPlatform].demographics.age;
        } else if (segment.analysis.data?.adPlatforms?.[selectedAdPlatform]?.demographics?.ageRanges) {
          ageData = segment.analysis.data.adPlatforms[selectedAdPlatform].demographics.ageRanges;
        }
      }
      
      // If we found age data, we need to process it correctly
      if (ageData && ageData.length > 0) {
        // For Facebook, age data might be individual ages that need to be grouped into ranges
        if (selectedAdPlatform === 'facebookAds' && typeof ageData[0] === 'number') {
          // Convert numbers to strings if needed
          const ageStrings = ageData.map(age => String(age));
          
          // Get the age range text from the utility function
          const ageRangeText = getAgeRangeDisplay(segment, selectedAdPlatform);
          if (ageRangeText && ageRangeText !== "Not available") {
            // Use the pre-formatted ranges
            const ageRanges = ageRangeText.split(", ");
            const equalPercentage = Math.floor(100 / ageRanges.length);
            
            const distribution = ageRanges.map(range => ({
              age: range,
              percentage: equalPercentage
            }));
            
            // Adjust for rounding errors
            const totalPercentage = distribution.reduce((sum, item) => sum + item.percentage, 0);
            if (totalPercentage < 100 && distribution.length > 0) {
              distribution[0].percentage += (100 - totalPercentage);
            }
            
            return distribution;
          }
        } else {
          // For other platforms or when we have proper ranges already
          // Create a distribution based on the available age ranges
          const equalPercentage = Math.floor(100 / ageData.length);
          const distribution = ageData.map((ageRange) => ({
            age: ageRange,
            percentage: equalPercentage
          }));
          
          // Adjust for rounding errors
          const totalPercentage = distribution.reduce((sum, item) => sum + item.percentage, 0);
          if (totalPercentage < 100 && distribution.length > 0) {
            distribution[0].percentage += (100 - totalPercentage);
          }
          
          return distribution;
        }
      }
      
      // If no data found in the primary location, try alternative paths
      // This is a fallback for different data structures
      const ageRangeText = getAgeRangeDisplay(segment, selectedAdPlatform);
      if (ageRangeText && ageRangeText !== "Not available") {
        // Split by comma to get individual ranges
        const ageRanges = ageRangeText.split(", ");
        if (ageRanges.length > 0) {
          // Distribute percentages evenly among the ranges
          const equalPercentage = Math.floor(100 / ageRanges.length);
          const distribution = ageRanges.map((ageRange) => ({
            age: ageRange,
            percentage: equalPercentage
          }));
          
          // Adjust for rounding errors
          const totalPercentage = distribution.reduce((sum, item) => sum + item.percentage, 0);
          if (totalPercentage < 100 && distribution.length > 0) {
            distribution[0].percentage += (100 - totalPercentage);
          }
          
          return distribution;
        }
      }
    } catch (error) {
      console.error("Error calculating age distribution:", error);
    }
    
    // If all else fails, return empty array instead of default data
    return [];
  };

  // Calculate gender distribution based on available data
  const calculateGenderDistribution = (): GenderDistribution[] => {
    // Try to access the data from the segment analysis
    try {
      let genderData: string[] = [];
      
      // Check if analysis exists and has the right structure
      if (segment?.analysis) {
        // Handle the case where analysis is an array
        if (Array.isArray(segment.analysis)) {
          const audienceProfile = segment.analysis.find(item => item.type === "audienceProfile");
          if (audienceProfile?.data?.adPlatforms?.[selectedAdPlatform]?.demographics?.gender) {
            genderData = audienceProfile.data.adPlatforms[selectedAdPlatform].demographics.gender;
          }
        } 
        // Handle the case where analysis is an object
        else if (segment.analysis.data?.adPlatforms?.[selectedAdPlatform]?.demographics?.gender) {
          genderData = segment.analysis.data.adPlatforms[selectedAdPlatform].demographics.gender;
        }
      }
      
      // If we found gender data
      if (genderData && genderData.length > 0) {
        // Map gender names to display names
        const mappedGenders = genderData.map(gender => {
          if (gender.toLowerCase() === 'male') return 'Male';
          if (gender.toLowerCase() === 'female') return 'Female';
          return gender;
        });
        
        // Count occurrences of each gender
        const genderCounts: Record<string, number> = {};
        mappedGenders.forEach(gender => {
          genderCounts[gender] = (genderCounts[gender] || 0) + 1;
        });
        
        // Calculate percentages
        const total = Object.values(genderCounts).reduce((sum, count) => sum + count, 0);
        const distribution = Object.entries(genderCounts).map(([gender, count], index) => {
          // Generate a color based on index
          const colors = ['#f43f5e', '#0ea5e9', '#84cc16', '#a855f7', '#ec4899'];
          return {
            gender,
            percentage: Math.round((count / total) * 100),
            color: colors[index % colors.length]
          };
        });
        
        return distribution;
      }
      
      // If no data found in the primary location, try alternative paths
      // This is a fallback for different data structures
      const genderText = getGenderDisplay(segment, selectedAdPlatform);
      if (genderText && genderText !== "Not available") {
        const genders = genderText.split(", ");
        if (genders.length > 0) {
          // Map gender names to display names
          const mappedGenders = genders.map(gender => {
            if (gender.toLowerCase() === 'male') return 'Male';
            if (gender.toLowerCase() === 'female') return 'Female';
            return gender;
          });
          
          // Count occurrences of each gender
          const genderCounts: Record<string, number> = {};
          mappedGenders.forEach(gender => {
            genderCounts[gender] = (genderCounts[gender] || 0) + 1;
          });
          
          // Calculate percentages
          const total = Object.values(genderCounts).reduce((sum, count) => sum + count, 0);
          const distribution = Object.entries(genderCounts).map(([gender, count], index) => {
            // Generate a color based on index
            const colors = ['#f43f5e', '#0ea5e9', '#84cc16', '#a855f7', '#ec4899'];
            return {
              gender,
              percentage: Math.round((count / total) * 100),
              color: colors[index % colors.length]
            };
          });
          
          return distribution;
        }
      }
    } catch (error) {
      console.error("Error calculating gender distribution:", error);
    }
    
    // If all else fails, return empty array instead of default data
    return [];
  };
  
  // Get the distributions
  const ageDistribution = calculateAgeDistribution();
  const genderDistribution = calculateGenderDistribution();
  
  // Get Google Ads specific demographics
  const parentalStatus = getParentalStatusDisplay(segment, selectedAdPlatform);
  const householdIncome = getHouseholdIncomeDisplay(segment, selectedAdPlatform);
  
  // Get Facebook Ads specific demographics
  const education = getEducationDisplay(segment, selectedAdPlatform);
  const generation = getGenerationDisplay(segment, selectedAdPlatform);
  
  // Get LinkedIn Ads specific demographics
  const linkedInEducation = getLinkedInEducationDisplay(segment, selectedAdPlatform);
  const jobExperience = getJobExperienceDisplay(segment, selectedAdPlatform);
  
  // Check if we have data to display
  const hasAgeData = ageDistribution.length > 0;
  const hasGenderData = genderDistribution.length > 0;
  const hasParentalStatusData = parentalStatus.length > 0;
  const hasHouseholdIncomeData = householdIncome.length > 0;
  const hasEducationData = education.length > 0;
  const hasGenerationData = generation.length > 0;
  const hasLinkedInEducationData = linkedInEducation.length > 0;
  const hasJobExperienceData = jobExperience.length > 0;
  
  // Check if we should show Google Ads specific sections
  const showGoogleAdsSpecificSections = selectedAdPlatform === 'googleAds' && 
    (hasParentalStatusData || hasHouseholdIncomeData);
    
  // Check if we should show Facebook Ads specific sections
  const showFacebookAdsSpecificSections = selectedAdPlatform === 'facebookAds' && 
    (hasEducationData || hasGenerationData);
    
  // Check if we should show LinkedIn Ads specific sections
  const showLinkedInAdsSpecificSections = selectedAdPlatform === 'linkedInAds' && 
    (hasLinkedInEducationData || hasJobExperienceData);
  
  return (
    <Card className="shadow-sm">
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
              // Get age range and ensure it's not "Not available"
              const ageRange = getAgeRangeDisplay(segment, selectedAdPlatform);
              const gender = getGenderDisplay(segment, selectedAdPlatform);
              
              // Create demographics data object with only valid data
              const demographicsData: Record<string, any> = {};
              
              // Only add fields that have valid data
              if (ageRange && ageRange !== 'Not available') {
                demographicsData.ageRange = ageRange;
              }
              
              if (gender && gender !== 'Not available') {
                demographicsData.gender = gender;
              }
              
              // Add platform-specific data only if it exists
              if (hasParentalStatusData && parentalStatus.length > 0) {
                demographicsData.parentalStatus = parentalStatus;
              }
              
              if (hasHouseholdIncomeData && householdIncome.length > 0) {
                demographicsData.householdIncome = householdIncome;
              }
              
              if (hasEducationData && education.length > 0) {
                demographicsData.education = education;
              }
              
              if (hasGenerationData && generation.length > 0) {
                demographicsData.generation = generation;
              }
              
              if (hasLinkedInEducationData && linkedInEducation.length > 0) {
                // Use education field for LinkedIn to avoid duplicate keys
                demographicsData.education = linkedInEducation;
              }
              
              if (hasJobExperienceData && jobExperience.length > 0) {
                demographicsData.jobExperience = jobExperience;
              }
              
              // If no valid data was found, provide a helpful message
              if (Object.keys(demographicsData).length === 0) {
                demographicsData.message = `No demographic data available for ${getPlatformDisplayName(selectedAdPlatform)} Ads`;
              }
              
              copyToClipboard?.(JSON.stringify(demographicsData, null, 2), 'demographics');
            }}
            className="flex items-center justify-center relative"
          >
            <div className="flex items-center justify-center min-w-0">
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              <span>{copyStates?.demographics ? "Copied!" : "Copy Demographics"}</span>
            </div>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Age Range</h4>
              <p className="text-base font-medium">{getAgeRangeDisplay(segment, selectedAdPlatform)}</p>
              
              {hasAgeData ? (
                <div className="mt-4 space-y-2">
                  {ageDistribution.map((item, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{item.age}</span>
                        <span>{item.percentage}%</span>
                      </div>
                      <div className={`w-full h-2 rounded-full ${isDarkMode ? "bg-slate-700" : "bg-slate-200"}`}>
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${item.percentage}%`,
                            backgroundColor: index === 0 ? "#818cf8" : 
                                           index === 1 ? "#a78bfa" : 
                                           index === 2 ? "#c084fc" : 
                                           index === 3 ? "#e879f9" : 
                                           index === 4 ? "#f472b6" : "#f87171"
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">
                  Not available
                </div>
              )}
            </div>
            
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Gender</h4>
              <p className="text-base font-medium">{getGenderDisplay(segment, selectedAdPlatform)}</p>
              
              {hasGenderData ? (
                <div className="mt-4">
                  <div className="flex h-4 mb-2">
                    {genderDistribution.map((item: GenderDistribution, index: number) => (
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
                  <div className="flex flex-wrap gap-4 text-xs">
                    {genderDistribution.map((item: GenderDistribution, index: number) => (
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
              ) : (
                <div className="mt-4 text-sm text-muted-foreground">
                  Not available
                </div>
              )}
            </div>
          </div>
          
          {/* Google Ads specific demographics */}
          {showGoogleAdsSpecificSections && (
            <div className="grid grid-cols-1 gap-4">
              {/* Parental Status */}
              {hasParentalStatusData && (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Parental Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {parentalStatus.map((status, idx) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {status}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Household Income */}
              {hasHouseholdIncomeData && (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Household Income</h4>
                  <div className="flex flex-wrap gap-2">
                    {householdIncome.map((income, idx) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {income}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Facebook Ads specific demographics */}
          {showFacebookAdsSpecificSections && (
            <div className="grid grid-cols-1 gap-4">
              {/* Education */}
              {hasEducationData && (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Education</h4>
                  <div className="flex flex-wrap gap-2">
                    {education.map((edu, idx) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {edu}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Generation */}
              {hasGenerationData && (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Generation</h4>
                  <div className="flex flex-wrap gap-2">
                    {generation.map((gen, idx) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {gen}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* LinkedIn Ads specific demographics */}
          {showLinkedInAdsSpecificSections && (
            <div className="grid grid-cols-1 gap-4">
              {/* Education */}
              {hasLinkedInEducationData && (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Education</h4>
                  <div className="flex flex-wrap gap-2">
                    {linkedInEducation.map((edu, idx) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {edu}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Job Experience */}
              {hasJobExperienceData && (
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Job Experience</h4>
                  <div className="flex flex-wrap gap-2">
                    {jobExperience.map((exp, idx) => (
                      <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                        {exp}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 