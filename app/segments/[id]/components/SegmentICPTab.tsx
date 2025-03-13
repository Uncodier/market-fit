import React, { useState } from "react";
import { 
  Users, PieChart, BarChart, Globe, Settings, User, 
  CalendarIcon, User as GraduationCap, Circle as DollarSign, MessageSquare,
  TrendingUp as Target, HelpCircle, CheckCircle2, Tag
} from "@/app/components/ui/icons";
import { Segment } from "../page";
import { DemographicsTab } from "./icpTabs/DemographicsTab";
import { PsychographicsTab } from "./icpTabs/PsychographicsTab";
import { CustomAttributesTab } from "./icpTabs/CustomAttributesTab";
import { BehavioralTraitsTab } from "./icpTabs/BehavioralTraitsTab";
import { ProfessionalContextTab } from "./icpTabs/ProfessionalContextTab";
import { ICPProfileData } from "./types";
import { SectionCard, AttributeCard, SectionTitle } from "./common/Cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
// Importar desde dummyData.ts que sabemos que existe
import { sampleICPProfile } from "./dummyData";
import { cn } from "@/app/lib/utils";

interface SegmentICPTabProps {
  segment: Segment;
}

// Un perfil ICP predeterminado en caso de que no exista data
const fallbackICPProfile = sampleICPProfile as any as ICPProfileData;

