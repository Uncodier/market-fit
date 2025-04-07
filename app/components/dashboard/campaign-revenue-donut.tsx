import * as React from "react"

// Simulated data for campaign revenue
const campaignData = [
  {
    name: "Social Media Campaign",
    value: 42500,
    color: "#6366f1" // Indigo
  },
  {
    name: "Email Marketing",
    value: 28900,
    color: "#ec4899" // Pink
  },
  {
    name: "Content Marketing",
    value: 18700,
    color: "#14b8a6" // Teal
  },
  {
    name: "Paid Advertising",
    value: 34200,
    color: "#f59e0b" // Amber
  },
  {
    name: "Referral Program",
    value: 12600,
    color: "#8b5cf6" // Purple
  }
]

// Format currency
const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount)
}

// Calculate total revenue
const totalRevenue = campaignData.reduce((sum, campaign) => sum + campaign.value, 0)

interface CampaignRevenueDonutProps {
  showTotalRevenue?: boolean;
}

export function CampaignRevenueDonut({ showTotalRevenue = false }: CampaignRevenueDonutProps) {
  // SVG dimensions
  const size = 380
  const center = size / 2
  const radius = 100
  const innerRadius = 60
  
  // Calculate slices for the donut
  let startAngle = 0
  const slices = campaignData.map(item => {
    const percentage = item.value / totalRevenue
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
    
    // Create the path for the donut slice
    const path = [
      `M ${x1},${y1}`, // Move to outer start point
      `A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2}`, // Outer arc
      `L ${x3},${y3}`, // Line to inner end point
      `A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x4},${y4}`, // Inner arc (reverse direction)
      "Z" // Close path
    ].join(" ")
    
    // Calculate position for label (percentage)
    const midAngle = startAngle + angle / 2
    
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
  
  return (
    <div className="flex flex-col items-center">
      {showTotalRevenue && (
        <div className="text-2xl font-bold mb-2">
          {formatCurrency(totalRevenue)}
        </div>
      )}
      
      <div className="w-full flex justify-center">
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="max-h-[420px]">
          {/* Donut slices */}
          {slices.map((slice, index) => (
            <path
              key={`slice-${index}`}
              d={slice.path}
              fill={slice.color}
              stroke="white"
              strokeWidth="1"
            />
          ))}
          
          {/* Percentage labels (inside) */}
          {slices.map((slice, index) => {
            if (slice.percentage < 0.08) return null // Skip small slices
            return (
              <text
                key={`inner-label-${index}`}
                x={slice.innerLabelX}
                y={slice.innerLabelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="bold"
                fill="white"
                className="text-xs"
              >
                {slice.formattedPercentage}
              </text>
            )
          })}
          
          {/* Connector lines and external labels */}
          {slices.map((slice, index) => (
            <g key={`label-group-${index}`}>
              {/* Connector line */}
              <line
                x1={slice.labelLineStartX}
                y1={slice.labelLineStartY}
                x2={slice.labelLineEndX}
                y2={slice.labelLineEndY}
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.6"
              />
              
              {/* Segment name */}
              <text
                x={slice.labelX}
                y={slice.labelY - 8}
                textAnchor={slice.textAnchor}
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
                x={slice.labelX}
                y={slice.labelY + 8}
                textAnchor={slice.textAnchor}
                dominantBaseline="hanging"
                fontSize="11"
                fill="currentColor"
                className="text-xs opacity-80"
              >
                {slice.formattedValue} ({slice.formattedPercentage})
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

// Exportamos el total para que pueda ser usado por el componente padre
export const revenueTotalAmount = totalRevenue
export const formattedRevenueTotal = formatCurrency(totalRevenue) 