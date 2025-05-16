"use client"

import React, { useState, useEffect } from "react"
import { Segment } from "../page"
import { useTheme } from '@/app/context/ThemeContext'
import { 
  NewAdPlatformType,
  PerformanceMetricsComponent,
  DemographicsComponent,
  BehaviorComponent,
  MarketPenetrationComponent,
  RegionalDistributionComponent
} from "./analysisComponents/index"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Button } from "@/app/components/ui/button"
import { BarChart } from "@/app/components/ui/icons"

interface SegmentAnalysisTabProps {
  segment: Segment;
  selectedAdPlatform: NewAdPlatformType;
}

// Helper function to find the audienceProfile in the segment data
const findAudienceProfile = (segment: Segment) => {
  if (!segment || !segment.audience) return null;
  
  try {
    // Parse the audience field if it's a string
    let audienceData;
    if (typeof segment.audience === 'string') {
      try {
        // Verificar si la cadena comienza con "media" o contiene texto plano - casos especiales
        if (segment.audience.trim().startsWith('media') || 
            segment.audience.includes('professional') ||
            !segment.audience.includes('{')) {
          return null;
        }
        
        audienceData = JSON.parse(segment.audience);
      } catch (parseError) {
        // Try to clean up the string if needed
        try {
          // Verificar si la cadena comienza con "media" o contiene texto plano - casos especiales
          if (segment.audience.trim().startsWith('media') || 
              segment.audience.includes('professional') ||
              !segment.audience.includes('{')) {
            return null;
          }
          
          // Intentar limpiar la cadena para que sea un JSON válido
          let cleanedString = segment.audience
            .replace(/'/g, '"')
            .replace(/([a-zA-Z0-9_]+):/g, '"$1":');
          
          // Verificar si hay palabras sueltas que no están entre comillas
          cleanedString = cleanedString.replace(/:\s*([a-zA-Z]+)(?=\s*[,}])/g, ': "$1"');
          
          audienceData = JSON.parse(cleanedString);
        } catch (fallbackError) {
          return null;
        }
      }
    } else {
      // If it's already an object, use it directly
      audienceData = segment.audience;
    }
    
    // Ensure audienceData is an array
    if (!Array.isArray(audienceData)) {
      return null;
    }
    
    // Find the audienceProfile object
    const audienceProfile = audienceData.find((item: any) => item.type === "audienceProfile");
    
    if (!audienceProfile || !audienceProfile.data || !audienceProfile.data.adPlatforms) {
      return null;
    }
    
    return audienceProfile;
  } catch (error) {
    return null;
  }
};

