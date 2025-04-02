import React from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

// Función de sanitización para valores de color
const sanitizeColor = (color: string): string => {
  // Limitar la longitud del string de color
  if (color.length > 7) return '#000000';
  
  // Validar el formato del color
  const colorRegex = /^#[0-9A-Fa-f]{6}$/;
  return colorRegex.test(color) ? color : '#000000';
};

// Función de sanitización para valores numéricos
const sanitizeNumber = (value: number): number => {
  return isNaN(value) || !isFinite(value) ? 0 : value;
};

interface SafeMapProps {
  data: Array<{
    id: string;
    value: number;
    color?: string;
  }>;
  width?: number;
  height?: number;
  projectionConfig?: {
    scale: number;
    center: [number, number];
  };
}

export const SafeMap: React.FC<SafeMapProps> = ({
  data,
  width = 800,
  height = 600,
  projectionConfig = {
    scale: 150,
    center: [0, 20]
  }
}) => {
  // Sanitizar los datos de entrada
  const sanitizedData = data.map(item => ({
    id: String(item.id).slice(0, 50), // Limitar longitud del ID
    value: sanitizeNumber(item.value),
    color: sanitizeColor(item.color || '#000000')
  }));

  // Sanitizar la configuración de proyección
  const safeProjectionConfig = {
    scale: sanitizeNumber(projectionConfig.scale),
    center: [
      sanitizeNumber(projectionConfig.center[0]),
      sanitizeNumber(projectionConfig.center[1])
    ] as [number, number] // Forzar el tipo correcto
  };

  return (
    <div style={{ width, height }}>
      <ComposableMap
        projectionConfig={safeProjectionConfig}
        width={width}
        height={height}
      >
        <ZoomableGroup>
          <Geographies geography="/features.json">
            {({ geographies }) =>
              geographies.map((geo) => {
                const current = sanitizedData.find((d) => d.id === geo.id);
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={current ? current.color : '#F5F4F6'}
                    stroke="#D6D6DA"
                    style={{
                      default: {
                        outline: 'none',
                      },
                      hover: {
                        outline: 'none',
                        fill: current ? current.color : '#F5F4F6',
                      },
                      pressed: {
                        outline: 'none',
                        fill: current ? current.color : '#F5F4F6',
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