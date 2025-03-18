import { NewAdPlatformType } from "./types";
import { dummyAudienceData, regionData } from "./data";
import { LocationData } from "@/app/components/WorldMapComponent";
import { Segment } from "../../page";

// Get platform display name
export const getPlatformDisplayName = (platform: NewAdPlatformType): string => {
  switch (platform) {
    case "googleAds": return "Google";
    case "facebookAds": return "Facebook";
    case "linkedInAds": return "LinkedIn";
    case "tiktokAds": return "TikTok";
    default: return platform;
  }
};

// Function to get the audience profile data
export const getAudienceProfile = (segment: Segment) => {
  try {
    if (!segment?.analysis) {
      return null;
    }
    
    // Buscar datos de TikTok en el segmento original
    let tiktokData = null;
    
    // Verificar si hay datos de TikTok en el segmento original
    if (typeof segment.analysis === 'object') {
      // Verificar si hay datos de TikTok en diferentes estructuras posibles
      const hasTikTokInArray = Array.isArray(segment.analysis) && 
        segment.analysis.some(item => 
          item?.data?.adPlatforms?.tiktokAds || 
          (item as any)?.adPlatforms?.tiktokAds
        );
      
      const hasTikTokInObject = !Array.isArray(segment.analysis) && (
        segment.analysis?.data?.adPlatforms?.tiktokAds ||
        (segment.analysis as any)?.adPlatforms?.tiktokAds ||
        (segment.analysis as any)?.tiktokAds
      );
      
      // Intentar extraer los datos de TikTok
      if (hasTikTokInArray && Array.isArray(segment.analysis)) {
        for (const item of segment.analysis) {
          if (item?.data?.adPlatforms?.tiktokAds) {
            tiktokData = item.data.adPlatforms.tiktokAds;
            break;
          }
          if ((item as any)?.adPlatforms?.tiktokAds) {
            tiktokData = (item as any).adPlatforms.tiktokAds;
            break;
          }
        }
      } else if (hasTikTokInObject && !Array.isArray(segment.analysis)) {
        if (segment.analysis?.data?.adPlatforms?.tiktokAds) {
          tiktokData = segment.analysis.data.adPlatforms.tiktokAds;
        } else if ((segment.analysis as any)?.adPlatforms?.tiktokAds) {
          tiktokData = (segment.analysis as any).adPlatforms.tiktokAds;
        } else if ((segment.analysis as any)?.tiktokAds) {
          tiktokData = (segment.analysis as any).tiktokAds;
        }
      }
    }
    
    // Buscar también en segment.audience si está disponible
    if (!tiktokData && segment.audience && typeof segment.audience === 'string') {
      try {
        // Intentar parsear audience como JSON
        const audienceData = JSON.parse(segment.audience);
        if (Array.isArray(audienceData)) {
          // Buscar en cada elemento del array
          for (const item of audienceData) {
            if (item?.data?.adPlatforms?.tiktokAds) {
              tiktokData = item.data.adPlatforms.tiktokAds;
              break;
            }
          }
        } else if (typeof audienceData === 'object' && audienceData !== null) {
          // Buscar en el objeto
          if (audienceData?.data?.adPlatforms?.tiktokAds) {
            tiktokData = audienceData.data.adPlatforms.tiktokAds;
          }
        }
      } catch (e) {
        // No se pudo parsear segment.audience como JSON
      }
    }
    
    // If analysis is an array, find the audienceProfile object
    if (Array.isArray(segment.analysis)) {
      const audienceProfile = segment.analysis.find(item => item.type === "audienceProfile");
      
      // Verificar si el audienceProfile encontrado tiene datos de TikTok
      if (audienceProfile?.data?.adPlatforms) {
        // Si no tiene datos de TikTok pero tenemos datos de TikTok de otra fuente, añadirlos
        if (!audienceProfile.data.adPlatforms.tiktokAds && tiktokData) {
          audienceProfile.data.adPlatforms.tiktokAds = tiktokData;
        }
      }
      
      return audienceProfile;
    }
    
    // If analysis is already the audienceProfile object
    if (segment.analysis.type === "audienceProfile") {
      // Verificar si tiene datos de TikTok
      if (segment.analysis?.data?.adPlatforms) {
        // Si no tiene datos de TikTok pero tenemos datos de TikTok de otra fuente, añadirlos
        if (!segment.analysis.data.adPlatforms.tiktokAds && tiktokData) {
          segment.analysis.data.adPlatforms.tiktokAds = tiktokData;
        }
      }
      
      return segment.analysis;
    }
    
    // Si analysis es un objeto pero no tiene type, intentar usarlo directamente
    if (typeof segment.analysis === 'object' && segment.analysis !== null) {
      // Verificar si tiene la estructura esperada (data.adPlatforms)
      if (segment.analysis.data && 'adPlatforms' in segment.analysis.data) {
        // Verificar si tiene datos de TikTok
        const adPlatforms = segment.analysis.data.adPlatforms;
        
        // Si no tiene TikTok pero tenemos datos de TikTok de otra fuente, añadirlos
        if (!adPlatforms.tiktokAds && tiktokData) {
          adPlatforms.tiktokAds = tiktokData;
        }
        // Si no tiene TikTok pero tiene otras plataformas, intentar recuperar TikTok de otro lugar
        else if (!adPlatforms.tiktokAds && (adPlatforms.googleAds || adPlatforms.facebookAds || adPlatforms.linkedInAds)) {
          // Buscar datos de TikTok en el segmento original
          if (segment.audience && typeof segment.audience === 'string') {
            try {
              const audienceData = JSON.parse(segment.audience);
              if (Array.isArray(audienceData)) {
                const audienceItem = audienceData.find(item => item.type === "audienceProfile");
                if (audienceItem?.data?.adPlatforms?.tiktokAds) {
                  adPlatforms.tiktokAds = audienceItem.data.adPlatforms.tiktokAds;
                }
              }
            } catch (e) {
              // No se pudo parsear segment.audience
            }
          }
        }
        
        return {
          type: "audienceProfile",
          data: segment.analysis.data
        };
      }
      
      // Si tiene adPlatforms directamente
      if ('adPlatforms' in (segment.analysis as any)) {
        // Verificar si tiene datos de TikTok
        const adPlatforms = (segment.analysis as any).adPlatforms;
        
        // Si no tiene TikTok pero tenemos datos de TikTok de otra fuente, añadirlos
        if (!adPlatforms.tiktokAds && tiktokData) {
          adPlatforms.tiktokAds = tiktokData;
        }
        
        return {
          type: "audienceProfile",
          data: {
            adPlatforms: (segment.analysis as any).adPlatforms
          }
        };
      }
      
      // Verificar si tiene datos de TikTok directamente
      if ('tiktokAds' in (segment.analysis as any)) {
        // Crear una estructura adPlatforms con los datos de TikTok
        return {
          type: "audienceProfile",
          data: {
            adPlatforms: {
              tiktokAds: (segment.analysis as any).tiktokAds
            }
          }
        };
      }
    }
    
    // Si no encontramos un audienceProfile pero tenemos datos de TikTok, crear uno nuevo
    if (tiktokData) {
      return {
        type: "audienceProfile",
        data: {
          adPlatforms: {
            tiktokAds: tiktokData
          }
        }
      };
    }
    
    // Si llegamos aquí, no hemos encontrado datos de TikTok en ninguna parte
    // Intentar recuperar los datos de TikTok de otras plataformas
    let foundAudienceProfile = null;

    // Si analysis es un array, buscar el audienceProfile
    if (Array.isArray(segment.analysis)) {
      foundAudienceProfile = segment.analysis.find(item => item.type === "audienceProfile");
    } 
    // Si analysis ya es un audienceProfile
    else if (segment.analysis?.type === "audienceProfile") {
      foundAudienceProfile = segment.analysis;
    } 
    // Si analysis es un objeto con data.adPlatforms
    else if (segment.analysis?.data?.adPlatforms) {
      foundAudienceProfile = {
        type: "audienceProfile",
        data: segment.analysis.data
      };
    }

    if (foundAudienceProfile?.data?.adPlatforms) {
      const adPlatforms = foundAudienceProfile.data.adPlatforms;
      
      // Si hay datos de otras plataformas pero no de TikTok, intentar copiar la estructura
      if ((adPlatforms.googleAds || adPlatforms.facebookAds || adPlatforms.linkedInAds) && !adPlatforms.tiktokAds) {
        // Crear una estructura básica para TikTok basada en las otras plataformas
        const tiktokStructure: any = {};
        
        // Copiar estructura de demographics si existe
        if (adPlatforms.googleAds?.demographics || adPlatforms.facebookAds?.demographics || adPlatforms.linkedInAds?.demographics) {
          tiktokStructure.demographics = {
            age: [],
            gender: []
          };
        }
        
        // Copiar estructura de interests si existe
        if (adPlatforms.googleAds?.interests || adPlatforms.facebookAds?.interests) {
          tiktokStructure.interests = [];
        }
        
        // Añadir behaviors y creatorCategories específicos de TikTok
        tiktokStructure.behaviors = [];
        tiktokStructure.creatorCategories = [];
        
        // Copiar estructura de locations si existe
        if (adPlatforms.googleAds?.locations || adPlatforms.facebookAds?.locations || adPlatforms.linkedInAds?.locations) {
          tiktokStructure.locations = {
            countries: [],
            regions: [],
            cities: []
          };
        }
        
        // Añadir la estructura a adPlatforms
        adPlatforms.tiktokAds = tiktokStructure;
        
        return foundAudienceProfile;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error getting audience profile:", error);
    return null;
  }
};

// Helper function to get age range display for the current platform
export const getAgeRangeDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms) {
      return 'Not available';
    }
    
    const { adPlatforms } = audienceProfile.data;
    
    // For Google Ads, check ageRanges
    if (selectedAdPlatform === 'googleAds' && adPlatforms.googleAds?.demographics?.ageRanges) {
      const ageRanges = adPlatforms.googleAds.demographics.ageRanges;
      if (Array.isArray(ageRanges) && ageRanges.length > 0) {
        return ageRanges.join(', ');
      }
    }
    
    // For Facebook Ads, check age
    if (selectedAdPlatform === 'facebookAds' && adPlatforms.facebookAds?.demographics?.age) {
      const ageData = adPlatforms.facebookAds.demographics.age;
      if (Array.isArray(ageData) && ageData.length > 0) {
        // Convert array of numbers to range
        return `${Math.min(...ageData)}-${Math.max(...ageData)}`;
      }
    }
    
    // For LinkedIn Ads, check age
    if (selectedAdPlatform === 'linkedInAds' && adPlatforms.linkedInAds?.demographics?.age) {
      const ageData = adPlatforms.linkedInAds.demographics.age;
      if (Array.isArray(ageData) && ageData.length > 0) {
        return ageData.join(', ');
      }
    }
    
    // For TikTok Ads, check age
    if (selectedAdPlatform === 'tiktokAds' && adPlatforms.tiktokAds?.demographics?.age) {
      const ageData = adPlatforms.tiktokAds.demographics.age;
      if (Array.isArray(ageData) && ageData.length > 0) {
        return ageData.join(', ');
      }
    }
    
    return 'Not available';
  } catch (error) {
    console.error(`Error getting age range for ${selectedAdPlatform}:`, error);
    return 'Not available';
  }
};

