import {
User
} from "@/app/components/ui/icons";
import { SectionCard } from "../common/Cards";

import type { ICPProfileData } from "./demographics-data";
export function DemographicGender({ demographics, isDarkMode }: { demographics: ICPProfileData["demographics"]; isDarkMode: boolean }) {
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
  );
}
