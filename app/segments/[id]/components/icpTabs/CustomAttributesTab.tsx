import React from "react";
import { Badge } from "@/app/components/ui/badge";
import { 
  Settings, PlusCircle as Zap, MessageSquare, User, Tag, Settings as Sliders
} from "@/app/components/ui/icons";
import { SectionCard, SummaryCard } from "../common/Cards";
import { ImportanceIndicator } from "../common/Indicators";
import { ICPProfileData } from "../types";

interface CustomAttributesTabProps {
  icpProfile: ICPProfileData;
}

// Definimos interfaces para manejar los posibles tipos de canales y áreas especiales
interface Channel {
  name?: string;
  effectiveness?: string;
  [key: string]: any;
}

interface SpecialtyArea {
  name?: string;
  details?: string;
  [key: string]: any;
}

export const CustomAttributesTab = ({ icpProfile }: CustomAttributesTabProps) => {
  // Verificar que icpProfile existe
  if (!icpProfile) {
    return <div className="p-4 text-center">No profile data available</div>;
  }

  // Obtener atributos personalizados
  const customAttributes = icpProfile.customAttributes || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <SectionCard variant="plain" title="Custom Attributes" icon={<Settings className="h-5 w-5" />}>
        <div className="space-y-3">
          {customAttributes.length > 0 ? (
            customAttributes.map((attribute: {name: string; value: string; description: string}, index: number) => (
              <div key={index} className="bg-muted/20 p-4 rounded-md overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{attribute.name}</h4>
                  <Badge variant="indigo">{attribute.value}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{attribute.description}</p>
              </div>
            ))
          ) : (
            <div className="bg-muted/20 p-4 rounded-md overflow-hidden">
              <p className="text-sm text-muted-foreground">No custom attributes available</p>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}; 