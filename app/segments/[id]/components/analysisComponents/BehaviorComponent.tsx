import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Copy } from "@/app/components/ui/icons";
import { AnalysisComponentProps, NewAdPlatformType } from "./types";
import { getPlatformDisplayName, getAudienceProfile, getBehaviorForPlatform } from "./utils";
import { Segment } from "../../page";

interface BehaviorComponentProps extends Pick<AnalysisComponentProps, 
  'selectedAdPlatform' | 'copyStates' | 'copyToClipboard'> {
  segment: Segment;
}

export const BehaviorComponent: React.FC<BehaviorComponentProps> = ({ 
  segment,
  selectedAdPlatform, 
  copyStates, 
  copyToClipboard 
}) => {
  // Get the audience profile data
  const audienceProfile = getAudienceProfile(segment);
  
  // Get behavior data for the selected platform
  const behaviorData = getBehaviorForPlatform(segment, selectedAdPlatform);

  // Function to get Google-specific behavior data
  const getGoogleBehavior = () => {
    if (selectedAdPlatform === 'googleAds' && audienceProfile?.data?.adPlatforms?.googleAds) {
      const googleAds = audienceProfile.data.adPlatforms.googleAds;
      
      return {
        inMarketSegments: Array.isArray(googleAds.inMarketSegments) ? googleAds.inMarketSegments : [],
        interests: Array.isArray(googleAds.interests) ? googleAds.interests : []
      };
    }
    return {
      inMarketSegments: [],
      interests: []
    };
  };

  // Function to get Facebook-specific behavior data
  const getFacebookBehavior = () => {
    if (selectedAdPlatform === 'facebookAds' && audienceProfile?.data?.adPlatforms?.facebookAds) {
      const facebookAds = audienceProfile.data.adPlatforms.facebookAds;
      
      return {
        interests: Array.isArray(facebookAds.interests) ? facebookAds.interests : [],
        locations: Array.isArray(facebookAds.locations?.countries) ? facebookAds.locations.countries : []
      };
    }
    return {
      interests: [],
      locations: []
    };
  };

  // Function to get LinkedIn-specific behavior data
  const getLinkedInBehavior = () => {
    if (selectedAdPlatform === 'linkedInAds' && audienceProfile?.data?.adPlatforms?.linkedInAds) {
      const linkedInAds = audienceProfile.data.adPlatforms.linkedInAds;
      
      return {
        jobTitles: Array.isArray(linkedInAds.jobTitles) ? linkedInAds.jobTitles : [],
        industries: Array.isArray(linkedInAds.industries) ? linkedInAds.industries : [],
        companySize: Array.isArray(linkedInAds.companySize) ? linkedInAds.companySize : []
      };
    }
    return {
      jobTitles: [],
      industries: [],
      companySize: []
    };
  };

  // Function to get TikTok-specific behavior data
  const getTikTokBehavior = () => {
    if (selectedAdPlatform === 'tiktokAds' && audienceProfile?.data?.adPlatforms) {
      // Verificar si tiktokAds existe
      const tiktokAds = audienceProfile.data.adPlatforms.tiktokAds;
      
      if (!tiktokAds) {
        // Intentar usar datos de otras plataformas como fallback
        const adPlatforms = audienceProfile.data.adPlatforms;
        let interests: string[] = [];
        
        if (adPlatforms.facebookAds?.interests && Array.isArray(adPlatforms.facebookAds.interests)) {
          interests = adPlatforms.facebookAds.interests;
        } else if (adPlatforms.googleAds?.interests && Array.isArray(adPlatforms.googleAds.interests)) {
          interests = adPlatforms.googleAds.interests;
        }
        
        return {
          interests: interests,
          behaviors: [],
          creatorCategories: []
        };
      }
      
      // Verificar si hay datos en cada categoría
      const hasInterests = Array.isArray(tiktokAds.interests) && tiktokAds.interests.length > 0;
      const hasBehaviors = Array.isArray(tiktokAds.behaviors) && tiktokAds.behaviors.length > 0;
      const hasCreatorCategories = Array.isArray(tiktokAds.creatorCategories) && tiktokAds.creatorCategories.length > 0;
      
      // Si no hay datos en ninguna categoría, intentar usar datos de otras plataformas
      if (!hasInterests && !hasBehaviors && !hasCreatorCategories) {
        const adPlatforms = audienceProfile.data.adPlatforms;
        let interests: string[] = [];
        
        if (adPlatforms.facebookAds?.interests && Array.isArray(adPlatforms.facebookAds.interests)) {
          interests = adPlatforms.facebookAds.interests;
        } else if (adPlatforms.googleAds?.interests && Array.isArray(adPlatforms.googleAds.interests)) {
          interests = adPlatforms.googleAds.interests;
        }
        
        return {
          interests: interests,
          behaviors: [],
          creatorCategories: []
        };
      }
      
      return {
        interests: Array.isArray(tiktokAds.interests) ? tiktokAds.interests : [],
        behaviors: Array.isArray(tiktokAds.behaviors) ? tiktokAds.behaviors : [],
        creatorCategories: Array.isArray(tiktokAds.creatorCategories) ? tiktokAds.creatorCategories : []
      };
    }
    return {
      interests: [],
      behaviors: [],
      creatorCategories: []
    };
  };

  // Check if we have behavior data
  const hasBehaviorData = behaviorData.length > 0 || 
    (selectedAdPlatform === 'tiktokAds' && (
      getTikTokBehavior().interests.length > 0 || 
      getTikTokBehavior().behaviors.length > 0 ||
      getTikTokBehavior().creatorCategories.length > 0
    ));

  return (
    <Card className="shadow-sm">
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
              let behaviorData: any = {};
              
              if (selectedAdPlatform === 'googleAds') {
                const googleBehaviorData = getGoogleBehavior();
                behaviorData = {
                  inMarketSegments: googleBehaviorData.inMarketSegments || []
                };
                // Add interests if available
                if (googleBehaviorData.interests && googleBehaviorData.interests.length > 0) {
                  behaviorData.interests = googleBehaviorData.interests;
                }
              } else if (selectedAdPlatform === 'facebookAds') {
                const facebookBehaviorData = getFacebookBehavior();
                behaviorData = {
                  interests: facebookBehaviorData.interests || []
                };
                // Add locations if available
                if (facebookBehaviorData.locations && facebookBehaviorData.locations.length > 0) {
                  behaviorData.locations = facebookBehaviorData.locations;
                }
              } else if (selectedAdPlatform === 'linkedInAds') {
                const linkedInBehaviorData = getLinkedInBehavior();
                behaviorData = {
                  jobTitles: linkedInBehaviorData.jobTitles || [],
                  companySize: linkedInBehaviorData.companySize || []
                };
                // Add industries if available
                if (audienceProfile?.data?.adPlatforms?.linkedInAds?.industries) {
                  behaviorData.industries = audienceProfile.data.adPlatforms.linkedInAds.industries;
                }
              } else if (selectedAdPlatform === 'tiktokAds') {
                const tiktokBehaviorData = getTikTokBehavior();
                behaviorData = {
                  interests: tiktokBehaviorData.interests || [],
                  behaviors: tiktokBehaviorData.behaviors || [],
                  creatorCategories: tiktokBehaviorData.creatorCategories || []
                };
              }
              
              // Ensure we have valid data to copy
              if (Object.keys(behaviorData).length === 0) {
                // If no data is available, provide a helpful message
                behaviorData = { message: `No behavior data available for ${getPlatformDisplayName(selectedAdPlatform)} Ads` };
              }
              
              const jsonString = JSON.stringify(behaviorData, null, 2);
              copyToClipboard(jsonString, 'behavior');
            }}
            className="flex items-center justify-center relative"
            disabled={!hasBehaviorData}
          >
            <div className="flex items-center justify-center min-w-0">
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              <span>{copyStates.behavior ? "Copied!" : "Copy Behavior"}</span>
            </div>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-4">
        {!hasBehaviorData ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground text-sm">No behavior data available for this platform</p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedAdPlatform === 'googleAds' && (
              <>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">In-Market Segments</h4>
                  <div className="flex flex-wrap gap-2">
                    {getGoogleBehavior().inMarketSegments.length > 0 ? (
                      getGoogleBehavior().inMarketSegments.map((segment: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {segment}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No in-market segments available</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {getGoogleBehavior().interests.length > 0 ? (
                      getGoogleBehavior().interests.map((interest: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {interest}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No interests available</p>
                    )}
                  </div>
                </div>
              </>
            )}
            
            {selectedAdPlatform === 'facebookAds' && (
              <>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {getFacebookBehavior().interests.length > 0 ? (
                      getFacebookBehavior().interests.map((interest: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {interest}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No interests available</p>
                    )}
                  </div>
                </div>
              </>
            )}
            
            {selectedAdPlatform === 'linkedInAds' && (
              <>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Job Titles</h4>
                  <div className="flex flex-wrap gap-2">
                    {getLinkedInBehavior().jobTitles.length > 0 ? (
                      getLinkedInBehavior().jobTitles.map((title: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {title}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No job titles available</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Industries</h4>
                  <div className="flex flex-wrap gap-2">
                    {getLinkedInBehavior().industries.length > 0 ? (
                      getLinkedInBehavior().industries.map((industry: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {industry}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No industries available</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Company Size</h4>
                  <div className="flex flex-wrap gap-2">
                    {getLinkedInBehavior().companySize.length > 0 ? (
                      getLinkedInBehavior().companySize.map((size: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {size}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No company size data available</p>
                    )}
                  </div>
                </div>
              </>
            )}
            
            {selectedAdPlatform === 'tiktokAds' && (
              <>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {getTikTokBehavior().interests.length > 0 ? (
                      getTikTokBehavior().interests.map((interest: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {interest}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No interests available</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Behaviors</h4>
                  <div className="flex flex-wrap gap-2">
                    {getTikTokBehavior().behaviors.length > 0 ? (
                      getTikTokBehavior().behaviors.map((behavior: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {behavior}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No behaviors available</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Creator Categories</h4>
                  <div className="flex flex-wrap gap-2">
                    {getTikTokBehavior().creatorCategories.length > 0 ? (
                      getTikTokBehavior().creatorCategories.map((category: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                          {category}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No creator categories available</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 