// Helper function to get gender display for the current platform
export const getGenderDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms) {
      return 'Not available';
    }
    
    const { adPlatforms } = audienceProfile.data;
    
    // For Google Ads, check gender
    if (selectedAdPlatform === 'googleAds' && adPlatforms.googleAds?.demographics?.gender) {
      const genderData = adPlatforms.googleAds.demographics.gender;
      if (Array.isArray(genderData) && genderData.length > 0) {
        return genderData.join(', ');
      }
    }
    
    // For Facebook Ads, default to male/female if not specified
    if (selectedAdPlatform === 'facebookAds') {
      return 'male, female';
    }
    
    // For LinkedIn Ads, default to male/female if not specified
    if (selectedAdPlatform === 'linkedInAds') {
      return 'male, female';
    }
    
    // For TikTok Ads, check gender
    if (selectedAdPlatform === 'tiktokAds' && adPlatforms.tiktokAds?.demographics?.gender) {
      const genderData = adPlatforms.tiktokAds.demographics.gender;
      if (Array.isArray(genderData) && genderData.length > 0) {
        return genderData.join(', ');
      }
    }
    
    return 'Not available';
  } catch (error) {
    console.error(`Error getting gender for ${selectedAdPlatform}:`, error);
    return 'Not available';
  }
};

