import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { 
  User, CalendarIcon, User as GraduationCap, Circle as DollarSign, Globe, MessageSquare as Languages
} from "@/app/components/ui/icons";
import { SectionCard } from "../common/Cards";
import { ImportanceIndicator } from "../common/Indicators";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";
import { useTheme } from "@/app/context/ThemeContext";
import WorldMapComponent, { LocationData } from "@/app/components/WorldMapComponent";

// Defino la interfaz localmente para evitar problemas con el módulo de tipos
interface ICPProfileData {
  id: string;
  name: string;
  description: string;
  demographics: {
    ageRange?: {
      primary?: string;
      secondary?: string;
    };
    gender?: {
      distribution?: string;
    };
    locations?: Array<{
      type: string;
      name: string;
      relevance: string;
    }>;
    education?: {
      primary?: string;
      secondary?: string[] | string;
    };
    income?: {
      currency?: string;
      level?: string;
      range?: string;
    };
    languages?: Array<{
      name: string;
      proficiency: string;
      relevance: string;
    }>;
  };
}

interface DemographicsTabProps {
  icpProfile: ICPProfileData;
}

// Función para extraer el rango numérico del texto
const extractAgeRange = (rangeStr: string): [number, number] => {
  const match = rangeStr.match(/(\d+)-(\d+)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2])];
  }
  return [0, 100]; // Valor por defecto
};

// Función para determinar el nivel de educación
const getEducationLevel = (education: string): number => {
  const levels: Record<string, number> = {
    "High School": 1,
    "Associate's Degree": 2,
    "Bachelor's Degree": 3,
    "Master's Degree": 4,
    "Doctorate": 5,
    "Professional Degree": 5
  };
  
  return levels[education] || 0;
};

// Función para determinar el valor en el slider de ingresos
const getIncomeSliderValue = (level: string): number => {
  const levels: Record<string, number> = {
    "Very Low": 10,
    "Low": 25,
    "Medium-Low": 40,
    "Medium": 50,
    "Medium-High": 65,
    "High": 80,
    "Very High": 95
  };
  
  return levels[level] || 50;
};

// Función para obtener coordenadas basadas en la región
const getLocationCoordinates = (locationName: string): [number, number] => {
  // Normalizar el nombre de la ubicación
  const normalizedLocationName = locationName.toLowerCase().trim();
  
  const coordinatesMap: Record<string, [number, number]> = {
    // Regiones principales
    "north america": [-95.7129, 37.0902],
    "south america": [-58.3816, -23.4425],
    "latin america": [-66.1936, 7.1367],
    "europe": [9.1405, 48.6908],
    "asia": [103.8198, 36.5617],
    "oceania": [134.7751, -25.2744],
    "africa": [19.4902, 8.7832],
    "middle east": [53.4949, 24.4667],
    
    // Países de América del Norte
    "united states": [-95.7129, 37.0902],
    "usa": [-95.7129, 37.0902],
    "united states of america": [-95.7129, 37.0902],
    "canada": [-106.3468, 56.1304],
    "mexico": [-102.5528, 23.6345],
    "guatemala": [-90.2308, 15.7835],
    "cuba": [-77.7812, 21.5218],
    "jamaica": [-77.2975, 18.1096],
    
    // Países de América del Sur
    "brazil": [-51.9253, -14.2350],
    "argentina": [-63.6167, -38.4161],
    "colombia": [-74.2973, 4.5709],
    "chile": [-71.5430, -35.6751],
    "peru": [-75.0152, -9.1900],
    "venezuela": [-66.5897, 6.4238],
    "ecuador": [-78.1834, -1.8312],
    "bolivia": [-63.5887, -16.2902],
    
    // Países de Europa
    "united kingdom": [-3.4359, 55.3781],
    "uk": [-3.4359, 55.3781],
    "germany": [10.4515, 51.1657],
    "france": [2.2137, 46.2276],
    "spain": [-3.7492, 40.4637],
    "italy": [12.5674, 41.8719],
    "russia": [105.3188, 61.5240],
    "ukraine": [31.1656, 48.3794],
    "poland": [19.1451, 51.9194],
    
    // Países de Asia
    "china": [104.1954, 35.8617],
    "japan": [138.2529, 36.2048],
    "india": [78.9629, 20.5937],
    "south korea": [127.7669, 35.9078],
    "indonesia": [113.9213, -0.7893],
    "vietnam": [108.2772, 14.0583],
    "thailand": [100.9925, 15.8700],
    
    // Países de Oceanía
    "australia": [133.7751, -25.2744],
    "new zealand": [174.8860, -40.9006],
    
    // Países de África
    "south africa": [22.9375, -30.5595],
    "nigeria": [8.6753, 9.0820],
    "egypt": [30.8025, 26.8206],
    "kenya": [37.9062, -0.0236],
    "morocco": [-7.0926, 31.7917],
    
    // Países de Oriente Medio
    "saudi arabia": [45.0792, 23.8859],
    "uae": [53.8478, 23.4241],
    "united arab emirates": [53.8478, 23.4241],
    "israel": [34.8516, 31.0461],
    "turkey": [35.2433, 38.9637],
    "iran": [53.6880, 32.4279]
  };
  
  // Buscar coincidencias exactas primero
  for (const [region, coords] of Object.entries(coordinatesMap)) {
    if (normalizedLocationName === region) {
      return coords;
    }
  }
  
  // Luego buscar coincidencias parciales
  for (const [region, coords] of Object.entries(coordinatesMap)) {
    if (normalizedLocationName.includes(region) || region.includes(normalizedLocationName)) {
      return coords;
    }
  }
  
  return [0, 0]; // Coordenadas predeterminadas si no se encuentra coincidencia
};