// Función de utilidad para procesar de manera segura los datos de audiencia
const safelyProcessSegment = (segment: Segment): Segment => {
  if (!segment) return segment;
  
  // Crear una copia del segmento para no modificar el original
  const processedSegment = { ...segment };
  
  // Si audience es una cadena que parece texto plano (no JSON), establecerlo como un array vacío
  if (typeof processedSegment.audience === 'string') {
    if (processedSegment.audience.includes('professional') || 
        !processedSegment.audience.includes('{') ||
        processedSegment.audience.trim().startsWith('media')) {
      processedSegment.audience = '[]'; // Convertir a string de array vacío
    }
  }
  
  // Asegurarse de que analysis tenga la estructura correcta
  if (processedSegment.analysis) {
    // Verificar si hay datos de TikTok en el segmento original
    let tiktokData = null;
    
    // Buscar datos de TikTok en diferentes estructuras posibles
    if (Array.isArray(processedSegment.analysis)) {
      // Buscar en cada elemento del array
      for (const item of processedSegment.analysis) {
        if (item?.data?.adPlatforms?.tiktokAds) {
          tiktokData = item.data.adPlatforms.tiktokAds;
          break;
        }
        if ((item as any)?.adPlatforms?.tiktokAds) {
          tiktokData = (item as any).adPlatforms.tiktokAds;
          break;
        }
      }
    } else if (typeof processedSegment.analysis === 'object') {
      // Buscar en el objeto analysis
      if (processedSegment.analysis?.data?.adPlatforms?.tiktokAds) {
        tiktokData = processedSegment.analysis.data.adPlatforms.tiktokAds;
      } else if ((processedSegment.analysis as any)?.adPlatforms?.tiktokAds) {
        tiktokData = (processedSegment.analysis as any).adPlatforms.tiktokAds;
      } else if ((processedSegment.analysis as any)?.tiktokAds) {
        tiktokData = (processedSegment.analysis as any).tiktokAds;
      }
    }
    
    // Si analysis es un objeto pero no tiene la estructura esperada
    if (typeof processedSegment.analysis === 'object' && 
        !Array.isArray(processedSegment.analysis) && 
        !processedSegment.analysis.type) {
      
      // Si tiene data.adPlatforms
      if (processedSegment.analysis.data && 
          typeof processedSegment.analysis.data === 'object' && 
          'adPlatforms' in processedSegment.analysis.data) {
        // Asegurarse de que tiktokAds esté presente
        if (!processedSegment.analysis.data.adPlatforms.tiktokAds && tiktokData) {
          processedSegment.analysis.data.adPlatforms.tiktokAds = tiktokData;
        }
      } 
      // Si tiene adPlatforms directamente
      else if ('adPlatforms' in (processedSegment.analysis as any)) {
        // Asegurarse de que tiktokAds esté presente
        if (!(processedSegment.analysis as any).adPlatforms.tiktokAds && tiktokData) {
          (processedSegment.analysis as any).adPlatforms.tiktokAds = tiktokData;
        }
        
        processedSegment.analysis = {
          type: "audienceProfile",
          data: {
            adPlatforms: (processedSegment.analysis as any).adPlatforms
          }
        };
      }
      // Si no tiene ninguna estructura reconocible
      else {
        // Crear una estructura adPlatforms con los datos existentes y TikTok
        const adPlatforms: any = {};
        
        // Intentar extraer datos de plataformas si existen
        if ((processedSegment.analysis as any).googleAds) {
          adPlatforms.googleAds = (processedSegment.analysis as any).googleAds;
        }
        if ((processedSegment.analysis as any).facebookAds) {
          adPlatforms.facebookAds = (processedSegment.analysis as any).facebookAds;
        }
        if ((processedSegment.analysis as any).linkedInAds) {
          adPlatforms.linkedInAds = (processedSegment.analysis as any).linkedInAds;
        }
        if ((processedSegment.analysis as any).tiktokAds || tiktokData) {
          adPlatforms.tiktokAds = (processedSegment.analysis as any).tiktokAds || tiktokData;
        }
        
        // Si encontramos alguna plataforma, usar esa estructura
        if (Object.keys(adPlatforms).length > 0) {
          processedSegment.analysis = {
            type: "audienceProfile",
            data: {
              adPlatforms: adPlatforms
            }
          };
        } else {
          // Si no, simplemente envolver el objeto original
          processedSegment.analysis = {
            type: "audienceProfile",
            data: processedSegment.analysis
          };
        }
      }
    } else if (Array.isArray(processedSegment.analysis)) {
      // Si es un array, buscar el audienceProfile y asegurarse de que tenga datos de TikTok
      const audienceProfileIndex = processedSegment.analysis.findIndex(item => item.type === "audienceProfile");
      
      if (audienceProfileIndex >= 0 && tiktokData) {
        const audienceProfile = processedSegment.analysis[audienceProfileIndex];
        
        if (audienceProfile.data && audienceProfile.data.adPlatforms) {
          if (!audienceProfile.data.adPlatforms.tiktokAds) {
            audienceProfile.data.adPlatforms.tiktokAds = tiktokData;
            processedSegment.analysis[audienceProfileIndex] = audienceProfile;
          }
        }
      }
    } else if (processedSegment.analysis.type === "audienceProfile" && tiktokData) {
      // Si ya es un audienceProfile, asegurarse de que tenga datos de TikTok
      if (processedSegment.analysis.data && processedSegment.analysis.data.adPlatforms) {
        if (!processedSegment.analysis.data.adPlatforms.tiktokAds) {
          processedSegment.analysis.data.adPlatforms.tiktokAds = tiktokData;
        }
      }
    }
  }
  
  return processedSegment;
};

