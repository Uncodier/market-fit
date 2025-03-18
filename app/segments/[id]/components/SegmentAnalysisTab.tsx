import React, { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Segment } from "../page"
import { useTheme } from '@/app/context/ThemeContext'
import { CopyStates, NewAdPlatformType } from "./analysisComponents/types"
import { PerformanceMetricsComponent } from "./analysisComponents/PerformanceMetricsComponent"
import { DemographicsComponent } from "./analysisComponents/DemographicsComponent"
import { BehaviorComponent } from "./analysisComponents/BehaviorComponent"
import { MarketPenetrationComponent } from "./analysisComponents/MarketPenetrationComponent"
import { RegionalDistributionComponent } from "./analysisComponents/RegionalDistributionComponent"

interface SegmentAnalysisTabProps {
  segment: Segment
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

export function SegmentAnalysisTab({ segment }: SegmentAnalysisTabProps) {
  const [selectedAdPlatform, setSelectedAdPlatform] = useState<NewAdPlatformType>("googleAds")
  const [copyStates, setCopyStates] = useState<CopyStates>({
    interests: false,
    demographics: false,
    behavior: false,
    regional: false
  })
  const { isDarkMode } = useTheme()
  const [parsedSegment, setParsedSegment] = useState<Segment | null>(null)

  // Debug log for behavior data
  useEffect(() => {
    if (segment) {
      try {
        // Procesar el segmento de manera segura
        const processedSegment = safelyProcessSegment(segment);
        
        // Find the audienceProfile in the segment data
        const audienceProfile = findAudienceProfile(processedSegment);
        
        // Verificar si el audienceProfile tiene datos de TikTok
        if (audienceProfile?.data?.adPlatforms) {
          if (!audienceProfile.data.adPlatforms.tiktokAds) {
            // Verificar si hay datos de TikTok en el segmento procesado
            if (processedSegment.analysis) {
              // Buscar datos de TikTok en diferentes estructuras posibles
              let tiktokData = null;
              
              if (Array.isArray(processedSegment.analysis)) {
                // Buscar en cada elemento del array
                for (const item of processedSegment.analysis) {
                  if (item?.data?.adPlatforms?.tiktokAds) {
                    tiktokData = item.data.adPlatforms.tiktokAds;
                    break;
                  }
                }
              } else if (typeof processedSegment.analysis === 'object') {
                // Buscar en el objeto analysis
                if (processedSegment.analysis?.data?.adPlatforms?.tiktokAds) {
                  tiktokData = processedSegment.analysis.data.adPlatforms.tiktokAds;
                } else if ((processedSegment.analysis as any)?.adPlatforms?.tiktokAds) {
                  tiktokData = (processedSegment.analysis as any).adPlatforms.tiktokAds;
                }
              }
              
              // Si encontramos datos de TikTok, añadirlos al audienceProfile
              if (tiktokData && audienceProfile) {
                audienceProfile.data.adPlatforms.tiktokAds = tiktokData;
              }
            }
          }
        }
        
        if (audienceProfile) {
          // Actualizar el segmento procesado
          setParsedSegment({
            ...processedSegment,
            analysis: audienceProfile
          });
        } else {
          setParsedSegment(processedSegment);
        }
      } catch (error) {
        console.error("Error processing segment:", error);
        setParsedSegment(segment);
      }
    }
  }, [segment]);

  const handlePlatformChange = (platform: NewAdPlatformType) => {
    setSelectedAdPlatform(platform)
  }

  const copyToClipboard = async (text: string, id: keyof CopyStates) => {
    try {
      // Make sure we have valid text to copy
      const textToCopy = typeof text === 'string' ? text : 
                         typeof text === 'object' ? JSON.stringify(text, null, 2) : 
                         String(text);
                         
      await navigator.clipboard.writeText(textToCopy)
      setCopyStates(prev => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setCopyStates(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
      // Show error state briefly
      setCopyStates(prev => ({ ...prev, [id]: false }))
    }
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
      <PerformanceMetricsComponent isDarkMode={isDarkMode} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Penetration Card (formerly KeywordAnalysis) */}
        <MarketPenetrationComponent 
          segment={parsedSegment || segment}
          selectedAdPlatform={selectedAdPlatform}
        />

        {/* Behavior Card */}
        <BehaviorComponent 
          segment={parsedSegment || segment}
          selectedAdPlatform={selectedAdPlatform}
          copyStates={copyStates}
          copyToClipboard={copyToClipboard}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demographics Card - Moved down */}
        <DemographicsComponent 
          segment={parsedSegment || segment}
          selectedAdPlatform={selectedAdPlatform}
          copyStates={copyStates}
          copyToClipboard={copyToClipboard}
          isDarkMode={isDarkMode}
        />
        
        {/* Regional Distribution Card */}
        <RegionalDistributionComponent 
          segment={parsedSegment || segment}
          selectedAdPlatform={selectedAdPlatform}
          copyStates={copyStates}
          copyToClipboard={copyToClipboard}
        />
      </div>
    </div>
  )
} 