import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { 
  PieChart as Heart, TrendingUp as Target, HelpCircle as Lightbulb, Archive as Box, TableRows as Puzzle
} from "@/app/components/ui/icons";
import { SectionCard, AttributeCard } from "../common/Cards";
import { ImportanceIndicator } from "../common/Indicators";
import { ICPProfileData } from "../types";
import { SpiderChart } from "../common/SpiderChart";

interface PsychographicsTabProps {
  icpProfile: ICPProfileData;
}

export const PsychographicsTab = ({ icpProfile }: PsychographicsTabProps) => {
  // Asegurar que tenemos datos válidos
  const psychographics = icpProfile?.psychographics || {};
  const values = psychographics?.values || [];
  const interests = psychographics?.interests || [];
  const goals = psychographics?.goals || [];
  const challenges = psychographics?.challenges || [];
  const motivations = psychographics?.motivations || [];

  // Transform values for spider chart
  const valueItems = values.map((value: {name: string; importance: string; description: string}) => ({
    name: value?.name || '',
    value: (value?.importance === "Very high" ? 1 : 
           value?.importance === "High" ? 0.8 : 
           value?.importance === "Medium" ? 0.6 : 
           value?.importance === "Low" ? 0.4 : 0.2),
    color: "rgba(79, 70, 229, 0.8)"
  }));

  // Transform goals for spider chart
  const goalItems = goals.map((goal: {name: string; priority: string; description: string}) => ({
    name: goal?.name || '',
    value: (goal?.priority === "Very high" ? 1 : 
           goal?.priority === "High" ? 0.8 : 
           goal?.priority === "Medium" ? 0.6 : 
           goal?.priority === "Low" ? 0.4 : 0.2),
    color: "rgba(245, 158, 11, 0.8)" // Amber color
  }));

  // Transform challenges for spider chart
  const challengeItems = challenges.map((challenge: {name: string; severity: string; description: string}) => ({
    name: challenge?.name || '',
    value: (challenge?.severity === "Very high" ? 1 : 
           challenge?.severity === "High" ? 0.8 : 
           challenge?.severity === "Medium" ? 0.6 : 
           challenge?.severity === "Low" ? 0.4 : 0.2),
    color: "rgba(239, 68, 68, 0.8)" // Red color
  }));

  // Transform motivations for spider chart
  const motivationItems = motivations.map((motivation: {name: string; strength: string; description: string}) => ({
    name: motivation?.name || '',
    value: (motivation?.strength === "Very high" ? 1 : 
           motivation?.strength === "High" ? 0.8 : 
           motivation?.strength === "Medium" ? 0.6 : 
           motivation?.strength === "Low" ? 0.4 : 0.2),
    color: "rgba(16, 185, 129, 0.8)" // Green color
  }));

  // Función para convertir importancia a badge variant
  const getBadgeVariant = (importance: string) => {
    if (importance === "Very high" || importance === "High") return "indigo";
    if (importance === "Medium" || importance === "Medium-high") return "secondary";
    return "outline";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Values Section */}
      <SectionCard title="Core Values" icon={<Heart className="h-5 w-5" />}>
        <div className="space-y-4">
          {valueItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={valueItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {values.map((value: {name: string; importance: string; description: string}, index: number) => (
              <div key={index} className="bg-muted/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{value.name}</h4>
                  <Badge variant={getBadgeVariant(value.importance)}>
                    {value.importance}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
      
      {/* Interests Section */}
      <SectionCard title="Interests" icon={<Puzzle className="h-5 w-5" />}>
        <div className="space-y-4">
          <div className="bg-muted/20 p-4 rounded-lg">
            <h4 className="text-sm font-medium mb-3">Key Interests</h4>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Interest</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {interests.map((interest: string, index: number) => (
                    <tr key={index} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                      <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground w-12">
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                          index % 5 === 0 ? 'bg-blue-100 text-blue-700' : 
                          index % 5 === 1 ? 'bg-green-100 text-green-700' : 
                          index % 5 === 2 ? 'bg-amber-100 text-amber-700' : 
                          index % 5 === 3 ? 'bg-purple-100 text-purple-700' : 
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{interest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {interests.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No interests defined
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
      
      {/* Goals Section */}
      <SectionCard title="Goals" icon={<Target className="h-5 w-5" />}>
        <div className="space-y-4">
          {goalItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={goalItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {goals.map((goal: {name: string; priority: string; description: string}, index: number) => (
              <div key={index} className="bg-muted/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{goal.name}</h4>
                  <Badge variant={getBadgeVariant(goal.priority)}>
                    {goal.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{goal.description}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
      
      {/* Challenges Section */}
      <SectionCard title="Challenges" icon={<Lightbulb className="h-5 w-5" />}>
        <div className="space-y-4">
          {challengeItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={challengeItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {challenges.map((challenge: {name: string; severity: string; description: string}, index: number) => (
              <div key={index} className="bg-muted/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{challenge.name}</h4>
                  <Badge variant={getBadgeVariant(challenge.severity)}>
                    {challenge.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{challenge.description}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
      
      {/* Motivations Section */}
      <SectionCard title="Motivations" icon={<Box className="h-5 w-5" />}>
        <div className="space-y-4">
          {motivationItems.length > 0 && (
            <div className="bg-muted/20 p-4 rounded-lg">
              <div className="flex justify-center mb-4">
                <SpiderChart 
                  values={motivationItems} 
                  size={250} 
                  strokeWidth={2}
                  showLabels
                  className="mx-auto"
                />
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {motivations.map((motivation: {name: string; strength: string; description: string}, index: number) => (
              <div key={index} className="bg-muted/20 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{motivation.name}</h4>
                  <Badge variant={getBadgeVariant(motivation.strength)}>
                    {motivation.strength}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{motivation.description}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}; 