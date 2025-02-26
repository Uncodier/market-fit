import * as React from "react"

interface SegmentData {
  name: string
  value: number
  delta: number
  color: string
}

const colors = [
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#ef4444", // Red
  "#3b82f6", // Blue
]

const segments: SegmentData[] = [
  {
    name: "Early Adopters",
    value: 78,
    delta: 5.2,
    color: colors[0]
  },
  {
    name: "Enterprise Decision Makers",
    value: 45,
    delta: -2.1,
    color: colors[1]
  },
  {
    name: "Small Business Owners",
    value: 62,
    delta: 3.8,
    color: colors[2]
  },
  {
    name: "Marketing Professionals",
    value: 56,
    delta: 1.2,
    color: colors[3]
  },
  {
    name: "Product Managers",
    value: 71,
    delta: 4.5,
    color: colors[4]
  },
]

export function SegmentMetrics() {
  return (
    <div className="space-y-4">
      {segments.map((segment) => (
        <div className="flex items-center" key={segment.name}>
          <div className="w-full">
            <p className="text-sm font-medium leading-none">{segment.name}</p>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${segment.value}%`,
                  backgroundColor: segment.color
                }}
              />
            </div>
          </div>
          <div className="ml-4 text-right">
            <p className="text-sm font-medium">{segment.value}%</p>
            <p className={`text-xs ${segment.delta > 0 ? "text-green-500" : "text-red-500"}`}>
              {segment.delta > 0 ? "+" : ""}{segment.delta}%
            </p>
          </div>
        </div>
      ))}
    </div>
  )
} 