// Helper function to get interests for the current platform
export const getInterestsForPlatform = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms) {
      return [];
    }
    
    const { adPlatforms } = audienceProfile.data;
    
    // For Google Ads, check interests
    if (selectedAdPlatform === 'googleAds' && adPlatforms.googleAds?.interests) {
      return Array.isArray(adPlatforms.googleAds.interests) ? adPlatforms.googleAds.interests : [];
    }
    
    // For Facebook Ads, check interests
    if (selectedAdPlatform === 'facebookAds' && adPlatforms.facebookAds?.interests) {
      return Array.isArray(adPlatforms.facebookAds.interests) ? adPlatforms.facebookAds.interests : [];
    }
    
    // For LinkedIn Ads, check industries
    if (selectedAdPlatform === 'linkedInAds' && adPlatforms.linkedInAds?.industries) {
      return Array.isArray(adPlatforms.linkedInAds.industries) ? adPlatforms.linkedInAds.industries : [];
    }
    
    // For TikTok Ads, check interests
    if (selectedAdPlatform === 'tiktokAds' && adPlatforms.tiktokAds?.interests) {
      return Array.isArray(adPlatforms.tiktokAds.interests) ? adPlatforms.tiktokAds.interests : [];
    }
    
    return [];
  } catch (error) {
    console.error(`Error getting interests for ${selectedAdPlatform}:`, error);
    return [];
  }
};