// Function to check if segment has analysis data
const hasAnalysisData = (segment: Segment): boolean => {
  if (!segment) return false;
  
  // Check if analysis exists and is non-empty
  if (!segment.analysis) return false;
  
  // If analysis is an array, check if it has items with data
  if (Array.isArray(segment.analysis)) {
    return segment.analysis.some(item => 
      item && item.data && 
      (item.data.adPlatforms || 
       Object.keys(item.data).length > 0)
    );
  }
  
  // If analysis is an object with data property
  if (segment.analysis.data) {
    // Check if data.adPlatforms exists
    if (segment.analysis.data.adPlatforms) {
      // Check if any ad platform has data
      const adPlatforms = segment.analysis.data.adPlatforms;
      return Object.keys(adPlatforms).some(platform => 
        adPlatforms[platform] && 
        Object.keys(adPlatforms[platform]).length > 0
      );
    }
    
    // Otherwise check if data has any properties
    return Object.keys(segment.analysis.data).length > 0;
  }
  
  // If analysis has direct adPlatforms property
  if ((segment.analysis as any).adPlatforms) {
    const adPlatforms = (segment.analysis as any).adPlatforms;
    return Object.keys(adPlatforms).some(platform => 
      adPlatforms[platform] && 
      Object.keys(adPlatforms[platform]).length > 0
    );
  }
  
  // Check if segment has audience data
  if (segment.audience) {
    return true;
  }
  
  // If none of the above, assume no analysis data
  return false;
};

export default function SegmentAnalysisTab({ segment, selectedAdPlatform }: SegmentAnalysisTabProps) {
  const { isDarkMode } = useTheme()
  const [parsedSegment, setParsedSegment] = useState<Segment | null>(null)

  useEffect(() => {
    if (segment) {
      setParsedSegment(segment)
    }
  }, [segment]);

  // If there's no analysis data, show an empty state
  if (!segment?.analysis) {
    return (
      <EmptyState
        icon={<BarChart className="h-12 w-12 text-primary/60" />}
        title="No Analysis Available"
        description="There's no analysis data for this segment yet. Run an analysis to understand your audience better."
        action={
          <Button 
            variant="default" 
            className="flex items-center gap-2"
          >
            <BarChart className="h-4 w-4" />
            Analyze with AI
          </Button>
        }
      />
    );
  }

  const currentSegment = parsedSegment || segment;

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      <PerformanceMetricsComponent isDarkMode={isDarkMode} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Penetration Card */}
        <MarketPenetrationComponent 
          segment={currentSegment}
          selectedAdPlatform={selectedAdPlatform}
        />

        {/* Behavior Card */}
        <BehaviorComponent 
          segment={currentSegment}
          selectedAdPlatform={selectedAdPlatform}
          copyStates={{ interests: false, demographics: false, behavior: false, regional: false }}
          copyToClipboard={async () => {}}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demographics Card */}
        <DemographicsComponent 
          segment={currentSegment}
          selectedAdPlatform={selectedAdPlatform}
          copyStates={{ interests: false, demographics: false, behavior: false, regional: false }}
          copyToClipboard={async () => {}}
          isDarkMode={isDarkMode}
        />
        
        {/* Regional Distribution Card */}
        <RegionalDistributionComponent 
          segment={currentSegment}
          selectedAdPlatform={selectedAdPlatform}
          copyStates={{ interests: false, demographics: false, behavior: false, regional: false }}
          copyToClipboard={async () => {}}
        />
      </div>
    </div>
  );
} 