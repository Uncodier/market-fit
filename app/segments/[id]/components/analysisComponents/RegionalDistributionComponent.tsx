import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Copy } from "@/app/components/ui/icons";
import { BaseAnalysisComponentProps } from "./types";
import WorldMapComponent from "@/app/components/WorldMapComponent";
import { 
  getCountriesFromPlatform, 
  getPlatformDisplayName, 
  getGoogleGeoTargeting, 
  getAudienceProfile,
  getLinkedInRegionsDisplay,
  getLinkedInMetroAreasDisplay,
  getFacebookZipsDisplay,
  getFacebookCitiesDisplay,
  getFacebookRegionsDisplay,
  getTikTokLocationsDisplay
} from "./utils";
import { Segment } from "../../page";
import { Badge } from "@/app/components/ui/badge";

interface RegionalDistributionComponentProps extends Pick<BaseAnalysisComponentProps, 
  'selectedAdPlatform' | 'copyStates' | 'copyToClipboard'> {
  segment: Segment;
}

export const RegionalDistributionComponent: React.FC<RegionalDistributionComponentProps> = ({ 
  segment,
  selectedAdPlatform, 
  copyStates, 
  copyToClipboard 
}) => {
  // Get audience profile data
  const audienceProfile = getAudienceProfile(segment);
  
  // Get geo targeting data for Google Ads
  const googleGeoTargeting = selectedAdPlatform === 'googleAds' 
    ? getGoogleGeoTargeting(segment) 
    : null;
    
  // Get LinkedIn regions and metropolitan areas
  const linkedInRegions = selectedAdPlatform === 'linkedInAds'
    ? getLinkedInRegionsDisplay(segment, selectedAdPlatform)
    : [];
    
  const linkedInMetroAreas = selectedAdPlatform === 'linkedInAds'
    ? getLinkedInMetroAreasDisplay(segment, selectedAdPlatform)
    : [];
    
  // Get Facebook zips, cities, and regions
  const facebookZips = selectedAdPlatform === 'facebookAds'
    ? getFacebookZipsDisplay(segment, selectedAdPlatform)
    : [];
    
  const facebookCities = selectedAdPlatform === 'facebookAds'
    ? getFacebookCitiesDisplay(segment, selectedAdPlatform)
    : [];
    
  const facebookRegions = selectedAdPlatform === 'facebookAds'
    ? getFacebookRegionsDisplay(segment, selectedAdPlatform)
    : [];
    
  // Get TikTok locations
  const tiktokLocations = selectedAdPlatform === 'tiktokAds'
    ? getTikTokLocationsDisplay(segment, selectedAdPlatform)
    : [];
  
  // Get locations data for the map
  const mapLocations = getCountriesFromPlatform(segment, selectedAdPlatform);
  
  // Check if we have location data
  const hasLocationData = mapLocations && mapLocations.length > 0;
  
  // Check if we have LinkedIn location data
  const hasLinkedInLocationData = linkedInRegions.length > 0 || linkedInMetroAreas.length > 0;
  
  // Check if we have Facebook location data
  const hasFacebookLocationData = facebookZips.length > 0 || facebookCities.length > 0 || facebookRegions.length > 0;
  
  // Check if we have TikTok location data
  const hasTikTokLocationData = tiktokLocations.length > 0;
  
  return (
    <Card className="shadow-sm">
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
              let regionalData: Record<string, any> = {};
              
              if (selectedAdPlatform === 'googleAds') {
                // For Google Ads, include only regions and cities with data
                if (googleGeoTargeting && googleGeoTargeting.regions && googleGeoTargeting.regions.length > 0) {
                  regionalData.regions = googleGeoTargeting.regions;
                }
                if (googleGeoTargeting && googleGeoTargeting.cities && googleGeoTargeting.cities.length > 0) {
                  regionalData.cities = googleGeoTargeting.cities;
                }
              } else if (selectedAdPlatform === 'linkedInAds') {
                // For LinkedIn Ads, include regions and metropolitan areas with data
                if (linkedInRegions.length > 0) {
                  regionalData.regions = linkedInRegions;
                }
                if (linkedInMetroAreas.length > 0) {
                  regionalData.metropolitanAreas = linkedInMetroAreas;
                }
                if (mapLocations.length > 0) {
                  regionalData.countries = mapLocations.map(region => ({
                    name: region.name,
                    value: region.value
                  }));
                }
              } else if (selectedAdPlatform === 'facebookAds') {
                // For Facebook Ads, include zips, cities and regions with data
                if (facebookZips.length > 0) {
                  regionalData.zips = facebookZips;
                }
                if (facebookCities.length > 0) {
                  regionalData.cities = facebookCities;
                }
                if (facebookRegions.length > 0) {
                  regionalData.regions = facebookRegions;
                }
                if (mapLocations.length > 0) {
                  regionalData.countries = mapLocations.map(region => ({
                    name: region.name,
                    value: region.value
                  }));
                }
              } else if (selectedAdPlatform === 'tiktokAds') {
                // For TikTok Ads, include locations with data
                if (tiktokLocations.length > 0) {
                  regionalData.locations = tiktokLocations;
                }
                if (mapLocations.length > 0) {
                  regionalData.countries = mapLocations.map(region => ({
                    name: region.name,
                    value: region.value
                  }));
                }
              } else {
                // For other platforms, extract region names if available
                if (mapLocations.length > 0) {
                  regionalData.regions = mapLocations.map(region => ({
                    name: region.name,
                    value: region.value
                  }));
                }
              }
              
              // If no valid data was found, provide a helpful message
              if (Object.keys(regionalData).length === 0) {
                regionalData.message = `No regional data available for ${getPlatformDisplayName(selectedAdPlatform)} Ads`;
              }
              
              copyToClipboard?.(JSON.stringify(regionalData, null, 2), 'regional');
            }}
            className="flex items-center justify-center relative"
            disabled={!hasLocationData && !hasLinkedInLocationData && !hasFacebookLocationData && !hasTikTokLocationData && (!googleGeoTargeting || (googleGeoTargeting.regions.length === 0 && googleGeoTargeting.cities.length === 0))}
          >
            <div className="flex items-center justify-center min-w-0">
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              <span>{copyStates?.regional ? "Copied!" : "Copy Regional Data"}</span>
            </div>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {/* Google Ads Geo Targeting Details */}
        {selectedAdPlatform === 'googleAds' && googleGeoTargeting && (
          <div className="mb-6 space-y-4">
            {/* Regions */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Regions</h4>
              <div className="flex flex-wrap gap-2">
                {googleGeoTargeting.regions.length > 0 ? (
                  googleGeoTargeting.regions.map((region, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {region}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No regions available</p>
                )}
              </div>
            </div>
            
            {/* Cities */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Cities</h4>
              <div className="flex flex-wrap gap-2">
                {googleGeoTargeting.cities.length > 0 ? (
                  googleGeoTargeting.cities.map((city, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {city}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No cities available</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* LinkedIn Ads Geo Targeting Details */}
        {selectedAdPlatform === 'linkedInAds' && hasLinkedInLocationData && (
          <div className="mb-6 space-y-4">
            {/* Regions */}
            {linkedInRegions.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Regions</h4>
                <div className="flex flex-wrap gap-2">
                  {linkedInRegions.map((region, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Metropolitan Areas */}
            {linkedInMetroAreas.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Metropolitan Areas</h4>
                <div className="flex flex-wrap gap-2">
                  {linkedInMetroAreas.map((area, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Facebook Ads Geo Targeting Details */}
        {selectedAdPlatform === 'facebookAds' && hasFacebookLocationData && (
          <div className="mb-6 space-y-4">
            {/* Regions */}
            {facebookRegions.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Regions</h4>
                <div className="flex flex-wrap gap-2">
                  {facebookRegions.map((region, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {region}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Cities */}
            {facebookCities.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Cities</h4>
                <div className="flex flex-wrap gap-2">
                  {facebookCities.map((city, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Zip Codes */}
            {facebookZips.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Zip Codes</h4>
                <div className="flex flex-wrap gap-2">
                  {facebookZips.map((zip, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                      {zip}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* TikTok Ads Geo Targeting Details */}
        {selectedAdPlatform === 'tiktokAds' && hasTikTokLocationData && (
          <div className="mb-6 space-y-4">
            {/* Locations */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Locations</h4>
              <div className="flex flex-wrap gap-2">
                {tiktokLocations.map((location, idx) => (
                  <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                    {location}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* World Map or No Data Message */}
        {hasLocationData ? (
          <div className="h-[450px] w-full">
            <WorldMapComponent 
              locations={mapLocations}
              height="450px"
              onSelectLocation={(location) => {
                // No need to log selected regions
              }}
            />
          </div>
        ) : (
          <div className="h-[450px] w-full flex items-center justify-center bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No regional distribution data available for {getPlatformDisplayName(selectedAdPlatform)} Ads</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 