// Get keywords for the platform
export const getKeywordsForPlatform = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms) {
      return [];
    }
    
    const { adPlatforms } = audienceProfile.data;
    const keywords: string[] = [];
    
    // For Google Ads, combine interests and inMarketSegments
    if (selectedAdPlatform === 'googleAds') {
      if (adPlatforms.googleAds?.interests) {
        keywords.push(...adPlatforms.googleAds.interests);
      }
      if (adPlatforms.googleAds?.inMarketSegments) {
        keywords.push(...adPlatforms.googleAds.inMarketSegments);
      }
    }
    
    // For Facebook Ads, use interests
    if (selectedAdPlatform === 'facebookAds' && adPlatforms.facebookAds?.interests) {
      keywords.push(...adPlatforms.facebookAds.interests);
    }
    
    // For LinkedIn Ads, combine jobTitles and industries
    if (selectedAdPlatform === 'linkedInAds') {
      if (adPlatforms.linkedInAds?.jobTitles) {
        keywords.push(...adPlatforms.linkedInAds.jobTitles);
      }
      if (adPlatforms.linkedInAds?.industries) {
        keywords.push(...adPlatforms.linkedInAds.industries);
      }
    }
    
    // For TikTok Ads, combine interests and behaviors
    if (selectedAdPlatform === 'tiktokAds') {
      if (adPlatforms.tiktokAds?.interests) {
        keywords.push(...adPlatforms.tiktokAds.interests);
      }
      if (adPlatforms.tiktokAds?.behaviors) {
        keywords.push(...adPlatforms.tiktokAds.behaviors);
      }
    }
    
    return keywords;
  } catch (error) {
    console.error(`Error getting keywords for ${selectedAdPlatform}:`, error);
    return [];
  }
};

