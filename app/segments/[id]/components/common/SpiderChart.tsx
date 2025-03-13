import React from "react";

interface SpiderChartProps {
  values: {
    name: string;
    value: number;
    color?: string;
  }[];
  size?: number;
  strokeWidth?: number;
  showLabels?: boolean;
  className?: string;
}

export const SpiderChart = ({
  values = [],
  size = 240,
  strokeWidth = 2,
  showLabels = true,
  className = "",
}: SpiderChartProps) => {
  // Asegurarse de que hay valores para mostrar
  if (!values || values.length === 0) {
    return (
      <div className={`flex justify-center items-center ${className}`} style={{ width: size, height: size }}>
        <p className="text-muted-foreground text-sm">No data to display</p>
      </div>
    );
  }

  const center = size / 2;
  const radius = size * 0.38;
  const angleStep = (Math.PI * 2) / values.length;
  
  // Generate points for the polygon
  const points = values.map((item, i) => {
    const value = item.value || 0; // Asegurar que el valor es un número
    const normalizedValue = Math.min(Math.max(value, 0), 1); // Limitar entre 0 y 1
    const angle = i * angleStep - Math.PI / 2; // Start from the top
    const x = center + radius * normalizedValue * Math.cos(angle);
    const y = center + radius * normalizedValue * Math.sin(angle);
    return { x, y };
  });
  
  // Generate points for the background grid
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const gridPoints = gridLevels.map(level => {
    return values.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = center + radius * level * Math.cos(angle);
      const y = center + radius * level * Math.sin(angle);
      return { x, y };
    });
  });

  // SVG path for the data polygon
  const polygonPath = points.map((point, i) => 
    (i === 0 ? "M" : "L") + `${point.x},${point.y}`
  ).join(" ") + "Z";
  
  // Generate paths for axis lines
  const axisLines = values.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x2 = center + radius * Math.cos(angle);
    const y2 = center + radius * Math.sin(angle);
    return {
      x1: center,
      y1: center,
      x2,
      y2,
    };
  });
  
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Background grid */}
        {gridLevels.map((level, levelIndex) => (
          <polygon
            key={`grid-${levelIndex}`}
            points={gridPoints[levelIndex]
              .map(point => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1"
          />
        ))}
        
        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={`axis-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth="1"
          />
        ))}
        
        {/* Data polygon */}
        <path
          d={polygonPath}
          fill="rgba(79, 70, 229, 0.15)"
          stroke="rgba(79, 70, 229, 0.8)"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={`point-${i}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="white"
            stroke={values[i]?.color || "rgba(79, 70, 229, 0.8)"}
            strokeWidth={strokeWidth}
          />
        ))}
        
        {/* Labels */}
        {showLabels && values.map((value, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelRadius = radius + 20;
          const x = center + labelRadius * Math.cos(angle);
          const y = center + labelRadius * Math.sin(angle);
          
          // Adjust text anchor based on position
          let textAnchor = "middle";
          if (angle < -Math.PI * 0.25 || angle > Math.PI * 0.75) {
            textAnchor = "middle"; // top
          } else if (angle >= -Math.PI * 0.25 && angle < Math.PI * 0.25) {
            textAnchor = "start"; // right
          } else if (angle >= Math.PI * 0.25 && angle < Math.PI * 0.75) {
            textAnchor = "middle"; // bottom
          } else {
            textAnchor = "end"; // left
          }
          
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="500"
              fill="currentColor"
              className="text-xs"
            >
              {value.name || ''}
            </text>
          );
        })}
      </svg>
    </div>
  );
}; 