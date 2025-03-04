import * as React from "react"
import { useTheme } from "@/app/context/ThemeContext"

interface SegmentData {
  name: string
  value: number
  delta: number
  color: string
}

const baseColors = [
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#ef4444", // Red
  "#3b82f6", // Blue
]

// Versiones más claras para modo oscuro
const lightVariants = [
  "#818CF8", // Indigo-400
  "#F472B6", // Pink-400
  "#2DD4BF", // Teal-400
  "#FBBF24", // Amber-400
  "#A78BFA", // Purple-400
  "#34D399", // Emerald-400
  "#F87171", // Red-400
  "#60A5FA", // Blue-400
]

const segments: SegmentData[] = [
  {
    name: "Early Adopters",
    value: 78,
    delta: 5.2,
    color: baseColors[0]
  },
  {
    name: "Enterprise Decision Makers",
    value: 45,
    delta: -2.1,
    color: baseColors[1]
  },
  {
    name: "Small Business Owners",
    value: 62,
    delta: 3.8,
    color: baseColors[2]
  },
  {
    name: "Marketing Professionals",
    value: 56,
    delta: 1.2,
    color: baseColors[3]
  },
  {
    name: "Product Managers",
    value: 71,
    delta: 4.5,
    color: baseColors[4]
  },
]

export function SegmentMetrics() {
  const { isDarkMode } = useTheme()
  
  return (
    <div className="space-y-4">
      {segments.map((segment, index) => (
        <div className="flex items-center" key={segment.name}>
          <div className="w-full">
            <p className="text-sm font-medium leading-none">{segment.name}</p>
            <div className={`mt-2 h-2 w-full rounded-full ${isDarkMode ? "bg-slate-700/50" : "bg-muted"}`}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${segment.value}%`,
                  backgroundColor: isDarkMode ? lightVariants[index % lightVariants.length] : segment.color
                }}
              />
            </div>
          </div>
          <div className="ml-4 text-right">
            <p className="text-sm font-medium">{segment.value}%</p>
            <p className={`text-xs ${segment.delta > 0 
              ? (isDarkMode ? "text-green-400" : "text-green-500") 
              : (isDarkMode ? "text-red-400" : "text-red-500")}`}>
              {segment.delta > 0 ? "+" : ""}{segment.delta}%
            </p>
          </div>
        </div>
      ))}
    </div>
  )
} 