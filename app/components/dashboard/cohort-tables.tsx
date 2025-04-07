"use client"

import * as React from "react"
import { useTheme } from "@/app/context/ThemeContext"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"

// Types for our cohort data
interface CohortData {
  cohort: string
  weeks: number[]
}

// Sales cohort data (simulated)
const salesCohortData: CohortData[] = [
  {
    cohort: "Jan 2023",
    weeks: [100, 85, 72, 68, 65, 63, 61, 60]
  },
  {
    cohort: "Feb 2023",
    weeks: [100, 82, 70, 65, 62, 60, 58]
  },
  {
    cohort: "Mar 2023",
    weeks: [100, 88, 76, 72, 69, 67]
  },
  {
    cohort: "Apr 2023",
    weeks: [100, 87, 75, 71, 68]
  },
  {
    cohort: "May 2023",
    weeks: [100, 86, 74, 70]
  },
  {
    cohort: "Jun 2023",
    weeks: [100, 89, 77]
  },
  {
    cohort: "Jul 2023",
    weeks: [100, 90]
  },
  {
    cohort: "Aug 2023",
    weeks: [100]
  }
]

// Usage cohort data (simulated)
const usageCohortData: CohortData[] = [
  {
    cohort: "Jan 2023",
    weeks: [100, 78, 65, 55, 48, 42, 38, 35]
  },
  {
    cohort: "Feb 2023",
    weeks: [100, 80, 68, 58, 50, 45, 42]
  },
  {
    cohort: "Mar 2023",
    weeks: [100, 82, 70, 60, 53, 48]
  },
  {
    cohort: "Apr 2023",
    weeks: [100, 83, 72, 62, 56]
  },
  {
    cohort: "May 2023",
    weeks: [100, 84, 73, 64]
  },
  {
    cohort: "Jun 2023",
    weeks: [100, 85, 75]
  },
  {
    cohort: "Jul 2023",
    weeks: [100, 87]
  },
  {
    cohort: "Aug 2023",
    weeks: [100]
  }
]

// Calculate color intensity based on value
function getColorIntensity(value: number, isDarkMode: boolean) {
  // Base colors
  const baseColor = isDarkMode ? [129, 140, 248] : [99, 102, 241]; // indigo-400 : indigo-500
  
  // Calculate opacity based on value (higher value = more intense color)
  const opacity = Math.max(0.1, value / 100);
  
  return `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${opacity})`;
}

export function CohortTables() {
  const { isDarkMode } = useTheme();
  
  return (
    <div className="space-y-8">
      {/* Sales Cohort Table */}
      <div>
        <h3 className="text-lg font-medium mb-4">Sales Retention by Week</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cohort</TableHead>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableHead key={i} className="text-center">Week {i + 1}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesCohortData.map((row) => (
                <TableRow key={row.cohort}>
                  <TableCell className="font-medium">{row.cohort}</TableCell>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const value = row.weeks[i] || 0;
                    return (
                      <TableCell 
                        key={i} 
                        className="text-center"
                        style={{ 
                          backgroundColor: value > 0 ? getColorIntensity(value, isDarkMode) : 'transparent',
                        }}
                      >
                        {value > 0 ? `${value}%` : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Usage Cohort Table */}
      <div>
        <h3 className="text-lg font-medium mb-4">Usage Retention by Week</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cohort</TableHead>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableHead key={i} className="text-center">Week {i + 1}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageCohortData.map((row) => (
                <TableRow key={row.cohort}>
                  <TableCell className="font-medium">{row.cohort}</TableCell>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const value = row.weeks[i] || 0;
                    return (
                      <TableCell 
                        key={i} 
                        className="text-center"
                        style={{ 
                          backgroundColor: value > 0 ? getColorIntensity(value, isDarkMode) : 'transparent',
                        }}
                      >
                        {value > 0 ? `${value}%` : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
} 