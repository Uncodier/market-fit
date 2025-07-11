import * as React from "react"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { format } from "date-fns"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart } from "@/app/components/ui/icons"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"

interface DataItem {
  name: string
  value: number
  color: string
}

interface SegmentDonutProps {
  showTotal?: boolean;
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
  onTotalUpdate?: (formattedTotal: string) => void;
  endpoint: string;
  formatValues?: boolean;
}

export function SegmentDonut({ 
  showTotal = false, 
  segmentId = "all", 
  startDate, 
  endDate,
  onTotalUpdate,
  endpoint,
  formatValues = false
}: SegmentDonutProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [data, setData] = useState<DataItem[]>([])
  const [totalValue, setTotalValue] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  
  // SVG dimensions - reduced for more compact layout
  const size = 320
  const center = size / 2
  const radius = 80
  const innerRadius = 48
  
  // Fetch data
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    
    const fetchData = async () => {
      if (!currentSite || currentSite.id === "default" || !startDate || !endDate) {
        setIsLoading(false);
        return;
      }
      
      if (isMounted) {
        setIsLoading(true);
        setHasError(false);
      }
      
      try {
        // Ensure we're using valid dates - defensive measure
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // Create safe copies of dates
        let safeStartDate = new Date(startDate);
        let safeEndDate = new Date(endDate);
        
        // Log the original dates for diagnosis
        console.log(`[SegmentDonut:${endpoint}] Original dates - startDate: ${safeStartDate.toISOString()}, endDate: ${safeEndDate.toISOString()}`);
        console.log(`[SegmentDonut:${endpoint}] Current date for comparison: ${now.toISOString()}`);
        
        // Validate and fix dates if needed
        if (safeStartDate > now) {
          console.warn(`[SegmentDonut:${endpoint}] Future start date detected: ${safeStartDate.toISOString()}, using 30 days ago instead`);
          safeStartDate = new Date(now);
          safeStartDate.setMonth(now.getMonth() - 1);
        }
        
        if (safeEndDate > now) {
          console.warn(`[SegmentDonut:${endpoint}] Future end date detected: ${safeEndDate.toISOString()}, using today instead`);
          safeEndDate = new Date(now);
        }
        
        // Log the adjusted dates
        console.log(`[SegmentDonut:${endpoint}] Adjusted dates - safeStartDate: ${safeStartDate.toISOString()}, safeEndDate: ${safeEndDate.toISOString()}`);
        
        // Create params with validated dates
        const params = new URLSearchParams();
        params.append("siteId", currentSite.id);
        if (user?.id) {
          params.append("userId", user.id);
        }
        params.append("startDate", safeStartDate.toISOString());
        params.append("endDate", safeEndDate.toISOString());
        if (segmentId && segmentId !== "all") {
          params.append("segmentId", segmentId);
        }
        
        const apiUrl = `/api/${endpoint}?${params.toString()}`;
        console.log(`[SegmentDonut:${endpoint}] Fetching data with params:`, Object.fromEntries(params.entries()));
        console.log(`[SegmentDonut:${endpoint}] Full API URL: ${apiUrl}`);
        
        // Use basic fetch instead of fetchWithController
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        // Check if component unmounted
        if (!isMounted) {
          console.log(`[SegmentDonut:${endpoint}] Component unmounted, ignoring response`);
          return;
        }
        
        // Log detailed response info for debugging
        console.log(`[SegmentDonut:${endpoint}] Response status: ${response.status}`);
        console.log(`[SegmentDonut:${endpoint}] Response headers:`, Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[SegmentDonut:${endpoint}] API error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        // Clone the response for debugging (in case parsing fails)
        const responseClone = response.clone();
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (parseError: unknown) {
          // If JSON parsing fails, try to log the raw text
          const rawText = await responseClone.text();
          console.error(`[SegmentDonut:${endpoint}] JSON parse error:`, parseError);
          console.log(`[SegmentDonut:${endpoint}] Raw response text (first 200 chars):`, rawText.substring(0, 200));
          throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
        
        console.log(`[SegmentDonut:${endpoint}] Received data:`, responseData);
        
        // Inspeccionar debug o metadata en la respuesta para diagnóstico
        if (responseData.debug) {
          console.log(`[SegmentDonut:${endpoint}] Response debug info:`, responseData.debug);
          
          // Si hay un mensaje específico sobre leads sin asignar, considerar como datos vacíos
          if (
            responseData.debug.message && 
            responseData.debug.message.includes("Only unassigned leads with no sales")
          ) {
            console.log(`[SegmentDonut:${endpoint}] API indicates data is not valid: ${responseData.debug.message}`);
            setData([]);
            setTotalValue(0);
            if (onTotalUpdate) {
              onTotalUpdate(formatValues ? formatCurrency(0) : '0');
            }
            setHasError(true);
            setIsLoading(false);
            return;
          }
        }
        
        if (responseData.metadata) {
          console.log(`[SegmentDonut:${endpoint}] Response metadata:`, responseData.metadata);
        }
        
        // Revisar fechas en la respuesta si existen
        if (responseData.debug && responseData.debug.startDate) {
          console.log(`[SegmentDonut:${endpoint}] API processed dates - startDate: ${responseData.debug.startDate}, endDate: ${responseData.debug.endDate}`);
        }
        
        // Only proceed with state updates if component is still mounted
        if (!isMounted) return;
        
        // Determine the key for data (could be segments or campaigns)
        const dataKey = responseData.segments 
          ? 'segments' 
          : responseData.campaigns 
            ? 'campaigns' 
            : null;
        
        console.log(`[SegmentDonut:${endpoint}] Data key:`, dataKey);
        
        // Log debug info if available
        if (responseData.debug) {
          console.log(`[SegmentDonut:${endpoint}] Debug info:`, responseData.debug);
        }
        
        if (!dataKey || !responseData[dataKey] || !Array.isArray(responseData[dataKey])) {
          console.log(`[SegmentDonut:${endpoint}] No valid data key found in response`);
          console.log(`[SegmentDonut:${endpoint}] Response keys:`, Object.keys(responseData));
          setData([]);
          setTotalValue(0);
          
          // Notify parent about the zero total
          if (onTotalUpdate) {
            onTotalUpdate(formatValues ? formatCurrency(0) : '0');
          }
          setIsLoading(false);
          return;
        }
        
        // Create a deep copy to avoid working with direct references
        const processedData = JSON.parse(JSON.stringify(responseData[dataKey]));
        
        // Check if array is empty
        if (processedData.length === 0) {
          console.log(`[SegmentDonut:${endpoint}] Empty data array in response`);
          setData([]);
          setTotalValue(0);
          
          // Notify parent about the zero total
          if (onTotalUpdate) {
            onTotalUpdate(formatValues ? formatCurrency(0) : '0');
          }
          setIsLoading(false);
          return;
        }
        
        // Ensure each item has the required properties
        const validData = processedData.filter((item: any) => {
          // Check if it has name and value
          const hasRequiredProps = item && typeof item.name === 'string' && !isNaN(item.value);
          if (!hasRequiredProps) {
            console.warn(`[SegmentDonut:${endpoint}] Filtered out invalid data item:`, item);
          }
          return hasRequiredProps;
        });
        
        console.log(`[SegmentDonut:${endpoint}] Processed ${validData.length} valid data items`);
        
        // Diagnóstico detallado: Examinar los 3 primeros items para verificar si hay datos fuera de rango
        if (validData.length > 0) {
          console.log(`[SegmentDonut:${endpoint}] Sample of first 3 items for diagnosis:`);
          validData.slice(0, 3).forEach((item: any, index: number) => {
            console.log(`  Item ${index+1}: Name=${item.name}, Value=${item.value}, Color=${item.color}`);
          });
        }
        
        // If we still have valid data
        if (validData.length > 0) {
          setData(validData);
          
          // Calculate total value
          const total = validData.reduce((sum: number, item: DataItem) => sum + item.value, 0);
          setTotalValue(total);
          
          console.log(`[SegmentDonut:${endpoint}] Total value: ${total}`);
          
          // Send formatted total to parent if callback provided
          if (onTotalUpdate) {
            onTotalUpdate(formatValues ? formatCurrency(total) : String(total));
          }
          setHasError(false);
        } else {
          console.log(`[SegmentDonut:${endpoint}] No valid data items after filtering`);
          setData([]);
          setTotalValue(0);
          
          // Notify parent about the zero total
          if (onTotalUpdate) {
            onTotalUpdate(formatValues ? formatCurrency(0) : '0');
          }
          setHasError(true);
        }
      } catch (error) {
        // Ignore AbortError as it's expected during cleanup
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log(`[SegmentDonut:${endpoint}] Request was aborted`);
          return;
        }
        
        console.error(`[SegmentDonut:${endpoint}] Error fetching data:`, error);
        
        if (isMounted) {
          setHasError(true);
          setData([]);
          setTotalValue(0);
          
          // Notify parent about the error with zero total
          if (onTotalUpdate) {
            onTotalUpdate(formatValues ? formatCurrency(0) : '0');
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    segmentId, 
    startDate, 
    endDate, 
    currentSite?.id, // Only depend on site ID, not the entire object
    user?.id, // Only depend on user ID, not the entire object
    onTotalUpdate, 
    endpoint, 
    formatValues
  ]);
  
  // Calculate slices for the donut
  let startAngle = 0
  const slices = data.map(item => {
    // Si solo hay un item, hacer un círculo completo (360°)
    const percentage = data.length === 1 ? 1 : (totalValue > 0 ? item.value / totalValue : 0)
    const angle = percentage * 2 * Math.PI
    const endAngle = startAngle + angle
    
    // Calculate SVG arc path
    const largeArcFlag = angle > Math.PI ? 1 : 0
    
    // Calculate points for outer arc
    const x1 = center + radius * Math.cos(startAngle)
    const y1 = center + radius * Math.sin(startAngle)
    const x2 = center + radius * Math.cos(endAngle)
    const y2 = center + radius * Math.sin(endAngle)
    
    // Calculate points for inner arc
    const x3 = center + innerRadius * Math.cos(endAngle)
    const y3 = center + innerRadius * Math.sin(endAngle)
    const x4 = center + innerRadius * Math.cos(startAngle)
    const y4 = center + innerRadius * Math.sin(startAngle)
    
    // Crear path especial para el caso de un solo sector (círculo completo)
    let path;
    if (data.length === 1) {
      // Para un solo sector, crear dos semicírculos para formar un círculo completo
      path = [
        `M ${center + radius},${center}`, // Punto de inicio en la derecha
        `A ${radius},${radius} 0 1,1 ${center - radius},${center}`, // Semicírculo superior
        `A ${radius},${radius} 0 1,1 ${center + radius},${center}`, // Semicírculo inferior
        `M ${center + innerRadius},${center}`, // Punto de inicio del círculo interno
        `A ${innerRadius},${innerRadius} 0 1,0 ${center - innerRadius},${center}`, // Semicírculo interno superior
        `A ${innerRadius},${innerRadius} 0 1,0 ${center + innerRadius},${center}`, // Semicírculo interno inferior
        "Z" // Cerrar el path
      ].join(" ");
    } else {
      // Path normal para múltiples sectores
      path = [
        `M ${x1},${y1}`, // Move to outer start point
        `A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2}`, // Outer arc
        `L ${x3},${y3}`, // Line to inner end point
        `A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x4},${y4}`, // Inner arc (reverse direction)
        "Z" // Close path
      ].join(" ");
    }
    
    // Calculate position for label (percentage)
    const midAngle = data.length === 1 
      ? Math.PI / 2 // Para un solo sector, colocar etiqueta en la parte superior
      : startAngle + angle / 2;
    
    // Calculate inner label (percentage)
    const innerLabelRadius = (radius + innerRadius) / 2
    const innerLabelX = center + innerLabelRadius * Math.cos(midAngle)
    const innerLabelY = center + innerLabelRadius * Math.sin(midAngle)
    
    // Calculate connector line and outer label position
    const labelLineStartRadius = radius
    const labelLineEndRadius = radius + 15
    const labelLineStartX = center + labelLineStartRadius * Math.cos(midAngle)
    const labelLineStartY = center + labelLineStartRadius * Math.sin(midAngle)
    const labelLineEndX = center + labelLineEndRadius * Math.cos(midAngle)
    const labelLineEndY = center + labelLineEndRadius * Math.sin(midAngle)
    
    // Calculate text label position - increased distance
    const labelRadius = radius + 24
    const isRightSide = Math.cos(midAngle) > 0
    const labelX = center + labelRadius * Math.cos(midAngle)
    const labelY = center + labelRadius * Math.sin(midAngle)
    const textAnchor = isRightSide ? "start" : "end"
    
    const formattedPercentage = `${Math.round(percentage * 100)}%`
    const formattedValue = formatValues ? formatCurrency(item.value) : String(item.value)
    
    const slice = {
      path,
      color: item.color,
      name: item.name,
      value: item.value,
      percentage,
      formattedPercentage,
      formattedValue,
      innerLabelX,
      innerLabelY,
      labelLineStartX,
      labelLineStartY,
      labelLineEndX,
      labelLineEndY,
      labelX,
      labelY,
      textAnchor,
      isRightSide
    }
    
    startAngle = endAngle
    return slice
  })
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px] animate-pulse">
        <div className="h-32 w-32 rounded-full bg-gray-200 dark:bg-gray-700"></div>
      </div>
    );
  }
  
  if (hasError || data.length === 0 || totalValue === 0) {
    let description = "No data available for the selected period.";
    
    if (endpoint === "clients-by-segment" || endpoint === "revenue-by-segment") {
      description = "No segment data available for the selected period.";
    } else if (endpoint === "clients-by-campaign" || endpoint === "revenue-by-campaign") {
      description = "No campaign data available for the selected period.";
    }
    
    return (
      <EmptyCard 
        icon={<PieChart className="h-6 w-6 text-muted-foreground" />}
        title="No data"
        description={description}
      />
    );
  }
  
  return (
    <div className="flex flex-col items-center pie-chart-container">
      {showTotal && (
        <div className="text-xl font-bold mb-1 donut-title-animate">
          {formatValues ? formatCurrency(totalValue) : totalValue}
        </div>
      )}
      
      <div className="w-full flex justify-center">
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="max-h-[320px]">
          {/* Gradient definitions */}
          <defs>
            {slices.map((slice, index) => {
              const baseColor = slice.color;
              // Extract RGB components from hex color
              const r = parseInt(baseColor.slice(1, 3), 16);
              const g = parseInt(baseColor.slice(3, 5), 16);
              const b = parseInt(baseColor.slice(5, 7), 16);
              
              // Create slightly lighter and darker versions for gradient
              const lighterColor = `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 0.9)`;
              const darkerColor = `rgba(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(0, b - 20)}, 1)`;
              
              return (
                <radialGradient 
                  key={`gradient-${index}`}
                  id={`slice-gradient-${index}`}
                  cx="50%" 
                  cy="50%" 
                  r="70%" 
                  fx="50%" 
                  fy="50%"
                >
                  <stop offset="0%" stopColor={lighterColor} />
                  <stop offset="100%" stopColor={darkerColor} />
                </radialGradient>
              );
            })}
          </defs>
          
          {/* Donut slices */}
          {slices.map((slice, index) => {
            // Calculate transformation for hover effect
            const isHovered = hoveredIndex === index;
            // Scale factor for the hovered slice
            const scaleFactor = 1.05;
            // Calculate transform origin (center of the slice)
            const midAngle = data.length === 1 
              ? Math.PI / 2 
              : startAngle + (slice.percentage * 2 * Math.PI) / 2;
            const translateX = isHovered ? 3 * Math.cos(midAngle) : 0;
            const translateY = isHovered ? 3 * Math.sin(midAngle) : 0;
            
            return (
              <path
                key={`slice-${index}`}
                d={slice.path}
                fill={`url(#slice-gradient-${index})`}
                stroke="white"
                strokeWidth="1"
                className="transition-all duration-200 donut-slice-animate"
                style={{
                  opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.5,
                  cursor: "pointer",
                  transform: isHovered 
                    ? `translate(${translateX}px, ${translateY}px) scale(${scaleFactor})` 
                    : "translate(0, 0) scale(1)",
                  transformOrigin: `${center}px ${center}px`,
                  animationDelay: `${index * 0.05}s`
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
          
          {/* Percentage labels (inside) */}
          {slices.map((slice, index) => {
            // Para un solo sector, siempre mostrar el porcentaje y hacerlo más grande
            if (data.length === 1 || slice.percentage >= 0.08) {
              const isHovered = hoveredIndex === index;
              const midAngle = data.length === 1 
                ? Math.PI / 2 
                : startAngle + (slice.percentage * 2 * Math.PI) / 2;
              const translateX = isHovered ? 3 * Math.cos(midAngle) : 0;
              const translateY = isHovered ? 3 * Math.sin(midAngle) : 0;
              
              return (
                <text
                  key={`inner-label-${index}`}
                  x={slice.innerLabelX}
                  y={slice.innerLabelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={data.length === 1 ? "14" : "10"}
                  fontWeight={isHovered ? "bold" : "medium"}
                  fill="white"
                  className={`${data.length === 1 ? "text-sm" : "text-xs"} transition-all duration-200 donut-label-animate`}
                  style={{
                    opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.5,
                    transform: isHovered 
                      ? `translate(${translateX}px, ${translateY}px)` 
                      : "translate(0, 0)",
                    animationDelay: `${index * 0.05 + 0.1}s`
                  }}
                >
                  {slice.formattedPercentage}
                </text>
              )
            }
            return null // Skip small slices
          })}
          
          {/* Connector lines and external labels */}
          {slices.map((slice, index) => {
            // Ajustar posición de la etiqueta cuando hay un solo sector
            const adjustedLabelX = data.length === 1 
              ? center 
              : slice.labelX;
            const adjustedLabelY = data.length === 1 
              ? center + radius + 30 // Colocar debajo del círculo cuando hay un solo sector
              : slice.labelY;
            const adjustedTextAnchor = data.length === 1 
              ? "middle" 
              : slice.textAnchor;
            
            // For small spaces, limit the number of labels
            if (data.length > 5 && index >= 5) return null;
            
            const isHovered = hoveredIndex === index;
            
            return (
              <g 
                key={`label-group-${index}`}
                className="transition-all duration-200 donut-external-label-animate"
                style={{
                  opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.5,
                  cursor: "pointer",
                  fontWeight: isHovered ? "bold" : "normal",
                  animationDelay: `${index * 0.05 + 0.1}s`
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Connector line - ocultar para un solo sector */}
                {data.length > 1 && (
                  <line
                    x1={slice.labelLineStartX}
                    y1={slice.labelLineStartY}
                    x2={slice.labelLineEndX}
                    y2={slice.labelLineEndY}
                    stroke={isHovered ? slice.color : "currentColor"}
                    strokeWidth={isHovered ? "1.5" : "1"}
                    strokeOpacity={isHovered ? "0.9" : "0.6"}
                  />
                )}
                
                {/* Segment name */}
                <text
                  x={adjustedLabelX}
                  y={adjustedLabelY - 6}
                  textAnchor={adjustedTextAnchor}
                  dominantBaseline="baseline"
                  fontSize={isHovered ? "10" : "9"}
                  fontWeight={isHovered ? "bold" : "medium"}
                  fill={isHovered ? slice.color : "currentColor"}
                  className="text-xs"
                >
                  {slice.name.length > 15 ? slice.name.substring(0, 15) + "..." : slice.name}
                </text>
                
                {/* Value and percentage */}
                <text
                  x={adjustedLabelX}
                  y={adjustedLabelY + 6}
                  textAnchor={adjustedTextAnchor}
                  dominantBaseline="hanging"
                  fontSize="9"
                  fill={isHovered ? slice.color : "currentColor"}
                  className={`text-xs ${isHovered ? "opacity-90" : "opacity-80"}`}
                >
                  {slice.formattedValue} ({slice.formattedPercentage})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes donut-slice-enter {
          from {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          to {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes donut-title-enter {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes donut-label-enter {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes donut-external-label-enter {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes pie-chart-fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .pie-chart-container {
          animation: pie-chart-fade-in 0.3s ease-out forwards;
        }
        
        .donut-title-animate {
          animation: donut-title-enter 0.3s ease-out forwards;
          opacity: 0;
        }
        
        .donut-slice-animate {
          animation: donut-slice-enter 0.4s ease-out forwards;
          opacity: 0;
        }
        
        .donut-label-animate {
          animation: donut-label-enter 0.3s ease-out forwards;
          opacity: 0;
        }
        
        .donut-external-label-animate {
          animation: donut-external-label-enter 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  )
} 