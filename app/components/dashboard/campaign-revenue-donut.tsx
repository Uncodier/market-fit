import * as React from "react"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { format } from "date-fns"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PieChart } from "@/app/components/ui/icons"

interface CampaignData {
  name: string
  value: number
  color: string
}

// Format currency
const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount)
}

interface CampaignRevenueDonutProps {
  showTotalRevenue?: boolean;
  segmentId?: string;
  startDate?: Date;
  endDate?: Date;
  onTotalUpdate?: (formattedTotal: string) => void;
}

export function CampaignRevenueDonut({ 
  showTotalRevenue = false, 
  segmentId = "all", 
  startDate, 
  endDate,
  onTotalUpdate
}: CampaignRevenueDonutProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [campaignData, setCampaignData] = useState<CampaignData[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  
  // SVG dimensions
  const size = 380
  const center = size / 2
  const radius = 100
  const innerRadius = 60
  
  // Fetch campaign revenue data
  useEffect(() => {
    const fetchCampaignRevenue = async () => {
      if (!currentSite || currentSite.id === "default" || !startDate || !endDate) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setHasError(false);
      
      try {
        const safeStartDate = startDate;
        const safeEndDate = endDate;
        
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
        
        console.log(`[CampaignRevenueDonut] Fetching data with params:`, Object.fromEntries(params.entries()));
        
        const response = await fetch(`/api/campaign-revenue?${params.toString()}`);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[CampaignRevenueDonut] API error ${response.status}: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[CampaignRevenueDonut] Received data:`, data);
        
        if (!data.campaigns || !Array.isArray(data.campaigns) || data.campaigns.length === 0) {
          console.error("[CampaignRevenueDonut] No campaign data found in response");
          setHasError(true);
          setCampaignData([]);
          setTotalRevenue(0);
          
          // Notify parent about the zero total
          if (onTotalUpdate) {
            onTotalUpdate(formatCurrency(0));
          }
          return;
        }
        
        setCampaignData(data.campaigns);
        
        // Calculate total revenue
        const total = data.campaigns.reduce((sum: number, campaign: CampaignData) => sum + campaign.value, 0);
        setTotalRevenue(total);
        
        // Send formatted total to parent if callback provided
        if (onTotalUpdate) {
          onTotalUpdate(formatCurrency(total));
        }
      } catch (error) {
        console.error("Error fetching campaign revenue:", error);
        setHasError(true);
        setCampaignData([]);
        setTotalRevenue(0);
        
        // Notify parent about the error with zero total
        if (onTotalUpdate) {
          onTotalUpdate(formatCurrency(0));
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCampaignRevenue();
  }, [segmentId, startDate, endDate, currentSite, user, onTotalUpdate]);
  
  // Calculate slices for the donut
  let startAngle = 0
  const slices = campaignData.map(item => {
    // Si solo hay un item, hacer un círculo completo (360°)
    const percentage = campaignData.length === 1 ? 1 : (totalRevenue > 0 ? item.value / totalRevenue : 0)
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
    if (campaignData.length === 1) {
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
    const midAngle = campaignData.length === 1 
      ? Math.PI / 2 // Para un solo sector, colocar etiqueta en la parte superior
      : startAngle + angle / 2;
    
    // Calculate inner label (percentage)
    const innerLabelRadius = (radius + innerRadius) / 2
    const innerLabelX = center + innerLabelRadius * Math.cos(midAngle)
    const innerLabelY = center + innerLabelRadius * Math.sin(midAngle)
    
    // Calculate connector line and outer label position
    const labelLineStartRadius = radius
    const labelLineEndRadius = radius + 20
    const labelLineStartX = center + labelLineStartRadius * Math.cos(midAngle)
    const labelLineStartY = center + labelLineStartRadius * Math.sin(midAngle)
    const labelLineEndX = center + labelLineEndRadius * Math.cos(midAngle)
    const labelLineEndY = center + labelLineEndRadius * Math.sin(midAngle)
    
    // Calculate text label position - increased distance
    const labelRadius = radius + 30
    const isRightSide = Math.cos(midAngle) > 0
    const labelX = center + labelRadius * Math.cos(midAngle)
    const labelY = center + labelRadius * Math.sin(midAngle)
    const textAnchor = isRightSide ? "start" : "end"
    
    const slice = {
      path,
      color: item.color,
      name: item.name,
      value: item.value,
      percentage,
      formattedPercentage: `${Math.round(percentage * 100)}%`,
      formattedValue: formatCurrency(item.value),
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
      <div className="w-full flex flex-col justify-center items-center h-[320px]">
        <div className="relative w-40 h-40 mb-8">
          {/* Círculo de fondo */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
          {/* Círculo interior */}
          <div className="absolute inset-8 rounded-full bg-background dark:bg-background"></div>
        </div>
        
        {/* Etiquetas de leyenda */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between items-center mb-2 animate-pulse">
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="flex justify-between items-center mb-2 animate-pulse">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
          <div className="flex justify-between items-center animate-pulse">
            <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (hasError || campaignData.length === 0 || totalRevenue === 0) {
    return (
      <EmptyCard 
        icon={<PieChart className="h-8 w-8 text-muted-foreground" />}
        title="No revenue data available"
        description="There is no campaign revenue data available for the selected period."
      />
    );
  }
  
  return (
    <div className="flex flex-col items-center pie-chart-container">
      {showTotalRevenue && (
        <div className="text-2xl font-bold mb-2 donut-title-animate">
          {formatCurrency(totalRevenue)}
        </div>
      )}
      
      <div className="w-full flex justify-center">
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="max-h-[420px]">
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
                  id={`campaign-slice-gradient-${index}`}
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
          {slices.map((slice, index) => (
            <path
              key={`slice-${index}`}
              d={slice.path}
              fill={`url(#campaign-slice-gradient-${index})`}
              stroke="white"
              strokeWidth="1"
              className="donut-slice-animate"
              style={{
                transformOrigin: `${center}px ${center}px`,
                animationDelay: `${index * 0.05}s`
              }}
            />
          ))}
          
          {/* Percentage labels (inside) */}
          {slices.map((slice, index) => {
            // Para un solo sector, siempre mostrar el porcentaje y hacerlo más grande
            if (campaignData.length === 1 || slice.percentage >= 0.08) {
              return (
                <text
                  key={`inner-label-${index}`}
                  x={slice.innerLabelX}
                  y={slice.innerLabelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={campaignData.length === 1 ? "16" : "12"}
                  fontWeight="bold"
                  fill="white"
                  className={`${campaignData.length === 1 ? "text-base" : "text-xs"} donut-label-animate`}
                  style={{
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
            const adjustedLabelX = campaignData.length === 1 
              ? center 
              : slice.labelX;
            const adjustedLabelY = campaignData.length === 1 
              ? center + radius + 40 // Colocar debajo del círculo cuando hay un solo sector
              : slice.labelY;
            const adjustedTextAnchor = campaignData.length === 1 
              ? "middle" 
              : slice.textAnchor;
            
            return (
              <g key={`label-group-${index}`} className="donut-external-label-animate" style={{
                animationDelay: `${index * 0.05 + 0.1}s`
              }}>
                {/* Connector line - ocultar para un solo sector */}
                {campaignData.length > 1 && (
                  <line
                    x1={slice.labelLineStartX}
                    y1={slice.labelLineStartY}
                    x2={slice.labelLineEndX}
                    y2={slice.labelLineEndY}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeOpacity="0.6"
                  />
                )}
                
                {/* Segment name */}
                <text
                  x={adjustedLabelX}
                  y={adjustedLabelY - 8}
                  textAnchor={adjustedTextAnchor}
                  dominantBaseline="baseline"
                  fontSize="11"
                  fontWeight="medium"
                  fill="currentColor"
                  className="text-xs"
                >
                  {slice.name}
                </text>
                
                {/* Value and percentage */}
                <text
                  x={adjustedLabelX}
                  y={adjustedLabelY + 8}
                  textAnchor={adjustedTextAnchor}
                  dominantBaseline="hanging"
                  fontSize="11"
                  fill="currentColor"
                  className="text-xs opacity-80"
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

// Export the formatted total revenue for use in other components
export const formattedRevenueTotal = (totalRevenue: number): string => formatCurrency(totalRevenue)
export { formatCurrency } 