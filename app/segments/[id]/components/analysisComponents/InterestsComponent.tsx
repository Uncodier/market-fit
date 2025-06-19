import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Copy } from "@/app/components/ui/icons";
import { BaseAnalysisComponentProps, NewAdPlatformType } from "./types";
import { getPlatformDisplayName, getInterestsForPlatform } from "./utils";
import { Segment } from "../../page";

interface InterestsComponentProps extends Pick<BaseAnalysisComponentProps, 
  'selectedAdPlatform' | 'copyStates' | 'copyToClipboard'> {
  segment: Segment;
}

export const InterestsComponent: React.FC<InterestsComponentProps> = ({ 
  segment,
  selectedAdPlatform, 
  copyStates, 
  copyToClipboard 
}) => {
  // Get interests data for the selected platform
  const interests = getInterestsForPlatform(segment, selectedAdPlatform);
  
  // Check if we have interests data
  const hasInterestsData = interests.length > 0;

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="px-6 pt-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Interests</CardTitle>
            <CardDescription>
              Audience interests for {getPlatformDisplayName(selectedAdPlatform)} Ads
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => copyToClipboard?.(interests.join(", "), 'interests')}
            className="flex items-center justify-center relative"
            disabled={!hasInterestsData}
          >
            <div className="flex items-center justify-center min-w-0">
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              <span>{copyStates?.interests ? "Copied!" : "Copy Interests"}</span>
            </div>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {!hasInterestsData ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground text-sm">No interests data available for this platform</p>
          </div>
        ) : (
          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex flex-wrap gap-2">
              {interests.map((interest: string, idx: number) => (
                <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 