// Get behavior data for the current platform
export const getBehaviorForPlatform = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    
    if (!audienceProfile?.data?.adPlatforms) {
      return [];
    }
    
    const { adPlatforms } = audienceProfile.data;
    
    // For Google Ads, use inMarketSegments
    if (selectedAdPlatform === 'googleAds' && adPlatforms.googleAds?.inMarketSegments) {
      return Array.isArray(adPlatforms.googleAds.inMarketSegments) ? adPlatforms.googleAds.inMarketSegments : [];
    }
    
    // For Facebook Ads, use interests
    if (selectedAdPlatform === 'facebookAds' && adPlatforms.facebookAds?.interests) {
      return Array.isArray(adPlatforms.facebookAds.interests) ? adPlatforms.facebookAds.interests : [];
    }
    
    // For LinkedIn Ads, use jobTitles
    if (selectedAdPlatform === 'linkedInAds' && adPlatforms.linkedInAds?.jobTitles) {
      return Array.isArray(adPlatforms.linkedInAds.jobTitles) ? adPlatforms.linkedInAds.jobTitles : [];
    }
    
    // For TikTok Ads, use behaviors or interests as fallback
    if (selectedAdPlatform === 'tiktokAds') {
      // Verificar si tiktokAds existe
      if (!adPlatforms.tiktokAds) {
        return [];
      }
      
      // Si no hay datos de behaviors, intentar usar interests como fallback
      if (adPlatforms.tiktokAds.behaviors && Array.isArray(adPlatforms.tiktokAds.behaviors) && adPlatforms.tiktokAds.behaviors.length > 0) {
        return adPlatforms.tiktokAds.behaviors;
      } else if (adPlatforms.tiktokAds.interests && Array.isArray(adPlatforms.tiktokAds.interests) && adPlatforms.tiktokAds.interests.length > 0) {
        return adPlatforms.tiktokAds.interests;
      } else if (adPlatforms.tiktokAds.creatorCategories && Array.isArray(adPlatforms.tiktokAds.creatorCategories) && adPlatforms.tiktokAds.creatorCategories.length > 0) {
        return adPlatforms.tiktokAds.creatorCategories;
      }
      
      // Si no hay datos específicos de TikTok, intentar usar datos de otras plataformas como fallback
      if (adPlatforms.facebookAds?.interests && Array.isArray(adPlatforms.facebookAds.interests) && adPlatforms.facebookAds.interests.length > 0) {
        return adPlatforms.facebookAds.interests;
      } else if (adPlatforms.googleAds?.interests && Array.isArray(adPlatforms.googleAds.interests) && adPlatforms.googleAds.interests.length > 0) {
        return adPlatforms.googleAds.interests;
      }
      
      return [];
    }
    
    return [];
  } catch (error) {
    console.error(`Error getting behavior data for ${selectedAdPlatform}:`, error);
    return [];
  }
};

// Get countries from the selected platform
export const getCountriesFromPlatform = (segment: Segment, selectedAdPlatform: NewAdPlatformType): LocationData[] => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms) {
      return [];
    }
    
    const { adPlatforms } = audienceProfile.data;
    
    // For Google Ads, check locations first (prioritized) or geoTargeting.countries as fallback
    if (selectedAdPlatform === 'googleAds') {
      if (adPlatforms.googleAds?.locations) {
        return mapCountriesToLocationData(
          Array.isArray(adPlatforms.googleAds.locations) ? adPlatforms.googleAds.locations : []
        );
      }
      // Only use geoTargeting as fallback if locations is not available
      if (adPlatforms.googleAds?.geoTargeting?.countries) {
        return mapCountriesToLocationData(adPlatforms.googleAds.geoTargeting.countries);
      }
    }
    
    // For Facebook Ads, check locations.countries
    if (selectedAdPlatform === 'facebookAds' && adPlatforms.facebookAds?.locations?.countries) {
      return mapCountriesToLocationData(adPlatforms.facebookAds.locations.countries);
    }
    
    // For LinkedIn Ads, check locations.countries
    if (selectedAdPlatform === 'linkedInAds' && adPlatforms.linkedInAds?.locations?.countries) {
      return mapCountriesToLocationData(adPlatforms.linkedInAds.locations.countries);
    }
    
    // For TikTok Ads, check locations.countries
    if (selectedAdPlatform === 'tiktokAds' && adPlatforms.tiktokAds?.locations?.countries) {
      return mapCountriesToLocationData(adPlatforms.tiktokAds.locations.countries);
    }
    
    return [];
  } catch (error) {
    console.error(`Error getting countries for ${selectedAdPlatform}:`, error);
    return [];
  }
};

// Helper function to map countries to LocationData
const mapCountriesToLocationData = (countries: string[]): LocationData[] => {
  return countries.map((country, index) => {
    const hue = (220 + (index * 40)) % 360;
    const color = `hsl(${hue}, 70%, 60%)`;
    const existingRegion = regionData.find(r => r.name === country);
    
    return {
      name: country,
      coordinates: existingRegion ? existingRegion.coordinates : [-0.1278, 51.5074] as [number, number],
      value: 100 - (index * 10),
      color: color,
      relevance: index < 2 ? "High" : index < 4 ? "Medium" : "Low"
    };
  });
};

