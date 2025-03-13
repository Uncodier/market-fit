'use client';

import React, { useState } from 'react';
import TestMap from '../components/TestMap';
import WorldMapComponent from '../components/WorldMapComponent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ChevronLeft } from "@/app/components/ui/icons";
import { useRouter } from 'next/navigation';

const TestMapPage: React.FC = () => {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  
  // Datos de ejemplo para el WorldMapComponent
  const locations = [
    { name: 'United States', relevance: 'very high' },
    { name: 'Canada', relevance: 'high' },
    { name: 'Mexico', relevance: 'medium' },
    { name: 'Brazil', relevance: 'high' },
    { name: 'United Kingdom', relevance: 'high' },
    { name: 'France', relevance: 'medium' },
    { name: 'Germany', relevance: 'high' },
    { name: 'Spain', relevance: 'low' },
    { name: 'Italy', relevance: 'medium' },
    { name: 'Russia', relevance: 'high' },
    { name: 'China', relevance: 'very high' },
    { name: 'Japan', relevance: 'high' },
    { name: 'Australia', relevance: 'medium' },
    { name: 'South Africa', relevance: 'low' }
  ];
  
  return (
    <div className="container mx-auto p-4 space-y-8">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mr-4">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Prueba de Mapas</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>@react-map/world Test</CardTitle>
          <CardDescription>
            Testing the @react-map/world component for country selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestMap className="mt-4" />
        </CardContent>
      </Card>
      
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">WorldMapComponent</h2>
        <p className="mb-4">
          Ubicación seleccionada: {selectedLocation || 'Ninguna'}
        </p>
        <WorldMapComponent 
          locations={locations}
          selectedLocation={selectedLocation || undefined}
          onSelectLocation={(location) => setSelectedLocation(location)}
          height="500px"
        />
      </div>
    </div>
  );
};

export default TestMapPage; 