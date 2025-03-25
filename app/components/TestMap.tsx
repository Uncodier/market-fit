'use client';

import React from 'react';

interface TestMapProps {
  className?: string;
}

const TestMap: React.FC<TestMapProps> = ({ className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <div className="p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-medium mb-2">Map Test Component</h3>
        <p className="text-gray-600">This is a placeholder for the map test component.</p>
        <div className="h-64 bg-gray-200 rounded-lg mt-4 flex items-center justify-center">
          <p className="text-gray-500">Map Visualization Placeholder</p>
        </div>
      </div>
    </div>
  );
};

export default TestMap; 