// Función para obtener color basado en la relevancia
const getRelevanceColor = (relevance: string): string => {
  if (relevance.toLowerCase().includes('very high')) {
    return "#4338ca"; // Indigo-700
  } else if (relevance.toLowerCase().includes('high')) {
    return "#6366f1"; // Indigo-500
  } else if (relevance.toLowerCase().includes('medium-high')) {
    return "#8b5cf6"; // Violet-500
  } else if (relevance.toLowerCase().includes('medium')) {
    return "#a78bfa"; // Violet-400
  } else {
    return "#c4b5fd"; // Violet-300
  }
};

// Función para obtener valor numérico basado en la relevancia (para el tamaño del marcador)
const getRelevanceValue = (relevance: string): number => {
  if (relevance.toLowerCase().includes('very high')) {
    return 65;
  } else if (relevance.toLowerCase().includes('high')) {
    return 45;
  } else if (relevance.toLowerCase().includes('medium-high')) {
    return 30;
  } else if (relevance.toLowerCase().includes('medium')) {
    return 20;
  } else {
    return 15;
  }
};

// Función para obtener opacidad basada en la relevancia
const getRelevanceOpacity = (relevance: string): number => {
  if (relevance.toLowerCase().includes('very high')) {
    return 0.8;
  } else if (relevance.toLowerCase().includes('high')) {
    return 0.65;
  } else if (relevance.toLowerCase().includes('medium-high')) {
    return 0.5;
  } else if (relevance.toLowerCase().includes('medium')) {
    return 0.4;
  } else {
    return 0.3;
  }
};

