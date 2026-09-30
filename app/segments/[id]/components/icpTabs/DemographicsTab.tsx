import { Badge } from "@/app/components/ui/badge";
import {
CalendarIcon,
Circle as DollarSign,Globe,
User as GraduationCap,
MessageSquare as Languages
} from "@/app/components/ui/icons";
import { Progress } from "@/app/components/ui/progress";
import WorldMapComponent from "@/app/components/WorldMapLazy";
import { useTheme } from "@/app/context/ThemeContext";
import { SectionCard } from "../common/Cards";
import { ImportanceIndicator } from "../common/Indicators";

import { DemographicGender } from "./DemographicGender";
import { extractAgeRange,getEducationLevel,getIncomeSliderValue,getLocationCoordinates,getRelevanceColor,getRelevanceOpacity,getRelevanceValue,type DemographicsTabProps } from "./demographics-data";
export const DemographicsTab = ({ icpProfile }: DemographicsTabProps) => {
  const { isDarkMode } = useTheme();
  // Verify the profile is available
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
  
  // Convertir los datos de ubicación al formato esperado por el mapa
  const locationMapData = demographics.locations?.map(location => ({
    name: location.name,
    coordinates: getLocationCoordinates(location.name),
    value: getRelevanceValue(location.relevance),
    color: getRelevanceColor(location.relevance),
    opacity: getRelevanceOpacity(location.relevance),
    relevance: location.relevance
  })) || [];
  
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
      <DemographicGender demographics={demographics} isDarkMode={isDarkMode} />
      
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