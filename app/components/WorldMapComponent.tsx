'use client';

import React, { useEffect, useState } from "react";
import { csv } from "d3-fetch";
import { scaleLinear } from "d3-scale";
import {
  ComposableMap,
  Geographies,
  Geography
} from "react-simple-maps";
import { useTheme } from '@/app/context/ThemeContext';

// URL for the GeoJSON world map
const geoUrl = "/features.json";

// Types for our data
export interface CountryData {
  ISO3: string;
  name?: string;
  [key: string]: any; // For additional data columns
}

// New interface for location data from ICP and Analysis tabs
export interface LocationData {
  name: string;
  coordinates?: [number, number];
  value?: number;
  color?: string;
  opacity?: number;
  relevance?: string;
  type?: string;
  ISO3?: string;
  isRegion?: boolean;
}

// ISO country code mapping for common countries
const countryNameToISO: Record<string, string> = {
  // North America
  "United States": "USA",
  "USA": "USA",
  "US": "USA",
  "Canada": "CAN",
  "Mexico": "MEX",
  "Guatemala": "GTM",
  "Honduras": "HND",
  "Nicaragua": "NIC",
  "Costa Rica": "CRI",
  "Panama": "PAN",
  "Cuba": "CUB",
  "Jamaica": "JAM",
  "Haiti": "HTI",
  "Dominican Republic": "DOM",
  
  // South America
  "Brazil": "BRA",
  "Argentina": "ARG",
  "Colombia": "COL",
  "Peru": "PER",
  "Chile": "CHL",
  "Venezuela": "VEN",
  "Ecuador": "ECU",
  "Bolivia": "BOL",
  "Paraguay": "PRY",
  "Uruguay": "URY",
  
  // Europe
  "United Kingdom": "GBR",
  "UK": "GBR",
  "Germany": "DEU",
  "France": "FRA",
  "Spain": "ESP",
  "Italy": "ITA",
  "Netherlands": "NLD",
  "Belgium": "BEL",
  "Portugal": "PRT",
  "Switzerland": "CHE",
  "Austria": "AUT",
  "Sweden": "SWE",
  "Norway": "NOR",
  "Denmark": "DNK",
  "Finland": "FIN",
  "Ireland": "IRL",
  "Poland": "POL",
  "Ukraine": "UKR",
  "Greece": "GRC",
  "Romania": "ROU",
  "Hungary": "HUN",
  "Czech Republic": "CZE",
  
  // Asia
  "China": "CHN",
  "Japan": "JPN",
  "India": "IND",
  "Russia": "RUS",
  "South Korea": "KOR",
  "Indonesia": "IDN",
  "Malaysia": "MYS",
  "Thailand": "THA",
  "Vietnam": "VNM",
  "Philippines": "PHL",
  "Singapore": "SGP",
  "Taiwan": "TWN",
  "Hong Kong": "HKG",
  "Pakistan": "PAK",
  "Bangladesh": "BGD",
  
  // Middle East
  "Saudi Arabia": "SAU",
  "UAE": "ARE",
  "United Arab Emirates": "ARE",
  "Israel": "ISR",
  "Turkey": "TUR",
  "Iran": "IRN",
  "Iraq": "IRQ",
  "Qatar": "QAT",
  "Kuwait": "KWT",
  "Oman": "OMN",
  "Jordan": "JOR",
  
  // Africa
  "South Africa": "ZAF",
  "Nigeria": "NGA",
  "Egypt": "EGY",
  "Kenya": "KEN",
  "Morocco": "MAR",
  "Algeria": "DZA",
  "Ethiopia": "ETH",
  "Ghana": "GHA",
  "Tanzania": "TZA",
  "Angola": "AGO",
  
  // Oceania
  "Australia": "AUS",
  "New Zealand": "NZL",
};