// Función para verificar si un país/región pertenece a una región más grande
const isCountryInRegion = (countryName: string, regionName: string): boolean => {
  // Verificar que ambos parámetros son strings válidos
  if (!countryName || !regionName) return false;
  
  // Normalizar los nombres para comparación
  const normalizedCountryName = countryName.toLowerCase().trim();
  const normalizedRegionName = regionName.toLowerCase().trim();
  
  // Si el país y la región son iguales o similares, devolver true
  if (normalizedCountryName === normalizedRegionName || 
      normalizedCountryName.includes(normalizedRegionName) || 
      normalizedRegionName.includes(normalizedCountryName)) {
    return true;
  }
  
  const regionMapping: Record<string, string[]> = {
    "north america": [
      "united states", "canada", "mexico", "usa", "u.s.a", "us", "north america",
      "united states of america", "greenland", "guatemala", "cuba", "haiti", "dominican rep.", "jamaica", 
      "bahamas", "belize", "costa rica", "panama", "honduras", "el salvador", "nicaragua", "puerto rico"
    ],
    "south america": [
      "brazil", "argentina", "colombia", "chile", "peru", "venezuela", "south america",
      "ecuador", "bolivia", "paraguay", "uruguay", "guyana", "suriname", "french guiana", "falkland is."
    ],
    "latin america": [
      "mexico", "brazil", "argentina", "colombia", "chile", "peru", "venezuela", "latin america",
      "ecuador", "bolivia", "paraguay", "uruguay", "guyana", "suriname", "french guiana",
      "guatemala", "cuba", "haiti", "dominican rep.", "jamaica", "bahamas", "belize", 
      "costa rica", "panama", "honduras", "el salvador", "nicaragua", "puerto rico"
    ],
    "europe": [
      "united kingdom", "germany", "france", "italy", "spain", "uk", "great britain", "europe",
      "portugal", "ireland", "switzerland", "austria", "belgium", "netherlands", "denmark", 
      "norway", "sweden", "finland", "iceland", "poland", "ukraine", "belarus", "czechia", 
      "slovakia", "hungary", "romania", "bulgaria", "serbia", "croatia", "slovenia", 
      "bosnia and herz.", "montenegro", "albania", "greece", "macedonia", "estonia", 
      "latvia", "lithuania", "moldova", "cyprus", "luxembourg", "malta"
    ],
    "asia": [
      "china", "japan", "india", "south korea", "indonesia", "asia",
      "russia", "kazakhstan", "mongolia", "north korea", "vietnam", "laos", "cambodia", 
      "thailand", "myanmar", "malaysia", "philippines", "taiwan", "bangladesh", "bhutan", 
      "nepal", "pakistan", "afghanistan", "tajikistan", "kyrgyzstan", "uzbekistan", 
      "turkmenistan", "sri lanka", "brunei", "timor-leste", "singapore"
    ],
    "oceania": [
      "australia", "new zealand", "oceania", "papua new guinea", "solomon is.", 
      "fiji", "vanuatu", "new caledonia"
    ],
    "africa": [
      "south africa", "nigeria", "egypt", "kenya", "africa", "morocco", "algeria", 
      "tunisia", "libya", "sudan", "south sudan", "ethiopia", "somalia", "djibouti", 
      "eritrea", "uganda", "rwanda", "burundi", "tanzania", "kenya", "mozambique", 
      "zimbabwe", "zambia", "malawi", "botswana", "namibia", "angola", "congo", 
      "dem. rep. congo", "central african rep.", "cameroon", "gabon", "eq. guinea", 
      "ivory coast", "côte d'ivoire", "liberia", "sierra leone", "guinea", "guinea-bissau", 
      "senegal", "gambia", "mali", "burkina faso", "ghana", "togo", "benin", "niger", 
      "chad", "mauritania", "western sahara", "w. sahara", "lesotho", "eswatini"
    ],
    "middle east": [
      "saudi arabia", "uae", "israel", "turkey", "middle east", "iran", "iraq", "syria", 
      "lebanon", "jordan", "kuwait", "bahrain", "qatar", "oman", "yemen", "united arab emirates", 
      "palestine", "azerbaijan", "armenia", "georgia"
    ]
  };

  // Verificar si el país está en la lista de la región
  const countries = regionMapping[normalizedRegionName] || [];
  return countries.some(country => {
    return normalizedCountryName.includes(country) || country.includes(normalizedCountryName);
  });
};

