"use client";

import React, { useMemo, useCallback } from 'react';
import { scaleQuantile } from 'd3-scale';
import { color } from 'd3-color';
import dynamic from 'next/dynamic';

// Lazy load react-simple-maps components to avoid build issues
const ComposableMap = dynamic(() => import('react-simple-maps').then(mod => ({ default: mod.ComposableMap })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full">Loading map...</div>
});

const Geographies = dynamic(() => import('react-simple-maps').then(mod => ({ default: mod.Geographies })), {
  ssr: false
});

const Geography = dynamic(() => import('react-simple-maps').then(mod => ({ default: mod.Geography })), {
  ssr: false
});

const ZoomableGroup = dynamic(() => import('react-simple-maps').then(mod => ({ default: mod.ZoomableGroup })), {
  ssr: false
});

interface MapData {
  id: string;
  value: number;
}

interface SafeMapWrapperProps {
  data: MapData[];
  width?: number;
  height?: number;
  projectionConfig?: {
    scale: number;
    center: [number, number];
  };
  style?: React.CSSProperties;
}

const colorRange = [
  "#FFEDA0",
  "#FED976",
  "#FEB24C",
  "#FD8D3C",
  "#FC4E2A",
  "#E31A1C",
  "#BD0026",
  "#800026"
] as const;

type ColorType = typeof colorRange[number];

const SafeMapWrapper: React.FC<SafeMapWrapperProps> = ({
  data,
  width = 800,
  height = 600,
  projectionConfig = {
    scale: 150,
    center: [0, 20],
  },
  style = {},
}) => {
  // Memoize the color scale to prevent unnecessary recalculations
  const colorScale = useMemo(() => {
    return scaleQuantile<ColorType>()
      .domain(data.map(d => d.value))
      .range(colorRange);
  }, [data]);

  // Memoize data lookup for performance
  const dataMap = useMemo(() => {
    const map = new Map<string, MapData>();
    data.forEach(item => {
      map.set(item.id, item);
    });
    return map;
  }, [data]);

  // Function to get colors for a geography - memoized
  const getGeographyColors = useCallback((geoId: string) => {
    const current = dataMap.get(geoId);
    const fillColor: string = current ? colorScale(current.value) || "#F5F4F6" : "#F5F4F6";
    const hoverColor: string = current ? color(fillColor)?.darker(0.2).toString() || fillColor : "#F5F4F6";
    const pressedColor: string = current ? color(fillColor)?.darker(0.3).toString() || fillColor : "#F5F4F6";
    
    return { fillColor, hoverColor, pressedColor };
  }, [dataMap, colorScale]);

  return (
    <div style={{ width, height, ...style }}>
      <ComposableMap
        projectionConfig={projectionConfig}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <ZoomableGroup>
          <Geographies geography="/features.json">
            {({ geographies }) =>
              geographies.map((geo) => {
                const { fillColor, hoverColor, pressedColor } = getGeographyColors(geo.id);

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke="#D6D5DA"
                    style={{
                      default: {
                        outline: "none",
                      },
                      hover: {
                        outline: "none",
                        fill: hoverColor,
                      },
                      pressed: {
                        outline: "none",
                        fill: pressedColor,
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};

export default SafeMapWrapper; 