// Function to extract Google Ads geo targeting data from the segment
export const getGoogleGeoTargeting = (segment: Segment): { regions: string[], cities: string[] } | null => {
  try {
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.googleAds) {
      return null;
    }
    
    const googleAds = audienceProfile.data.adPlatforms.googleAds;
    const regions: string[] = [];
    const cities: string[] = [];
    
    // Check if geoTargeting exists
    if (googleAds.geoTargeting) {
      // Extract regions
      if (Array.isArray(googleAds.geoTargeting.regions)) {
        regions.push(...googleAds.geoTargeting.regions);
      }
      
      // Extract cities
      if (Array.isArray(googleAds.geoTargeting.cities)) {
        cities.push(...googleAds.geoTargeting.cities);
      }
    }
    
    // Remove duplicates
    const uniqueRegions = Array.from(new Set(regions));
    const uniqueCities = Array.from(new Set(cities));
    
    return {
      regions: uniqueRegions,
      cities: uniqueCities
    };
  } catch (error) {
    console.error("Error getting Google geo targeting data:", error);
    return { regions: [], cities: [] };
  }
};

// Debug utility function to log segment analysis data
export const debugSegmentAnalysis = (segment: Segment, platform: string): void => {
  console.log("Debug Segment Analysis:");
  console.log("- Platform:", platform);
  
  if (!segment) {
    console.log("- Segment is null or undefined");
    return;
  }
  
  console.log("- Segment ID:", segment.id);
  console.log("- Segment Name:", segment.name);
  
  const audienceProfile = getAudienceProfile(segment);
  if (!audienceProfile) {
    console.log("- Audience profile not found in segment");
    return;
  }
  
  console.log("- Audience profile type:", audienceProfile.type);
  
  if (audienceProfile.data?.adPlatforms) {
    console.log("- Available ad platforms:", Object.keys(audienceProfile.data.adPlatforms));
    
    if (audienceProfile.data.adPlatforms[platform as NewAdPlatformType]) {
      console.log(`- ${platform} data available:`, 
        Object.keys(audienceProfile.data.adPlatforms[platform as NewAdPlatformType]));
    } else {
      console.log(`- No data available for ${platform}`);
    }
  } else {
    console.log("- No ad platforms data available");
  }
};

// Función unificada para obtener datos de plataformas publicitarias
export const getAdPlatformData = (segment: Segment, platform: NewAdPlatformType): any => {
  if (!segment) {
    return null;
  }
  
  const audienceProfile = getAudienceProfile(segment);
  if (!audienceProfile?.data?.adPlatforms?.[platform]) {
    return null;
  }
  
  return audienceProfile.data.adPlatforms[platform];
};

// Helper function to get parental status for Google Ads
export const getParentalStatusDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'googleAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.googleAds?.demographics?.parentalStatus) {
      return [];
    }
    
    const parentalStatus = audienceProfile.data.adPlatforms.googleAds.demographics.parentalStatus;
    if (Array.isArray(parentalStatus) && parentalStatus.length > 0) {
      return parentalStatus;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting parental status:", error);
    return [];
  }
};

// Helper function to get household income for Google Ads
export const getHouseholdIncomeDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'googleAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.googleAds?.demographics?.householdIncome) {
      return [];
    }
    
    const householdIncome = audienceProfile.data.adPlatforms.googleAds.demographics.householdIncome;
    if (Array.isArray(householdIncome) && householdIncome.length > 0) {
      return householdIncome;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting household income:", error);
    return [];
  }
};

// Helper function to get education for Facebook Ads
export const getEducationDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'facebookAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.facebookAds?.demographics?.education) {
      return [];
    }
    
    const education = audienceProfile.data.adPlatforms.facebookAds.demographics.education;
    if (Array.isArray(education) && education.length > 0) {
      return education;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting education:", error);
    return [];
  }
};

// Helper function to get generation for Facebook Ads
export const getGenerationDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'facebookAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.facebookAds?.demographics?.generation) {
      return [];
    }
    
    const generation = audienceProfile.data.adPlatforms.facebookAds.demographics.generation;
    if (Array.isArray(generation) && generation.length > 0) {
      return generation;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting generation:", error);
    return [];
  }
};

