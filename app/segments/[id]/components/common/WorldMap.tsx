import React from "react";
import WorldMapComponent, { LocationData } from "@/app/components/WorldMapComponent";

interface WorldMapProps {
  locations: Array<{ type: string; name: string; relevance: string }>;
}

export const WorldMap = ({ locations }: WorldMapProps) => {
  // Convertir las ubicaciones al formato esperado por WorldMapComponent
  const formattedLocations: LocationData[] = locations.map(location => ({
    name: location.name,
    type: location.type,
    relevance: location.relevance
  }));
  
  return (
    <div className="relative">
      <WorldMapComponent 
        locations={formattedLocations}
        height="240px"
      />
    </div>
  );
}; 