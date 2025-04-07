"use client";

import React, { useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import * as d3 from 'd3';

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
    return d3.scaleQuantile<number, ColorType>()
      .domain(data.map(d => d.value))
      .range(colorRange);
  }, [data]);

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
                const current = data.find(d => d.id === geo.id);
                const fillColor: string = current ? colorScale(current.value) : "#F5F4F6";
                const hoverColor: string = current ? d3.color(fillColor)?.darker(0.2).toString() || fillColor : "#F5F4F6";
                const pressedColor: string = current ? d3.color(fillColor)?.darker(0.3).toString() || fillColor : "#F5F4F6";

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