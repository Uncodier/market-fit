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
    <div className="space-y-6 p-2">
      {segments.map((segment, index) => (
        <div className="flex items-center p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" key={segment.name}>
          <div className="w-full pr-4">
            <div className="flex justify-between mb-1.5">
              <p className="text-sm font-medium leading-none">{segment.name}</p>
              <p className="text-sm font-medium">{segment.value}%</p>
            </div>
            <div className={`h-3 w-full rounded-full ${isDarkMode ? "bg-slate-700/50" : "bg-muted"}`}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${segment.value}%`,
                  backgroundColor: isDarkMode ? lightVariants[index % lightVariants.length] : segment.color
                }}
              />
            </div>
          </div>
          <div className="ml-2 min-w-16 flex items-center justify-end">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
              segment.delta > 0 
                ? (isDarkMode ? "bg-green-950/40 text-green-400" : "bg-green-50 text-green-600") 
                : (isDarkMode ? "bg-red-950/40 text-red-400" : "bg-red-50 text-red-600")
            }`}>
              {segment.delta > 0 ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m18 15-6-6-6 6"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              )}
              <span>{Math.abs(segment.delta)}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 