// Define regions with their member countries
const regions: Record<string, string[]> = {
  "North America": ["USA", "CAN", "MEX"],
  "South America": ["BRA", "ARG", "COL", "PER", "CHL", "VEN", "ECU", "BOL", "PRY", "URY"],
  "Central America": ["GTM", "HND", "NIC", "CRI", "PAN"],
  "Europe": ["GBR", "DEU", "FRA", "ESP", "ITA", "NLD", "BEL", "PRT", "CHE", "AUT", "SWE", "NOR", "DNK", "FIN", "IRL", "POL", "UKR", "GRC", "ROU", "HUN", "CZE"],
  "Western Europe": ["GBR", "FRA", "DEU", "BEL", "NLD", "LUX", "CHE", "AUT"],
  "Eastern Europe": ["POL", "UKR", "CZE", "SVK", "HUN", "ROU", "BGR", "MDA", "BLR"],
  "Northern Europe": ["SWE", "NOR", "DNK", "FIN", "ISL", "EST", "LVA", "LTU"],
  "Southern Europe": ["ESP", "ITA", "PRT", "GRC", "HRV", "SVN", "SRB", "MKD", "ALB", "MNE", "BIH"],
  "Asia": ["CHN", "JPN", "KOR", "IND", "IDN", "MYS", "THA", "VNM", "PHL", "SGP", "PAK", "BGD", "RUS"],
  "East Asia": ["CHN", "JPN", "KOR", "TWN", "HKG", "MNG"],
  "Southeast Asia": ["IDN", "MYS", "THA", "VNM", "PHL", "SGP", "MMR", "LAO", "KHM", "BRN"],
  "South Asia": ["IND", "PAK", "BGD", "LKA", "NPL", "BTN", "MDV"],
  "Middle East": ["SAU", "ARE", "ISR", "TUR", "IRN", "IRQ", "QAT", "KWT", "OMN", "JOR", "SYR", "LBN", "YEM", "BHR"],
  "Africa": ["ZAF", "NGA", "EGY", "KEN", "MAR", "DZA", "ETH", "GHA", "TZA", "AGO", "TUN", "LBY", "SDN", "UGA", "ZWE"],
  "North Africa": ["EGY", "MAR", "DZA", "TUN", "LBY"],
  "Sub-Saharan Africa": ["NGA", "ZAF", "KEN", "ETH", "GHA", "TZA", "AGO", "UGA", "ZWE", "ZMB", "SEN", "CMR"],
  "East Africa": ["KEN", "ETH", "TZA", "UGA", "RWA", "BDI", "SOM", "DJI", "ERI"],
  "West Africa": ["NGA", "GHA", "SEN", "CIV", "MLI", "GIN", "BFA", "BEN", "TGO", "LBR", "SLE", "GMB"],
  "Southern Africa": ["ZAF", "AGO", "ZWE", "ZMB", "MOZ", "BWA", "NAM", "MWI", "LSO", "SWZ"],
  "Oceania": ["AUS", "NZL", "PNG", "FJI", "SLB", "VUT", "WSM"],
  "Latin America": ["BRA", "MEX", "ARG", "COL", "PER", "CHL", "VEN", "ECU", "GTM", "CUB", "DOM", "BOL", "HND", "SLV", "NIC", "CRI", "PAN", "URY", "PRY"],
  "Caribbean": ["CUB", "DOM", "JAM", "HTI", "TTO", "BHS", "BRB", "ATG", "GRD", "VCT", "KNA", "LCA", "DMA"],
  "Nordic Countries": ["SWE", "NOR", "DNK", "FIN", "ISL"],
  "Scandinavia": ["SWE", "NOR", "DNK"],
  "Benelux": ["BEL", "NLD", "LUX"],
  "APAC": ["CHN", "JPN", "KOR", "IND", "AUS", "NZL", "IDN", "MYS", "THA", "VNM", "PHL", "SGP"],
  "EMEA": ["GBR", "DEU", "FRA", "ESP", "ITA", "RUS", "ZAF", "SAU", "ARE", "ISR", "TUR", "EGY", "MAR"],
  "LATAM": ["BRA", "MEX", "ARG", "COL", "PER", "CHL", "VEN", "ECU"],
  "DACH": ["DEU", "AUT", "CHE"],
  "MENA": ["SAU", "ARE", "ISR", "TUR", "IRN", "IRQ", "QAT", "KWT", "OMN", "JOR", "EGY", "MAR", "DZA", "TUN", "LBY"],
};

