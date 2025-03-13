'use client';

import React, { useState } from 'react';
import WorldMapComponent, { CountryData } from '../components/WorldMapComponent';

export default function MapDemoPage() {
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [colorMode, setColorMode] = useState<'default' | 'intense' | 'cool'>('default');
  
  // Color ranges for different modes
  const colorModes = {
    default: {
      domain: [0.29, 0.68] as [number, number],
      range: ["#ffedea", "#ff5233"] as [string, string]
    },
    intense: {
      domain: [0.29, 0.68] as [number, number],
      range: ["#ffffcc", "#e31a1c"] as [string, string]
    },
    cool: {
      domain: [0.29, 0.68] as [number, number],
      range: ["#e0f3f8", "#4575b4"] as [string, string]
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Global Vulnerability Index</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-4 mb-4 dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Vulnerability Map</h2>
            <WorldMapComponent 
              height="500px"
              dataUrl="/vulnerability.csv"
              onSelectCountry={setSelectedCountry}
              selectedCountry={selectedCountry?.ISO3}
              colorDomain={colorModes[colorMode].domain}
              colorRange={colorModes[colorMode].range}
              valueField="2017"
            />
          </div>
        </div>
        
        <div>
          <div className="bg-white rounded-lg shadow-md p-4 mb-4 dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Map Controls</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color Theme
              </label>
              <div className="flex space-x-2">
                <button
                  className={`px-4 py-2 rounded-md ${
                    colorMode === 'default' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
                  }`}
                  onClick={() => setColorMode('default')}
                >
                  Default
                </button>
                <button
                  className={`px-4 py-2 rounded-md ${
                    colorMode === 'intense' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
                  }`}
                  onClick={() => setColorMode('intense')}
                >
                  Intense
                </button>
                <button
                  className={`px-4 py-2 rounded-md ${
                    colorMode === 'cool' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'
                  }`}
                  onClick={() => setColorMode('cool')}
                >
                  Cool
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <button
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                onClick={() => setSelectedCountry(null)}
              >
                Clear Selection
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-4 dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Selected Country</h2>
            
            {selectedCountry ? (
              <div className="dark:text-white">
                <div className="mb-2">
                  <span className="font-medium">Name:</span> {selectedCountry.name || selectedCountry.ISO3}
                </div>
                <div className="mb-2">
                  <span className="font-medium">ISO Code:</span> {selectedCountry.ISO3}
                </div>
                {selectedCountry.region && (
                  <div className="mb-2">
                    <span className="font-medium">Region:</span> {selectedCountry.region}
                  </div>
                )}
                {selectedCountry["2017"] !== undefined && (
                  <div className="mb-2">
                    <span className="font-medium">Vulnerability Index (2017):</span> {selectedCountry["2017"]}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 italic">
                No country selected. Click on a country to see details.
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow-md p-4 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">About This Map</h2>
        <p className="mb-2 dark:text-white">
          This interactive world map displays the vulnerability index for countries around the world.
          Higher values (shown in darker red) indicate higher vulnerability.
        </p>
        <ul className="list-disc pl-5 mb-4 dark:text-white">
          <li>Click on countries to view detailed information</li>
          <li>Change the color theme to visualize the data differently</li>
          <li>Hover over countries to highlight them</li>
        </ul>
        <p className="dark:text-white">
          The vulnerability index is a composite measure that takes into account various factors including
          economic stability, environmental risks, and social resilience.
        </p>
      </div>
    </div>
  );
} 