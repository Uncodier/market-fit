import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { 
  User, BarChart, Globe, CheckCircle2, HelpCircle, User as Briefcase, BarChart as Building, Settings as Tool
} from "@/app/components/ui/icons";
import { SectionCard, AttributeCard } from "../common/Cards";
import { ImportanceIndicator } from "../common/Indicators";
import { ICPProfileData } from "../types";
import { SpiderChart } from "../common/SpiderChart";
import { PieChart } from "../common/PieChart";

interface ProfessionalContextTabProps {
  icpProfile: ICPProfileData;
}

export const ProfessionalContextTab = ({ icpProfile }: ProfessionalContextTabProps) => {
  // Verificar que icpProfile existe
  if (!icpProfile) {
    return <div className="p-4 text-center">No profile data available</div>;
  }

  // Obtener datos de professionalContext
  const professionalContext = icpProfile.professionalContext || {};

  // Función para extraer el tamaño de la empresa sin el rango de empleados
  const extractCompanySize = (sizeWithRange: string | undefined): string => {
    if (!sizeWithRange) return "";
    // Extraer solo la parte del nombre (antes del paréntesis)
    const match = sizeWithRange.match(/^(\w+)/);
    return match ? match[1] : "";
  };

  // Obtener el tamaño de la empresa limpio (sin el rango de empleados)
  const companySize = extractCompanySize(professionalContext.companySize?.primary);

  // Transform pain points for spider chart
  const painPointItems = professionalContext.painPoints?.map((point: {name: string; severity: string; description: string}) => ({
    name: point?.name || '',
    value: (point?.severity === "Very high" ? 1 : 
           point?.severity === "High" ? 0.8 : 
           point?.severity === "Medium" ? 0.6 : 
           point?.severity === "Low" ? 0.4 : 0.2),
    color: "rgba(239, 68, 68, 0.8)" // Red color for pain points
  })) || [];

  // Transform industries for pie chart - asignar valores más realistas basados en relevancia
  const industriesData = professionalContext.industries?.map((industry: string, index: number) => {
    // Asignar valores decrecientes pero más realistas para el gráfico
    const values = [40, 30, 20, 10]; // Porcentajes aproximados para cada industria
    return {
      name: industry,
      value: values[index] || 5, // Valor por defecto para industrias adicionales
    };
  }) || [];

  // Transform tools for pie chart - asignar valores más realistas
  const toolsData = professionalContext.tools?.current?.map((tool: string, index: number) => {
    // Asignar valores decrecientes pero más realistas para el gráfico
    const values = [30, 25, 20, 15, 10]; // Porcentajes aproximados para cada herramienta
    return {
      name: tool,
      value: values[index] || 5, // Valor por defecto para herramientas adicionales
    };
  }) || [];

  // Función para convertir relevancia a badge variant
  const getBadgeVariant = (relevance: string) => {
    if (relevance === "Very high" || relevance === "High") return "indigo";
    if (relevance === "Medium" || relevance === "Medium-high") return "secondary";
    return "outline";
  };

  // Determinar si un rol tiene poder de decisión basado en su relevancia
  const hasDecisionMakingPower = (relevance: string) => {
    return relevance === "Very high" || relevance === "High";
  };

  // Función para obtener la categoría del tamaño de la empresa
  const getCompanySizeCategory = (size: string) => {
    const categories = ["Startup", "Small", "Medium", "Large", "Enterprise"];
    return categories.find(category => isCompanySizeActive(size, category)) || "N/A";
  };

  // Función para determinar si el tamaño de la empresa es activo
  const isCompanySizeActive = (size: string, target: string) => {
    const sizes = ["Startup", "Small", "Medium", "Large", "Enterprise"];
    const targetIndex = sizes.indexOf(target);
    const sizeIndex = sizes.indexOf(size);
    return sizeIndex <= targetIndex;
  };

  // Función para obtener la cantidad de empleados
  const getCompanySizeEmployeeCount = (size: string) => {
    const counts = ["1-10", "11-50", "51-200", "201-500", "501+"];
    const index = ["Startup", "Small", "Medium", "Large", "Enterprise"].indexOf(size);
    return counts[index] || "N/A";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Industries Section with Donut Chart */}
      <SectionCard variant="plain" title="Industries" icon={<Globe className="h-5 w-5" />}>
        {industriesData.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-3 text-center">Industry Distribution</h4>
              <div className="flex justify-center">
                <PieChart 
                  data={industriesData.slice(0, 6)} 
                  size={220} 
                  showLabels={true}
                  isDonut={true}
                  donutThickness={50}
                  className="mx-auto"
                />
              </div>
            </div>
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-3">Target Industries</h4>
              <div className="flex flex-wrap gap-2">
                {professionalContext.industries.map((industry: string, index: number) => (
                  <Badge key={index} variant={index < 2 ? "indigo" : "outline"}>
                    {industry}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <p className="text-sm text-muted-foreground">No industry data available</p>
          </div>
        )}
      </SectionCard>
      
      {/* Roles Section with Decision Maker subsection for each role */}
      <SectionCard variant="plain" title="Professional Roles" icon={<Briefcase className="h-5 w-5" />}>
        <div className="space-y-3">
          {professionalContext.roles && professionalContext.roles.length > 0 ? (
            <>
              {professionalContext.roles.map((role: {title: string; relevance: string}, index: number) => (
                <div key={index} className="bg-muted/20 p-4 rounded-md overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{role.title}</h4>
                    <Badge variant={getBadgeVariant(role.relevance)}>
                      {role.relevance}
                    </Badge>
                  </div>
                  
                  {/* Decision Maker subsection - para todos los roles */}
                  <div className="mt-3 pt-3 border-t border-muted">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-medium text-muted-foreground">Decision Maker</h5>
                      <Badge variant={hasDecisionMakingPower(role.relevance) ? "indigo" : "outline"}>
                        {hasDecisionMakingPower(role.relevance) ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {index === 0 && professionalContext.decisionMakingPower && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {professionalContext.decisionMakingPower.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <p className="text-sm text-muted-foreground">No role data available</p>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Company Size Section */}
      <SectionCard variant="plain" title="Company Size" icon={<Building className="h-5 w-5" />}>
        <div className="space-y-4">
          {/* Company Size Distribution - Visualización principal */}
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Company Size</h4>
              <Badge variant="indigo" className="hover:bg-[rgb(99,102,241)]/80">
                {companySize} ({getCompanySizeEmployeeCount(companySize)})
              </Badge>
            </div>
            
            {/* Company Size Distribution - Visualización mejorada */}
            <div className="grid grid-cols-5 gap-1 mt-4">
              {[
                { size: "Startup", employees: "1-10" },
                { size: "Small", employees: "11-50" },
                { size: "Medium", employees: "51-200" },
                { size: "Large", employees: "201-500" },
                { size: "Enterprise", employees: "501+" }
              ].map((item, index) => {
                const isActive = companySize === item.size;
                return (
                  <div 
                    key={index} 
                    className={`p-3 rounded-md text-center transition-all ${isActive ? 'bg-emerald-600 text-white shadow-md' : 'bg-muted/30 hover:bg-muted/40'}`}
                  >
                    <div className={`text-xs font-medium ${isActive ? '' : 'text-foreground'}`}>
                      {item.size}
                    </div>
                    <div className={`text-[10px] mt-1 ${isActive ? 'text-white/90' : 'text-muted-foreground'}`}>
                      {item.employees}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Progress Bar - Simplificado y más sutil */}
            <div className="relative mt-6 mb-2">
              {/* Base track */}
              <div className="h-1 bg-muted/30 rounded-full w-full"></div>
              
              {/* Progress fill */}
              <div 
                className="absolute top-0 left-0 h-1 bg-emerald-600 rounded-full"
                style={{ 
                  width: companySize === "Startup" ? "0%" :
                         companySize === "Small" ? "25%" :
                         companySize === "Medium" ? "50%" :
                         companySize === "Large" ? "75%" :
                         companySize === "Enterprise" ? "100%" : "0%"
                }}
              ></div>
              
              {/* Single indicator dot that moves based on selected value */}
              <div 
                className="absolute top-0 -ml-1"
                style={{ 
                  left: companySize === "Startup" ? "0%" :
                        companySize === "Small" ? "25%" :
                        companySize === "Medium" ? "50%" :
                        companySize === "Large" ? "75%" :
                        companySize === "Enterprise" ? "100%" : "0%"
                }}
              >
                <div className="w-3 h-3 bg-white border-2 border-emerald-600 rounded-full -mt-1 shadow-md"></div>
              </div>
            </div>
          </div>
          
          {/* Secondary Targets */}
          {professionalContext.companySize?.secondary && professionalContext.companySize.secondary.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-medium text-muted-foreground">Secondary Targets</h5>
              </div>
              <div className="flex flex-wrap gap-2">
                {professionalContext.companySize.secondary.map((size: string, index: number) => {
                  // Extraer el tamaño de empresa sin el rango de empleados
                  const secondarySize = extractCompanySize(size);
                  return (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="py-1 px-2 text-xs"
                    >
                      {secondarySize} ({getCompanySizeEmployeeCount(secondarySize)})
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SectionCard>
      
      {/* Pain Points */}
      <SectionCard variant="plain" title="Pain Points" icon={<HelpCircle className="h-5 w-5" />}>
        <div className="space-y-4">
          {painPointItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={painPointItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {professionalContext.painPoints && professionalContext.painPoints.length > 0 ? (
              professionalContext.painPoints.map((point: {name: string; severity: string; description: string}, index: number) => (
                <div key={index} className="bg-muted/20 p-4 rounded-md overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium">{point.name}</h4>
                    <Badge variant={getBadgeVariant(point.severity)}>
                      {point.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{point.description}</p>
                </div>
              ))
            ) : (
              <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
                <p className="text-sm text-muted-foreground">No pain points data available</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
      
      {/* Tools with Donut Chart */}
      <SectionCard variant="plain" title="Tools & Software" icon={<Tool className="h-5 w-5" />}>
        {toolsData.length > 0 ? (
          <div className="space-y-4">
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <h4 className="text-sm font-medium mb-3 text-center">Tools Usage Distribution</h4>
              <div className="flex justify-center">
                <PieChart 
                  data={toolsData.slice(0, 6)} 
                  size={220} 
                  showLabels={true}
                  isDonut={true}
                  donutThickness={50}
                  className="mx-auto"
                />
              </div>
            </div>
            
            {/* Current Tools */}
            {professionalContext.tools?.current && professionalContext.tools.current.length > 0 && (
              <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
                <h4 className="text-sm font-medium mb-3">Currently Using</h4>
                <div className="flex flex-wrap gap-2">
                  {professionalContext.tools.current.map((tool: string, index: number) => (
                    <Badge key={index} variant="outline">{tool}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Desired Tools */}
            {professionalContext.tools?.desired && professionalContext.tools.desired.length > 0 && (
              <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
                <h4 className="text-sm font-medium mb-3">Looking For</h4>
                <div className="flex flex-wrap gap-2">
                  {professionalContext.tools.desired.map((tool: string, index: number) => (
                    <Badge key={index} variant="indigo">{tool}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
            <p className="text-sm text-muted-foreground">No tools data available</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}; 