interface WorldMapComponentProps {
  dataUrl?: string;
  className?: string;
  onSelectCountry?: (country: CountryData | null) => void;
  selectedCountry?: string; // ISO3 code
  height?: string;
  width?: string;
  colorDomain?: [number, number];
  colorRange?: [string, string];
  valueField?: string;
  defaultColor?: string;
  // New props for location data
  locations?: LocationData[];
  onSelectLocation?: (location: LocationData) => void;
}

const WorldMapComponent: React.FC<WorldMapComponentProps> = ({
  dataUrl = "/vulnerability.csv",
  className = '',
  onSelectCountry,
  selectedCountry,
  height = '400px',
  width = '100%',
  colorDomain = [0.29, 0.68],
  colorRange = ["#ffedea", "#ff5233"],
  valueField = "2017",
  defaultColor = "#F5F4F6",
  locations = [],
  onSelectLocation
}) => {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<CountryData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [locationMap, setLocationMap] = useState<Record<string, LocationData>>({});

  // Create color scale
  const colorScale = scaleLinear<string>()
    .domain(colorDomain)
    .range(colorRange);

  // Process locations into a map for easy lookup
  useEffect(() => {
    if (locations && locations.length > 0) {
      const map: Record<string, LocationData> = {};
      
      locations.forEach(location => {
        // Check if this is a region
        const regionName = location.name;
        const isRegion = regions[regionName] !== undefined;
        
        if (isRegion) {
          // If it's a region, add all countries in that region
          const regionCountries = regions[regionName] || [];
          regionCountries.forEach(countryCode => {
            map[countryCode] = {
              ...location,
              ISO3: countryCode,
              isRegion: true
            };
          });
        } else {
          // If it's a single country, add it normally
          const iso3 = location.ISO3 || countryNameToISO[location.name] || "";
          if (iso3) {
            map[iso3] = {
              ...location,
              ISO3: iso3
            };
          }
        }
      });
      
      setLocationMap(map);
      setIsLoading(false);
    }
  }, [locations]);

  // Load data from CSV if no locations provided
  useEffect(() => {
    if (locations.length === 0) {
      setIsLoading(true);
      csv(dataUrl)
        .then((csvData: any[]) => {
          console.log("CSV data loaded:", csvData.length, "countries");
          setData(csvData as CountryData[]);
          setIsLoading(false);
        })
        .catch((error: Error) => {
          console.error("Error loading CSV data:", error);
          setIsLoading(false);
        });
    }
  }, [dataUrl, locations.length]);

  // Get fill color for a geography
  const getFillColor = (geo: any) => {
    // First check if we have location data for this country
    if (Object.keys(locationMap).length > 0) {
      const location = locationMap[geo.id];
      if (location) {
        return location.color || colorScale(location.value || 0.5);
      }
      return defaultColor;
    }
    
    // Otherwise use CSV data
    if (data.length > 0) {
      const d = data.find((s) => s.ISO3 === geo.id);
      if (d) {
        return colorScale(parseFloat(d[valueField]));
      }
    }
    
    return defaultColor;
  };

  return (
    <div 
      className={`relative ${className}`} 
      style={{ 
        height, 
        width,
        backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
        borderRadius: '0.5rem',
        overflow: 'hidden'
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 bg-opacity-70 z-10 dark:bg-slate-800 dark:bg-opacity-70">
          <div className="text-slate-700 dark:text-slate-200">Loading map data...</div>
        </div>
      )}
      
      <ComposableMap
        projectionConfig={{
          rotate: [-10, 0, 0],
          scale: 147
        }}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: isDarkMode ? "#1e293b" : "#f8fafc"
        }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const isSelected = selectedCountry === geo.id;
              const location = locationMap[geo.id];
              
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getFillColor(geo)}
                  stroke={isDarkMode ? "#64748b" : "#94a3b8"}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  style={{
                    default: {
                      outline: "none",
                      cursor: "pointer",
                      filter: isSelected ? "drop-shadow(0px 0px 4px rgba(239,68,68,0.7))" : "none",
                      opacity: location?.opacity !== undefined ? location.opacity : 1
                    },
                    hover: {
                      outline: "none",
                      cursor: "pointer",
                      filter: isSelected ? "drop-shadow(0px 0px 4px rgba(239,68,68,0.7))" : "none",
                      fill: "#94a3b8"
                    },
                    pressed: {
                      outline: "none"
                    }
                  }}
                  onClick={() => {
                    if (onSelectLocation && location) {
                      onSelectLocation(location);
                    } else if (onSelectCountry) {
                      const d = data.find((s) => s.ISO3 === geo.id);
                      if (d) {
                        onSelectCountry(d);
                      } else {
                        onSelectCountry({
                          ISO3: geo.id,
                          name: geo.properties?.NAME || geo.id
                        });
                      }
                    }
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      
      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 p-2 rounded-md shadow-md text-xs">
        {Object.keys(locationMap).length > 0 ? (
          <>
            {selectedCountry && (
              <div className="mb-2">
                <div className="font-bold">
                  {locationMap[selectedCountry]?.isRegion 
                    ? Object.entries(regions).find(([region, countries]) => 
                        countries.includes(selectedCountry))?.[0] || locationMap[selectedCountry]?.name
                    : locationMap[selectedCountry]?.name || 
                      data.find(d => d.ISO3 === selectedCountry)?.name || 
                      selectedCountry}
                </div>
                {locationMap[selectedCountry]?.relevance && (
                  <div>
                    Relevance: {locationMap[selectedCountry].relevance}
                  </div>
                )}
              </div>
            )}
            
            <div className="max-h-32 overflow-y-auto">
              {/* Group locations by region or show individual countries */}
              {(() => {
                // Get all unique locations (either regions or individual countries)
                const uniqueLocations = new Map<string, LocationData>();
                
                // First, identify all regions in the data
                const regionsInData = new Set<string>();
                Object.values(locationMap).forEach(location => {
                  if (location.isRegion) {
                    // Find which region this country belongs to
                    for (const [regionName, countries] of Object.entries(regions)) {
                      if (countries.includes(location.ISO3 || '')) {
                        regionsInData.add(regionName);
                        break;
                      }
                    }
                  } else {
                    // Add individual countries that aren't part of regions
                    uniqueLocations.set(location.ISO3 || '', location);
                  }
                });
                
                // Add regions to the unique locations
                regionsInData.forEach(regionName => {
                  // Find a representative location from this region to get color/relevance
                  const regionCountries = regions[regionName] || [];
                  const representativeLocation = locationMap[regionCountries[0]];
                  
                  if (representativeLocation) {
                    uniqueLocations.set(regionName, {
                      ...representativeLocation,
                      name: regionName,
                      isRegion: true
                    });
                  }
                });
                
                // Convert to array and sort
                return Array.from(uniqueLocations.values())
                  .sort((a, b) => {
                    // Sort by relevance or value
                    const aValue = a.relevance?.toLowerCase().includes('high') ? 3 : 
                                a.relevance?.toLowerCase().includes('medium') ? 2 : 1;
                    const bValue = b.relevance?.toLowerCase().includes('high') ? 3 : 
                                b.relevance?.toLowerCase().includes('medium') ? 2 : 1;
                    return bValue - aValue;
                  })
                  .slice(0, 5) // Show top 5 locations
                  .map((location, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: location.color || colorScale(location.value || 0.5) }}
                      ></div>
                      <span>{location.name}</span>
                      {location.relevance && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {location.relevance}
                        </span>
                      )}
                    </div>
                  ));
              })()}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <div className="flex h-2 w-32">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      backgroundColor: colorScale(colorDomain[0] + (i / 4) * (colorDomain[1] - colorDomain[0]))
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between w-full">
                <span>{colorDomain[0]}</span>
                <span>{colorDomain[1]}</span>
              </div>
            </div>
            
            {selectedCountry && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="font-bold">
                  {data.find(d => d.ISO3 === selectedCountry)?.name || selectedCountry}
                </div>
                {data.find(d => d.ISO3 === selectedCountry)?.[valueField] !== undefined && (
                  <div>
                    Value: {data.find(d => d.ISO3 === selectedCountry)?.[valueField]}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WorldMapComponent;