// Helper function to get education for LinkedIn Ads
export const getLinkedInEducationDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'linkedInAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.linkedInAds?.demographics?.education) {
      return [];
    }
    
    const education = audienceProfile.data.adPlatforms.linkedInAds.demographics.education;
    if (Array.isArray(education) && education.length > 0) {
      return education;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting LinkedIn education:", error);
    return [];
  }
};

// Helper function to get job experience for LinkedIn Ads
export const getJobExperienceDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'linkedInAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.linkedInAds?.demographics?.jobExperience) {
      return [];
    }
    
    const jobExperience = audienceProfile.data.adPlatforms.linkedInAds.demographics.jobExperience;
    if (Array.isArray(jobExperience) && jobExperience.length > 0) {
      return jobExperience;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting job experience:", error);
    return [];
  }
};

// Helper function to get regions for LinkedIn Ads
export const getLinkedInRegionsDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'linkedInAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.linkedInAds?.locations?.regions) {
      return [];
    }
    
    const regions = audienceProfile.data.adPlatforms.linkedInAds.locations.regions;
    if (Array.isArray(regions) && regions.length > 0) {
      return regions;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting LinkedIn regions:", error);
    return [];
  }
};

// Helper function to get metropolitan areas for LinkedIn Ads
export const getLinkedInMetroAreasDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'linkedInAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.linkedInAds?.locations?.metropolitanAreas) {
      return [];
    }
    
    const metroAreas = audienceProfile.data.adPlatforms.linkedInAds.locations.metropolitanAreas;
    if (Array.isArray(metroAreas) && metroAreas.length > 0) {
      return metroAreas;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting LinkedIn metropolitan areas:", error);
    return [];
  }
};

// Helper function to get zip codes for Facebook Ads
export const getFacebookZipsDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'facebookAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.facebookAds?.locations?.zips) {
      return [];
    }
    
    const zips = audienceProfile.data.adPlatforms.facebookAds.locations.zips;
    if (Array.isArray(zips) && zips.length > 0) {
      return zips;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting Facebook zip codes:", error);
    return [];
  }
};

// Helper function to get cities for Facebook Ads
export const getFacebookCitiesDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'facebookAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.facebookAds?.locations?.cities) {
      return [];
    }
    
    const cities = audienceProfile.data.adPlatforms.facebookAds.locations.cities;
    if (Array.isArray(cities) && cities.length > 0) {
      return cities;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting Facebook cities:", error);
    return [];
  }
};

// Helper function to get regions for Facebook Ads
export const getFacebookRegionsDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'facebookAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    if (!audienceProfile?.data?.adPlatforms?.facebookAds?.locations?.regions) {
      return [];
    }
    
    const regions = audienceProfile.data.adPlatforms.facebookAds.locations.regions;
    if (Array.isArray(regions) && regions.length > 0) {
      return regions;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting Facebook regions:", error);
    return [];
  }
};

// Helper function to get locations for TikTok Ads
export const getTikTokLocationsDisplay = (segment: Segment, selectedAdPlatform: NewAdPlatformType): string[] => {
  try {
    if (selectedAdPlatform !== 'tiktokAds') {
      return [];
    }
    
    const audienceProfile = getAudienceProfile(segment);
    
    // Check for locations in demographics
    if (audienceProfile?.data?.adPlatforms?.tiktokAds?.demographics?.location) {
      const locations = audienceProfile.data.adPlatforms.tiktokAds.demographics.location;
      if (Array.isArray(locations) && locations.length > 0) {
        return locations;
      }
    }
    
    // Alternative path: check for locations directly in tiktokAds
    if (audienceProfile?.data?.adPlatforms?.tiktokAds?.location) {
      const locations = audienceProfile.data.adPlatforms.tiktokAds.location;
      if (Array.isArray(locations) && locations.length > 0) {
        return locations;
      }
    }
    
    // Another alternative path: check for locations in a different structure
    if (audienceProfile?.data?.adPlatforms?.tiktokAds?.locations) {
      const locations = audienceProfile.data.adPlatforms.tiktokAds.locations;
      if (Array.isArray(locations) && locations.length > 0) {
        return locations;
      }
    }
    
    return [];
  } catch (error) {
    console.error("Error getting TikTok locations:", error);
    return [];
  }
}; 