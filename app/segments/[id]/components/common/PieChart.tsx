import React from "react";

interface PieChartProps {
  data: {
    name: string;
    value: number;
    color?: string;
  }[];
  size?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  className?: string;
  isDonut?: boolean;
  donutThickness?: number;
}

export const PieChart = ({
  data = [],
  size = 240,
  showLabels = false,
  showLegend = true,
  className = "",
  isDonut = true,
  donutThickness = 60,
}: PieChartProps) => {
  // Ensure there's data to display
  if (!data || data.length === 0) {
    return (
      <div className={`flex justify-center items-center ${className}`} style={{ width: size, height: size }}>
        <p className="text-muted-foreground text-sm">No data to display</p>
      </div>
    );
  }

  // Calculate total value for percentage calculations
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Default colors if not provided
  const defaultColors = [
    "rgba(79, 70, 229, 0.8)", // indigo
    "rgba(59, 130, 246, 0.8)", // blue
    "rgba(16, 185, 129, 0.8)", // emerald
    "rgba(245, 158, 11, 0.8)", // amber
    "rgba(239, 68, 68, 0.8)", // red
    "rgba(168, 85, 247, 0.8)", // purple
    "rgba(236, 72, 153, 0.8)", // pink
    "rgba(20, 184, 166, 0.8)", // teal
  ];
  
  // Center of the pie chart
  const center = size / 2;
  const outerRadius = size * 0.35;
  const innerRadius = isDonut ? outerRadius - donutThickness : 0;
  
  // Calculate slices
  let startAngle = 0;
  const slices = data.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 2 * Math.PI;
    
    // Calculate SVG arc path
    const endAngle = startAngle + angle;
    const largeArcFlag = angle > Math.PI ? 1 : 0;
    
    // Start and end points of the outer arc
    const x1 = center + outerRadius * Math.cos(startAngle);
    const y1 = center + outerRadius * Math.sin(startAngle);
    const x2 = center + outerRadius * Math.cos(endAngle);
    const y2 = center + outerRadius * Math.sin(endAngle);
    
    // Para gráficos de dona, necesitamos puntos para el arco interno
    let path;
    
    if (isDonut) {
      // Puntos del arco interno (en orden inverso)
      const x3 = center + innerRadius * Math.cos(endAngle);
      const y3 = center + innerRadius * Math.sin(endAngle);
      const x4 = center + innerRadius * Math.cos(startAngle);
      const y4 = center + innerRadius * Math.sin(startAngle);
      
      // Crear el path para la dona
      path = [
        `M ${x1},${y1}`, // Mover al punto inicial del arco externo
        `A ${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${x2},${y2}`, // Arco externo
        `L ${x3},${y3}`, // Línea al punto inicial del arco interno
        `A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x4},${y4}`, // Arco interno (dirección opuesta)
        "Z" // Cerrar el path
      ].join(" ");
    } else {
      // Path para un pie chart normal
      path = [
        `M ${center},${center}`,
        `L ${x1},${y1}`,
        `A ${outerRadius},${outerRadius} 0 ${largeArcFlag},1 ${x2},${y2}`,
        "Z"
      ].join(" ");
    }
    
    // Calculate label position (in the middle of the arc)
    const labelAngle = startAngle + angle / 2;
    const labelRadius = isDonut ? (outerRadius + innerRadius) / 2 : outerRadius * 0.7;
    const labelX = center + labelRadius * Math.cos(labelAngle);
    const labelY = center + labelRadius * Math.sin(labelAngle);
    
    const slice = {
      path,
      color: item.color || defaultColors[index % defaultColors.length],
      percentage,
      labelX,
      labelY,
      name: item.name,
      startAngle,
      endAngle,
      formattedPercentage: Math.round(percentage * 100) + "%"
    };
    
    startAngle = endAngle;
    return slice;
  });
  
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Pie/Donut slices */}
        {slices.map((slice, i) => (
          <path
            key={`slice-${i}`}
            d={slice.path}
            fill={slice.color}
            stroke="white"
            strokeWidth="1"
          />
        ))}
        
        {/* Labels inside pie/donut (if enabled) */}
        {showLabels && slices.map((slice, i) => {
          // Only show label if the slice is big enough
          if (slice.percentage < 0.08) return null;
          
          return (
            <text
              key={`label-${i}`}
              x={slice.labelX}
              y={slice.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fontWeight="500"
              fill="white"
              className="text-xs"
            >
              {slice.formattedPercentage}
            </text>
          );
        })}
      </svg>
      
      {/* Legend with percentages */}
      {showLegend && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {data.map((item, i) => (
            <div key={`legend-${i}`} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: slices[i].color }}
              />
              <span className="text-xs">{item.name} ({slices[i].formattedPercentage})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 