// Componente para mostrar el resumen del ICP
const ICPSummaryCard = ({ 
  icpProfile, 
  activeTab, 
  onTabChange 
}: { 
  icpProfile: ICPProfileData; 
  activeTab: string;
  onTabChange: (tab: string) => void;
}) => {
  // Define tab options
  const tabs = [
    { id: "demographics", label: "Demographics", icon: Users },
    { id: "psychographics", label: "Psychographics", icon: PieChart },
    { id: "behavioral", label: "Behavioral", icon: BarChart },
    { id: "professional", label: "Professional", icon: User },
    { id: "custom", label: "Custom", icon: Settings },
  ];

  return (
    <div>
      {/* Encabezado principal - estructura igual a SegmentAnalysisTab */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-semibold">
          Ideal Customer Profile: <span className="text-primary">{icpProfile.name}</span>
        </h2>
      </div>
      
      {/* Descripción del ICP */}
      <p className="text-muted-foreground mt-1 mb-6">{icpProfile.description}</p>
      
      {/* 5 tarjetas en una sola fila que ahora funcionan como tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {/* Demographics Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "demographics" ? "bg-primary" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("demographics")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "demographics" ? "" : ""
          )}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Users className={cn(
                "h-5 w-5", 
                activeTab === "demographics" ? "text-primary-foreground" : "text-muted-foreground"
              )} />
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "demographics" ? "text-primary-foreground" : "text-muted-foreground"
              )}>Demographics</h3>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "demographics" ? "text-primary-foreground" : "text-muted-foreground"
            )}>
              {icpProfile.demographics.ageRange?.primary && (
                <li className="flex items-center gap-2">
                  <CalendarIcon className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "demographics" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Age: {icpProfile.demographics.ageRange.primary}</span>
                </li>
              )}
              {icpProfile.demographics.education?.primary && (
                <li className="flex items-center gap-2">
                  <GraduationCap className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "demographics" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Education: {icpProfile.demographics.education.primary}</span>
                </li>
              )}
              {icpProfile.demographics.locations && icpProfile.demographics.locations.length > 0 && (
                <li className="flex items-center gap-2">
                  <Globe className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "demographics" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Location: {icpProfile.demographics.locations[0].name}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Psychographics Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "psychographics" ? "bg-primary" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("psychographics")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "psychographics" ? "" : ""
          )}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <PieChart className={cn(
                "h-5 w-5", 
                activeTab === "psychographics" ? "text-primary-foreground" : "text-muted-foreground"
              )} />
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "psychographics" ? "text-primary-foreground" : "text-muted-foreground"
              )}>Psychographics</h3>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "psychographics" ? "text-primary-foreground" : "text-muted-foreground"
            )}>
              {icpProfile.psychographics?.values && icpProfile.psychographics.values.length > 0 && (
                <li className="flex items-center gap-2">
                  <DollarSign className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "psychographics" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Value: {icpProfile.psychographics.values[0].name}</span>
                </li>
              )}
              {icpProfile.psychographics?.goals && icpProfile.psychographics.goals.length > 0 && (
                <li className="flex items-center gap-2">
                  <Target className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "psychographics" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Goal: {icpProfile.psychographics.goals[0].name}</span>
                </li>
              )}
              {icpProfile.psychographics?.challenges && icpProfile.psychographics.challenges.length > 0 && (
                <li className="flex items-center gap-2">
                  <HelpCircle className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "psychographics" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Challenge: {icpProfile.psychographics.challenges[0].name}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Behavioral Traits Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "behavioral" ? "bg-primary" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("behavioral")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "behavioral" ? "" : ""
          )}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <BarChart className={cn(
                "h-5 w-5", 
                activeTab === "behavioral" ? "text-primary-foreground" : "text-muted-foreground"
              )} />
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "behavioral" ? "text-primary-foreground" : "text-muted-foreground"
              )}>Behavioral</h3>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "behavioral" ? "text-primary-foreground" : "text-muted-foreground"
            )}>
              {icpProfile.behavioralTraits?.onlineBehavior?.deviceUsage?.primary && (
                <li className="flex items-center gap-2">
                  <Settings className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "behavioral" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Device: {icpProfile.behavioralTraits.onlineBehavior.deviceUsage.primary}</span>
                </li>
              )}
              {icpProfile.behavioralTraits?.purchasingBehavior?.decisionFactors && 
               icpProfile.behavioralTraits.purchasingBehavior.decisionFactors.length > 0 && (
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "behavioral" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Factor: {icpProfile.behavioralTraits.purchasingBehavior.decisionFactors[0].name}</span>
                </li>
              )}
              {icpProfile.behavioralTraits?.contentConsumption?.preferredFormats && 
               icpProfile.behavioralTraits.contentConsumption.preferredFormats.length > 0 && (
                <li className="flex items-center gap-2">
                  <MessageSquare className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "behavioral" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Format: {icpProfile.behavioralTraits.contentConsumption.preferredFormats[0].type}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Professional Context Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "professional" ? "bg-primary" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("professional")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "professional" ? "" : ""
          )}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <User className={cn(
                "h-5 w-5", 
                activeTab === "professional" ? "text-primary-foreground" : "text-muted-foreground"
              )} />
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "professional" ? "text-primary-foreground" : "text-muted-foreground"
              )}>Professional</h3>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "professional" ? "text-primary-foreground" : "text-muted-foreground"
            )}>
              {icpProfile.professionalContext?.industries && icpProfile.professionalContext.industries.length > 0 && (
                <li className="flex items-center gap-2">
                  <Globe className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "professional" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Industry: {icpProfile.professionalContext.industries[0]}</span>
                </li>
              )}
              {icpProfile.professionalContext?.roles && icpProfile.professionalContext.roles.length > 0 && (
                <li className="flex items-center gap-2">
                  <User className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "professional" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Role: {icpProfile.professionalContext.roles[0].title}</span>
                </li>
              )}
              {icpProfile.professionalContext?.companySize?.primary && (
                <li className="flex items-center gap-2">
                  <BarChart className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "professional" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>Company: {icpProfile.professionalContext.companySize.primary}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Custom Attributes Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "custom" ? "bg-primary" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("custom")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "custom" ? "" : ""
          )}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Settings className={cn(
                "h-5 w-5", 
                activeTab === "custom" ? "text-primary-foreground" : "text-muted-foreground"
              )} />
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "custom" ? "text-primary-foreground" : "text-muted-foreground"
              )}>Custom</h3>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "custom" ? "text-primary-foreground" : "text-muted-foreground"
            )}>
              {icpProfile.customAttributes && icpProfile.customAttributes.length > 0 && (
                <li className="flex items-center gap-2">
                  <Tag className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "custom" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>{icpProfile.customAttributes[0].name}: {icpProfile.customAttributes[0].value}</span>
                </li>
              )}
              {icpProfile.customAttributes && icpProfile.customAttributes.length > 1 && (
                <li className="flex items-center gap-2">
                  <Tag className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "custom" ? "text-primary-foreground/90" : "text-primary"
                  )} />
                  <span>{icpProfile.customAttributes[1].name}: {icpProfile.customAttributes[1].value}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export function SegmentICPTab({ segment }: SegmentICPTabProps) {
  const [activeTab, setActiveTab] = useState("demographics");

  // Extract the ICP profile data from the segment, or use sample data if none exists
  // Usamos any como intermediario para evitar errores de tipo
  const profileData = segment?.icp?.profile || fallbackICPProfile;
  const icpProfile = profileData as ICPProfileData;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Render the appropriate tab content based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case "demographics":
        return <DemographicsTab icpProfile={icpProfile} />;
      case "psychographics":
        return <PsychographicsTab icpProfile={icpProfile} />;
      case "behavioral":
        return <BehavioralTraitsTab icpProfile={icpProfile} />;
      case "professional":
        return <ProfessionalContextTab icpProfile={icpProfile} />;
      case "custom":
        return <CustomAttributesTab icpProfile={icpProfile} />;
      default:
        return <DemographicsTab icpProfile={icpProfile} />;
    }
  };

  return (
    <div>
      {/* Summary Card with tabs */}
      <ICPSummaryCard 
        icpProfile={icpProfile} 
        activeTab={activeTab} 
        onTabChange={handleTabChange} 
      />
      
      {/* Tab Content */}
      <div className="mt-8">
        {renderTabContent()}
      </div>
    </div>
  );
}