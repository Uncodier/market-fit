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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { useTheme } from '@/app/context/ThemeContext';
import { EmptyState } from "@/app/components/ui/empty-state";
import { Button } from "@/app/components/ui/button";

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
  
  // Access theme context to check if dark mode is enabled
  const { isDarkMode } = useTheme?.() || { isDarkMode: false };

  // Ensure we have a complete profile with all required sections
  const completeProfile = {
    ...icpProfile,
    demographics: icpProfile.demographics || fallbackICPProfile.demographics,
    psychographics: icpProfile.psychographics || fallbackICPProfile.psychographics,
    behavioralTraits: icpProfile.behavioralTraits || fallbackICPProfile.behavioralTraits,
    professionalContext: icpProfile.professionalContext || fallbackICPProfile.professionalContext,
    customAttributes: icpProfile.customAttributes || fallbackICPProfile.customAttributes
  };

  return (
    <div>
      {/* 5 tarjetas en una sola fila que ahora funcionan como tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {/* Demographics Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "demographics" ? "bg-[#6466f1]" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("demographics")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "demographics" ? "" : ""
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "demographics" ? "text-white" : "text-muted-foreground"
              )}>Demographics</h3>
              <div className={`p-2 rounded-full flex items-center justify-center ${
                activeTab === "demographics" 
                  ? "bg-white" 
                  : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <Users className={cn(
                  "h-4 w-4", 
                  activeTab === "demographics" ? "text-[#6466f1]" : "text-muted-foreground"
                )} />
              </div>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "demographics" ? "text-white" : "text-muted-foreground"
            )}>
              {completeProfile.demographics.ageRange?.primary && (
                <li className="flex items-center gap-2">
                  <CalendarIcon className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "demographics" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Age: {completeProfile.demographics.ageRange.primary}</span>
                </li>
              )}
              {completeProfile.demographics.education?.primary && (
                <li className="flex items-center gap-2">
                  <GraduationCap className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "demographics" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Education: {completeProfile.demographics.education.primary}</span>
                </li>
              )}
              {completeProfile.demographics.locations && completeProfile.demographics.locations.length > 0 && (
                <li className="flex items-center gap-2">
                  <Globe className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "demographics" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Location: {completeProfile.demographics.locations[0].name}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Psychographics Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "psychographics" ? "bg-[#6466f1]" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("psychographics")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "psychographics" ? "" : ""
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "psychographics" ? "text-white" : "text-muted-foreground"
              )}>Psychographics</h3>
              <div className={`p-2 rounded-full flex items-center justify-center ${
                activeTab === "psychographics" 
                  ? "bg-white" 
                  : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <PieChart className={cn(
                  "h-4 w-4", 
                  activeTab === "psychographics" ? "text-[#6466f1]" : "text-muted-foreground"
                )} />
              </div>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "psychographics" ? "text-white" : "text-muted-foreground"
            )}>
              {completeProfile.psychographics?.values && completeProfile.psychographics.values.length > 0 && (
                <li className="flex items-center gap-2">
                  <DollarSign className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "psychographics" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Value: {completeProfile.psychographics.values[0].name}</span>
                </li>
              )}
              {completeProfile.psychographics?.goals && completeProfile.psychographics.goals.length > 0 && (
                <li className="flex items-center gap-2">
                  <Target className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "psychographics" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Goal: {completeProfile.psychographics.goals[0].name}</span>
                </li>
              )}
              {completeProfile.psychographics?.challenges && completeProfile.psychographics.challenges.length > 0 && (
                <li className="flex items-center gap-2">
                  <HelpCircle className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "psychographics" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Challenge: {completeProfile.psychographics.challenges[0].name}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Behavioral Traits Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "behavioral" ? "bg-[#6466f1]" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("behavioral")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "behavioral" ? "" : ""
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "behavioral" ? "text-white" : "text-muted-foreground"
              )}>Behavioral</h3>
              <div className={`p-2 rounded-full flex items-center justify-center ${
                activeTab === "behavioral" 
                  ? "bg-white" 
                  : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <BarChart className={cn(
                  "h-4 w-4", 
                  activeTab === "behavioral" ? "text-[#6466f1]" : "text-muted-foreground"
                )} />
              </div>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "behavioral" ? "text-white" : "text-muted-foreground"
            )}>
              {completeProfile.behavioralTraits?.onlineBehavior?.deviceUsage?.primary && (
                <li className="flex items-center gap-2">
                  <Settings className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "behavioral" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Device: {completeProfile.behavioralTraits.onlineBehavior.deviceUsage.primary}</span>
                </li>
              )}
              {completeProfile.behavioralTraits?.purchasingBehavior?.decisionFactors && 
               completeProfile.behavioralTraits.purchasingBehavior.decisionFactors.length > 0 && (
                <li className="flex items-center gap-2">
                  <CheckCircle2 className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "behavioral" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Factor: {completeProfile.behavioralTraits.purchasingBehavior.decisionFactors[0].name}</span>
                </li>
              )}
              {completeProfile.behavioralTraits?.contentConsumption?.preferredFormats && 
               completeProfile.behavioralTraits.contentConsumption.preferredFormats.length > 0 && (
                <li className="flex items-center gap-2">
                  <MessageSquare className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "behavioral" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Format: {completeProfile.behavioralTraits.contentConsumption.preferredFormats[0].type}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Professional Context Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "professional" ? "bg-[#6466f1]" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("professional")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "professional" ? "" : ""
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "professional" ? "text-white" : "text-muted-foreground"
              )}>Professional</h3>
              <div className={`p-2 rounded-full flex items-center justify-center ${
                activeTab === "professional" 
                  ? "bg-white" 
                  : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <User className={cn(
                  "h-4 w-4", 
                  activeTab === "professional" ? "text-[#6466f1]" : "text-muted-foreground"
                )} />
              </div>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "professional" ? "text-white" : "text-muted-foreground"
            )}>
              {completeProfile.professionalContext?.roles && completeProfile.professionalContext.roles.length > 0 && (
                <li className="flex items-center gap-2">
                  <User className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "professional" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Role: {completeProfile.professionalContext.roles[0].title}</span>
                </li>
              )}
              {completeProfile.professionalContext?.companySize?.primary && (
                <li className="flex items-center gap-2">
                  <Users className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "professional" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Company: {completeProfile.professionalContext.companySize.primary}</span>
                </li>
              )}
              {completeProfile.professionalContext?.industries && completeProfile.professionalContext.industries.length > 0 && (
                <li className="flex items-center gap-2">
                  <Globe className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "professional" ? "text-white/90" : "text-primary"
                  )} />
                  <span>Industry: {completeProfile.professionalContext.industries[0]}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
        
        {/* Custom Attributes Card */}
        <Card 
          className={cn(
            "border-none shadow-sm cursor-pointer transition-all hover:shadow-md relative overflow-hidden transform hover:-translate-y-1 duration-200",
            activeTab === "custom" ? "bg-[#6466f1]" : "hover:bg-accent"
          )}
          onClick={() => onTabChange("custom")}
        >
          <CardContent className={cn(
            "p-5",
            activeTab === "custom" ? "" : ""
          )}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn(
                "text-sm font-medium",
                activeTab === "custom" ? "text-white" : "text-muted-foreground"
              )}>Custom</h3>
              <div className={`p-2 rounded-full flex items-center justify-center ${
                activeTab === "custom" 
                  ? "bg-white" 
                  : isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}>
                <Settings className={cn(
                  "h-4 w-4", 
                  activeTab === "custom" ? "text-[#6466f1]" : "text-muted-foreground"
                )} />
              </div>
            </div>
            <ul className={cn(
              "text-sm space-y-2",
              activeTab === "custom" ? "text-white" : "text-muted-foreground"
            )}>
              {completeProfile.customAttributes && completeProfile.customAttributes.length > 0 && (
                <li className="flex items-center gap-2">
                  <Tag className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "custom" ? "text-white/90" : "text-primary"
                  )} />
                  <span>{completeProfile.customAttributes[0].name}: {completeProfile.customAttributes[0].value}</span>
                </li>
              )}
              {completeProfile.customAttributes && completeProfile.customAttributes.length > 1 && (
                <li className="flex items-center gap-2">
                  <Tag className={cn(
                    "h-4 w-4 shrink-0",
                    activeTab === "custom" ? "text-white/90" : "text-primary"
                  )} />
                  <span>{completeProfile.customAttributes[1].name}: {completeProfile.customAttributes[1].value}</span>
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

  // Define tab options for the dropdown
  const tabOptions = [
    { id: "demographics", label: "Demographics", icon: Users },
    { id: "psychographics", label: "Psychographics", icon: PieChart },
    { id: "behavioral", label: "Behavioral", icon: BarChart },
    { id: "professional", label: "Professional", icon: User },
    { id: "custom", label: "Custom", icon: Settings },
  ];

  // Check if the segment has ICP data
  const hasICPData = !!segment?.icp?.profile || Object.keys(segment?.icp || {}).length > 0;

  // Extract the ICP profile data from the segment, or use sample data if none exists
  // Usamos any como intermediario para evitar errores de tipo
  const profileData = segment?.icp?.profile || fallbackICPProfile;
  const icpProfile = profileData as ICPProfileData;

  // Ensure we have a complete profile with all required sections
  const completeProfile = {
    ...icpProfile,
    demographics: icpProfile.demographics || fallbackICPProfile.demographics,
    psychographics: icpProfile.psychographics || fallbackICPProfile.psychographics,
    behavioralTraits: icpProfile.behavioralTraits || fallbackICPProfile.behavioralTraits,
    professionalContext: icpProfile.professionalContext || fallbackICPProfile.professionalContext,
    customAttributes: icpProfile.customAttributes || fallbackICPProfile.customAttributes
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Render the appropriate tab content based on activeTab
  const renderTabContent = () => {
    // Ensure we have a complete profile with all required sections
    const completeProfile = {
      ...icpProfile,
      demographics: icpProfile.demographics || fallbackICPProfile.demographics,
      psychographics: icpProfile.psychographics || fallbackICPProfile.psychographics,
      behavioralTraits: icpProfile.behavioralTraits || fallbackICPProfile.behavioralTraits,
      professionalContext: icpProfile.professionalContext || fallbackICPProfile.professionalContext,
      customAttributes: icpProfile.customAttributes || fallbackICPProfile.customAttributes
    };

    switch (activeTab) {
      case "demographics":
        return <DemographicsTab icpProfile={completeProfile} />;
      case "psychographics":
        return <PsychographicsTab icpProfile={completeProfile} />;
      case "behavioral":
        return <BehavioralTraitsTab icpProfile={completeProfile} />;
      case "professional":
        return <ProfessionalContextTab icpProfile={completeProfile} />;
      case "custom":
        return <CustomAttributesTab icpProfile={completeProfile} />;
      default:
        return <DemographicsTab icpProfile={completeProfile} />;
    }
  };

  // If there's no ICP data, show an empty state
  if (!hasICPData) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12 text-primary/60" />}
        title="No ICP Profile Available"
        description="There's no Ideal Customer Profile data for this segment yet. Generate an ICP to better understand your audience's demographics, psychographics, and behavior."
        action={
          <Button 
            variant="default" 
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Generate ICP Profile with AI
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {/* Header with title and dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">
            <span className="text-primary">{completeProfile.name}</span>
          </h2>
          <p className="text-muted-foreground mt-1">{completeProfile.description}</p>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Ideal Customer Profile</span>
            <Select
              value={activeTab}
              onValueChange={handleTabChange}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {tabOptions.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id} className="flex items-center">
                    <div className="flex items-center gap-2">
                      {React.createElement(tab.icon, { className: "h-4 w-4 mr-2" })}
                      <span>{tab.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Summary Card with tabs */}
      <ICPSummaryCard 
        icpProfile={completeProfile} 
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

export default SegmentICPTab;