export const DemographicsTab = ({ icpProfile }: DemographicsTabProps) => {
  // Verificar que icpProfile existe
  if (!icpProfile) {
    return <div className="p-4 text-center">No profile data available</div>;
  }

  // Usar valores de la estructura correcta de datos
  const demographics = icpProfile.demographics || {};
  
  // Extraer rango de edad numérico para el slider
  const primaryAgeRange = demographics.ageRange?.primary || "0-100";
  const [minAge, maxAge] = extractAgeRange(primaryAgeRange);
  const ageRangeWidth = maxAge - minAge;
  
  // Educación
  const primaryEducation = demographics.education?.primary || "";
  const educationLevel = getEducationLevel(primaryEducation);
  
  // Ingresos
  const incomeLevel = demographics.income?.level || "Medium";
  const incomeSliderValue = getIncomeSliderValue(incomeLevel);
  
  // Obtener tema actual
  const themeContext = useTheme ? useTheme() : { isDarkMode: false };
  const isDarkMode = themeContext.isDarkMode;
  
  // Convertir los datos de ubicación al formato esperado por el mapa
  const locationMapData = demographics.locations?.map(location => ({
    name: location.name,
    coordinates: getLocationCoordinates(location.name),
    value: getRelevanceValue(location.relevance),
    color: getRelevanceColor(location.relevance),
    opacity: getRelevanceOpacity(location.relevance),
    relevance: location.relevance
  })) || [];
  
  // Procesar datos de distribución de género
  const genderDistribution = demographics.gender?.distribution || "";
  const genderData = [
    { gender: "Male", percentage: 0, color: "#3b82f6" },  // Blue
    { gender: "Female", percentage: 0, color: "#ec4899" }, // Pink
    { gender: "Other", percentage: 0, color: "#10b981" }   // Green
  ];
  
  // Extraer porcentajes de la cadena de distribución de género
  if (genderDistribution) {
    // Mejorar la extracción de porcentajes con expresiones regulares más robustas
    const maleMatch = genderDistribution.match(/(?:male|men|man)[:\s]*(\d+)%/i);
    const femaleMatch = genderDistribution.match(/(?:female|women|woman)[:\s]*(\d+)%/i);
    const otherMatch = genderDistribution.match(/(?:other|non-binary|diverse)[:\s]*(\d+)%/i);
    
    if (maleMatch && maleMatch[1]) {
      genderData[0].percentage = parseInt(maleMatch[1]);
    }
    if (femaleMatch && femaleMatch[1]) {
      genderData[1].percentage = parseInt(femaleMatch[1]);
    }
    if (otherMatch && otherMatch[1]) {
      genderData[2].percentage = parseInt(otherMatch[1]);
    }
    
    // Si no se encontraron porcentajes específicos pero hay texto, intentar extraer números
    if (genderData.every(item => item.percentage === 0)) {
      const numbers = genderDistribution.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        // Asignar los primeros dos números encontrados a hombre y mujer
        genderData[0].percentage = parseInt(numbers[0]);
        genderData[1].percentage = parseInt(numbers[1]);
        
        // Si hay un tercer número, asignarlo a otros
        if (numbers.length >= 3) {
          genderData[2].percentage = parseInt(numbers[2]);
        } else {
          // Si solo hay dos números, calcular el resto para "otros"
          const remaining = 100 - (genderData[0].percentage + genderData[1].percentage);
          if (remaining > 0) {
            genderData[2].percentage = remaining;
          }
        }
      }
    }
    
    // Verificar que los porcentajes sumen 100
    const total = genderData.reduce((sum, item) => sum + item.percentage, 0);
    if (total !== 100 && total > 0) {
      // Ajustar proporcionalmente
      genderData.forEach(item => {
        item.percentage = Math.round((item.percentage / total) * 100);
      });
    }
    
    // Asegurarse de que al menos hay datos para mostrar
    if (genderData.every(item => item.percentage === 0)) {
      // Si no se pudieron extraer datos, establecer valores predeterminados
      genderData[0].percentage = 50; // Male
      genderData[1].percentage = 50; // Female
    }
  }
  
  // Registrar en consola para depuración
  console.log("Gender Distribution:", genderDistribution);
  console.log("Processed Gender Data:", genderData);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Age Range Section - IMPROVED */}
      <SectionCard title="Age Range" icon={<CalendarIcon className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <h4 className="text-sm font-medium mb-3">Age Distribution</h4>
            
            {/* Age Slider Visualization - Improved */}
            <div className="relative pt-5 pb-6">
              {/* Age Scale */}
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>0</span>
                <span>25</span>
                <span>50</span>
                <span>75</span>
                <span>100</span>
              </div>
              
              {/* Base Slider Track */}
              <div className="h-2 bg-gradient-to-r from-blue-100 via-blue-300 to-blue-500 dark:from-blue-900 dark:via-blue-700 dark:to-blue-500 rounded-full w-full">
                {/* Active Range Indicator */}
                <div 
                  className="absolute w-full flex justify-between"
                  style={{ top: '-4px' }}
                >
                  <div 
                    className="w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md flex items-center justify-center"
                    style={{ 
                      transform: 'translateX(-50%)',
                      marginLeft: `${minAge}%`
                    }}
                  >
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  </div>
                  <div 
                    className="w-4 h-4 bg-white border-2 border-primary rounded-full shadow-md flex items-center justify-center"
                    style={{ 
                      transform: 'translateX(50%)',
                      marginRight: `${100 - maxAge}%`
                    }}
                  >
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                  </div>
                </div>
                
                {/* Active Range Highlight */}
                <div 
                  className="h-full bg-primary/40 rounded-full relative" 
                  style={{ 
                    width: `${maxAge - minAge}%`, 
                    marginLeft: `${minAge}%`
                  }}
                ></div>
              </div>
              
              {/* Age Range Labels */}
              <div className="flex justify-between mt-6 text-center">
                <div className="text-center" style={{ width: '25%', marginLeft: `${minAge - 12.5}%` }}>
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    Min: {minAge}
                  </span>
                </div>
                <div className="text-center" style={{ width: '25%', marginRight: `${100 - maxAge - 12.5}%` }}>
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                    Max: {maxAge}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 bg-muted/30 p-3 rounded-md">
              <div>
                <h4 className="text-sm font-medium mb-1">Primary Age Range</h4>
                <p className="text-md font-semibold mb-3">{demographics.ageRange?.primary || 'N/A'}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="indigo">
                    {maxAge - minAge} years span
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          {demographics.ageRange?.secondary && (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-2">Secondary Age Range</h4>
              <p className="text-md font-medium">{demographics.ageRange.secondary}</p>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Gender Distribution - IMPROVED WITH CHART */}
      <SectionCard title="Gender Distribution" icon={<User className="h-5 w-5" />} className="md:col-span-2 xl:col-span-1">
        <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
          <h4 className="text-sm font-medium mb-3">Distribution</h4>
          
          {/* Gender Distribution Visualization - Improved with Pie Chart */}
          <div className="space-y-4">
            {/* Pie Chart Visualization - Fixed */}
            <div className="flex justify-center items-center">
              <div className="relative w-64 h-64">
                {/* Background circle */}
                <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 100 100">
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="none" 
                    stroke={isDarkMode ? "#334155" : "#f1f5f9"}
                    strokeWidth="12" 
                  />
                </svg>
                
                {/* Pie chart segments */}
                {genderData.filter(item => item.percentage > 0).length > 0 ? (
                  <>
                    {/* Male segment */}
                    {genderData[0].percentage > 0 && (
                      <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="40" 
                          fill="none" 
                          stroke={genderData[0].color} 
                          strokeWidth="12" 
                          strokeDasharray={`${genderData[0].percentage * 2.51} 251`}
                          strokeDashoffset="0"
                        />
                      </svg>
                    )}
                    
                    {/* Female segment */}
                    {genderData[1].percentage > 0 && (
                      <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="40" 
                          fill="none" 
                          stroke={genderData[1].color} 
                          strokeWidth="12" 
                          strokeDasharray={`${genderData[1].percentage * 2.51} 251`}
                          strokeDashoffset={`-${genderData[0].percentage * 2.51}`}
                        />
                      </svg>
                    )}
                    
                    {/* Other segment */}
                    {genderData[2].percentage > 0 && (
                      <svg className="absolute inset-0 -rotate-90" width="100%" height="100%" viewBox="0 0 100 100">
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="40" 
                          fill="none" 
                          stroke={genderData[2].color} 
                          strokeWidth="12" 
                          strokeDasharray={`${genderData[2].percentage * 2.51} 251`}
                          strokeDashoffset={`-${(genderData[0].percentage + genderData[1].percentage) * 2.51}`}
                        />
                      </svg>
                    )}
                  </>
                ) : (
                  <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 100 100">
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="none" 
                      stroke="#d1d5db" 
                      strokeWidth="12" 
                    />
                  </svg>
                )}
                
                {/* Center text with percentage */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center bg-background/80 rounded-full w-32 h-32 flex flex-col items-center justify-center">
                    <span className="text-sm text-muted-foreground">Gender</span>
                    {genderData[0].percentage > genderData[1].percentage ? (
                      <span className="text-base font-medium text-blue-500">{genderData[0].percentage}% Male</span>
                    ) : (
                      <span className="text-base font-medium text-pink-500">{genderData[1].percentage}% Female</span>
                    )}
                    {genderData[2].percentage > 0 && (
                      <span className="text-sm font-medium text-green-500 mt-1">{genderData[2].percentage}% Other</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Legend - Improved */}
            <div className="flex flex-wrap gap-6 justify-center mt-6">
              {genderData.map((item, index) => (
                item.percentage > 0 && (
                  <div key={index} className="flex items-center gap-3">
                    <div 
                      className="w-5 h-5 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-base">{item.gender}: <span className="font-medium">{item.percentage}%</span></span>
                  </div>
                )
              ))}
            </div>
            
            {/* Original Text */}
            <div className="mt-4 pt-3 border-t border-muted">
              <p className="text-sm text-center text-muted-foreground">{demographics.gender?.distribution || 'N/A'}</p>
            </div>
          </div>
        </div>
      </SectionCard>
      
      {/* Locations */}
      <SectionCard title="Locations" icon={<Globe className="h-5 w-5" />}>
        <div className="space-y-4">
          {demographics.locations && demographics.locations.length > 0 ? (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-3">Geographic Distribution</h4>
              
              {/* Reemplazar el mapa de react-simple-maps con nuestro nuevo componente */}
              <WorldMapComponent 
                locations={locationMapData}
                height="300px"
                onSelectLocation={(location) => {
                  console.log("Selected location:", location);
                }}
              />
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p>No location data available</p>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Education Level - IMPROVED */}
      <SectionCard title="Education Level" icon={<GraduationCap className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <h4 className="text-sm font-medium mb-3">Education Progression</h4>
            
            {/* Education Level Visualization - Improved */}
            <div className="relative pt-2 pb-6">
              {/* Education Track */}
              <div className="h-2 bg-gradient-to-r from-blue-200 via-indigo-400 to-violet-600 dark:from-blue-900 dark:via-indigo-600 dark:to-violet-800 rounded-full w-full"></div>
              
              {/* Education Level Indicator */}
              <div 
                className="absolute w-5 h-5 bg-white border-2 border-primary rounded-full -mt-3.5 shadow-md flex items-center justify-center"
                style={{ 
                  left: `${(educationLevel - 1) * 25}%`, 
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="w-2 h-2 bg-primary rounded-full"></div>
              </div>
              
              {/* Education Level Labels */}
              <div className="flex justify-between mt-4">
                {[
                  { level: 1, label: "High School" },
                  { level: 2, label: "Associate's" },
                  { level: 3, label: "Bachelor's" },
                  { level: 4, label: "Master's" },
                  { level: 5, label: "Doctorate" }
                ].map((item, index) => (
                  <div 
                    key={index} 
                    className={`text-xs text-center ${educationLevel >= item.level ? 'font-semibold text-primary' : 'text-muted-foreground'}`}
                    style={{ width: '20%' }}
                  >
                    <div 
                      className={`h-3 w-px mx-auto mb-1 ${educationLevel >= item.level ? 'bg-primary' : 'bg-muted-foreground'}`}
                    ></div>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Current Education Level */}
            <div className="mt-6 bg-muted/30 p-3 rounded-md">
              <div>
                <h4 className="text-sm font-medium mb-1">Current Level</h4>
                <p className="text-md font-semibold mb-3">{demographics.education?.primary || 'N/A'}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="indigo">Level {educationLevel}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {educationLevel === 1 ? 'Basic' : 
                     educationLevel === 2 ? 'Intermediate' : 
                     educationLevel === 3 ? 'Advanced' : 
                     educationLevel === 4 ? 'Expert' : 
                     educationLevel === 5 ? 'Specialized' : 'Unknown'}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          {demographics.education?.secondary && (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-3">Secondary Education</h4>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const secondary = demographics.education.secondary;
                  
                  // Si es un array
                  if (Array.isArray(secondary)) {
                    return secondary.map((edu: string, index: number) => (
                      <Badge key={index} variant="outline" className="py-1.5 px-3 text-sm bg-muted/30">
                        {edu}
                      </Badge>
                    ));
                  }
                  
                  // Si es un string
                  if (typeof secondary === 'string') {
                    return (
                      <Badge variant="outline" className="py-1.5 px-3 text-sm bg-muted/30">
                        {secondary}
                      </Badge>
                    );
                  }
                  
                  // Si es un objeto
                  if (typeof secondary === 'object' && secondary !== null) {
                    const entries = Object.entries(secondary);
                    if (entries.length > 0) {
                      return entries.map(([key, value], index) => {
                        // Asegurarnos de que el valor sea una cadena
                        const displayValue = typeof value === 'string' ? value : 
                                           typeof value === 'number' ? value.toString() :
                                           typeof value === 'object' ? JSON.stringify(value) : 
                                           String(value);
                        return (
                          <Badge key={index} variant="outline" className="py-1.5 px-3 text-sm bg-muted/30">
                            {displayValue}
                          </Badge>
                        );
                      });
                    }
                  }
                  
                  // Si no es ninguno de los anteriores o es un objeto vacío
                  return (
                    <Badge variant="outline" className="py-1.5 px-3 text-sm bg-muted/30">
                      No secondary education data
                    </Badge>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Income Level */}
      <SectionCard title="Income Level" icon={<DollarSign className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <h4 className="text-sm font-medium mb-3">Income Range</h4>
            
            {/* Income Slider Visualization */}
            <div className="relative pt-5 pb-2 mb-4">
              {/* Income Scale */}
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
              
              {/* Income Slider Track */}
              <div className="h-3 bg-gradient-to-r from-blue-100 via-blue-400 to-blue-600 dark:from-blue-900 dark:via-blue-600 dark:to-blue-300 rounded-full w-full relative">
                {/* Income Indicator */}
                <div 
                  className="absolute w-4 h-4 bg-white border-2 border-primary rounded-full -mt-0.5 shadow" 
                  style={{ left: `${incomeSliderValue}%`, transform: 'translateX(-50%)' }}
                ></div>
              </div>
              
              {/* Value Labels */}
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">$0</span>
                <span className="text-primary font-medium">
                  {demographics.income?.range || incomeLevel}
                </span>
                <span className="text-muted-foreground">$1M+</span>
              </div>
            </div>
            
            <h4 className="text-sm font-medium mb-2">Level</h4>
            <p className="text-md font-medium">{demographics.income?.level || 'N/A'}</p>
          </div>
          
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <h4 className="text-sm font-medium mb-2">Range</h4>
            <p className="text-md font-medium">
              {demographics.income?.range || 'N/A'}
              {demographics.income?.currency ? ` (${demographics.income.currency})` : ''}
            </p>
          </div>
        </div>
      </SectionCard>
      
      {/* Languages - IMPROVED */}
      <SectionCard title="Languages" icon={<Languages className="h-5 w-5" />}>
        <div className="space-y-4">
          {demographics.languages && demographics.languages.length > 0 ? (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-3">Language Proficiency</h4>
              <div className="space-y-6">
                {demographics.languages.map((language, index) => {
                  // Determinar el valor de la barra de progreso basado en la competencia
                  let progressValue = 50; // Valor predeterminado
                  if (language.proficiency.toLowerCase().includes('native')) {
                    progressValue = 100;
                  } else if (language.proficiency.toLowerCase().includes('fluent')) {
                    progressValue = 85;
                  } else if (language.proficiency.toLowerCase().includes('advanced')) {
                    progressValue = 70;
                  } else if (language.proficiency.toLowerCase().includes('intermediate')) {
                    progressValue = 50;
                  } else if (language.proficiency.toLowerCase().includes('basic')) {
                    progressValue = 30;
                  }
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{language.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {language.proficiency}
                          </Badge>
                        </div>
                        <ImportanceIndicator level={language.relevance} />
                      </div>
                      <Progress 
                        value={progressValue} 
                        className="h-2" 
                        indicatorClassName={
                          language.proficiency.toLowerCase().includes('native') ? "bg-[rgb(99,102,241)]" :
                          language.proficiency.toLowerCase().includes('fluent') ? "bg-blue-500" :
                          language.proficiency.toLowerCase().includes('advanced') ? "bg-sky-500" :
                          language.proficiency.toLowerCase().includes('intermediate') ? "bg-sky-400" :
                          "bg-sky-300"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <p className="text-muted-foreground">No language data available</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}; 