import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Copy, TrendingUp } from "@/app/components/ui/icons";
import { AnalysisComponentProps } from "./types";
import { getPlatformDisplayName, getKeywordsForPlatform, getAudienceProfile } from "./utils";
import { Segment } from "../../page";

interface MarketPenetrationComponentProps extends Pick<AnalysisComponentProps, 
  'selectedAdPlatform'> {
  segment: Segment;
}

export const MarketPenetrationComponent: React.FC<MarketPenetrationComponentProps> = ({ 
  segment,
  selectedAdPlatform
}) => {
  // Format number with commas for thousands
  const formatNumber = (num: number | string | undefined): string => {
    if (num === undefined || num === null) return "0";
    const numValue = typeof num === 'string' ? parseInt(num) : num;
    return numValue.toLocaleString();
  };

  // Format currency value
  const formatCurrency = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return "$0";
    
    const numValue = typeof value === 'string' ? parseInt(value) : value;
    
    if (numValue >= 1000000000) {
      return `$${(numValue / 1000000000).toFixed(1)}B`;
    } else if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(1)}K`;
    }
    
    return `$${numValue}`;
  };

  // Get segment size (number of users)
  const segmentSize = segment.size ? parseInt(segment.size) : 0;
  
  // Get the audience profile
  const audienceProfile = getAudienceProfile(segment);
  
  // Get keywords for the current platform
  const keywords = getKeywordsForPlatform(segment, selectedAdPlatform);
  
  // Usar el valor de estimated_value si está disponible, o calcularlo si no
  let estimatedValue: number;
  
  if (segment.estimated_value) {
    // Si el segmento tiene un valor estimado, usarlo directamente
    estimatedValue = segment.estimated_value;
  } else if (segmentSize > 0) {
    // Si no hay valor estimado pero tenemos tamaño de segmento, calcularlo
    const multiplierByPlatform = {
      'facebookAds': 1000,  // $1000 por usuario en Facebook
      'googleAds': 800,     // $800 por usuario en Google
      'linkedInAds': 1200,  // $1200 por usuario en LinkedIn
      'tiktokAds': 500      // $500 por usuario en TikTok
    };
    
    const multiplier = multiplierByPlatform[selectedAdPlatform] || 500;
    estimatedValue = segmentSize * multiplier;
  } else {
    // Si no hay valor estimado ni tamaño de segmento, usar 0
    estimatedValue = 0;
  }
  
  // Valor estimado formateado para mostrar
  const formattedEstimatedValue = formatCurrency(estimatedValue);
  
  // Conversions (currently 0)
  const conversions = 0;
  
  // Usuarios actuales (actualmente 0)
  const currentUsers = 0;
  
  // Calcular el porcentaje de penetración de mercado
  // Como actualmente no hay usuarios, el porcentaje es 0%
  const marketPenetration = currentUsers > 0 
    ? Math.min(100, Math.max(1, Math.floor((currentUsers / segmentSize) * 100))) 
    : 0;
  
  // Calcular usuarios potenciales (basado en el tamaño del segmento)
  const potentialUsers = segmentSize > 0 ? segmentSize : 0;

  // Check if we have any data to display
  const hasData = segmentSize > 0 || estimatedValue > 0;
  
  // Check if we have a reference value for growth percentage
  const hasReferenceValue = false; // This should be set based on your data logic
  const growthPercentage = hasReferenceValue ? "+12.5%" : "N/A";
  const badgeVariant = hasReferenceValue ? "outline" : "secondary";
  const badgeClassName = hasReferenceValue 
    ? "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900 px-2 py-0.5 text-xs"
    : "bg-slate-200/50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700 px-2 py-0.5 text-xs";

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="px-6 pt-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">Market Penetration</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {hasData ? (
          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-base">
                  Estimated SAM for Selection
                </h3>
                <div className="flex items-center">
                  <Badge variant={badgeVariant} className={badgeClassName}>
                    <TrendingUp className="h-3 w-3 mr-1" />
                    <span>{growthPercentage}</span>
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">
                    {formatNumber(potentialUsers)}
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
                    style={{ width: `${marketPenetration}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Market penetration</span>
                  <span className="text-xs font-medium">{marketPenetration}%</span>
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
                      {formatNumber(segmentSize)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Users</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <h4 className="text-sm font-medium">Estimated Value</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Market potential</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formattedEstimatedValue}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Estimated market value</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mt-3">
                  <div>
                    <h4 className="text-sm font-medium">Conversions</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Current performance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatNumber(conversions)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total conversions</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-muted/30 p-8 rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">No market penetration data available for {getPlatformDisplayName(selectedAdPlatform)} Ads</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 