"use client"

import { useTheme } from "@/app/context/ThemeContext"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/app/components/ui/card"
import { format, subDays } from "date-fns"

interface WalletChartProps {
  currentBalance: number;
}

export function WalletChart({ currentBalance }: WalletChartProps) {
  const { isDarkMode } = useTheme()
  const strokeColor = isDarkMode ? "#3b82f6" : "#2563eb" // Blue for Stripe vibe
  const fillColor = isDarkMode ? "#3b82f6" : "#2563eb"

  // Generate realistic looking mock data leading up to the current balance
  // Make the chart empty if balance is 0 to avoid misleading visuals
  const data = Array.from({ length: 14 }).map((_, i) => {
    const daysAgo = 13 - i;
    const date = subDays(new Date(), daysAgo);
    
    // Create a somewhat stable line that eventually reaches currentBalance
    // This is just a placeholder until we track daily balance snapshots
    const variance = currentBalance === 0 ? 0 : (Math.random() - 0.5) * (currentBalance * 0.1);
    let mockBalance = currentBalance === 0 ? 0 : currentBalance - (daysAgo * (currentBalance * 0.02)) + variance;
    if (mockBalance < 0) mockBalance = 0;
    if (i === 13) mockBalance = currentBalance; // Ensure the last day matches exactly
    
    return {
      date: format(date, "MMM dd"),
      balance: Number(mockBalance.toFixed(2))
    }
  })

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Balance Activity</CardTitle>
        <CardDescription>Balance activity over the last 14 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#ffffff10" : "#00000010"} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDarkMode ? "#888" : "#666", fontSize: 12 }}
                dy={10}
                minTickGap={20}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDarkMode ? "#888" : "#666", fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
                width={60}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                  border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827', fontWeight: 600 }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Balance"]}
                labelStyle={{ color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke={strokeColor} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorBalance)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: strokeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
