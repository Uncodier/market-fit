"use client"

import { useTheme } from "@/app/context/ThemeContext"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/app/components/ui/card"
import { format } from "date-fns"

interface SalesWithdrawalsChartProps {
  data?: Array<{ date: string; sales: number; withdrawals: number }>;
}

export function SalesWithdrawalsChart({ data: providedData }: SalesWithdrawalsChartProps) {
  const { isDarkMode } = useTheme()
  const salesColor = isDarkMode ? "#34d399" : "#10b981" // Green
  const withdrawalsColor = isDarkMode ? "#f87171" : "#ef4444" // Red

  const data = providedData || Array.from({ length: 14 }).map((_, i) => {
    const daysAgo = 13 - i;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    return {
      date: format(date, "MMM dd"),
      sales: 0,
      withdrawals: 0
    }
  })

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Accredited Sales vs Withdrawals</CardTitle>
        <CardDescription>Daily comparison of sales earnings and payout requests</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={salesColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={salesColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWithdrawals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={withdrawalsColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={withdrawalsColor} stopOpacity={0} />
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
                formatter={(value: number, name: string) => [
                  `$${value.toFixed(2)}`, 
                  name === "sales" ? "Accredited Sales" : "Withdrawals"
                ]}
                labelStyle={{ color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: '4px' }}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                formatter={(value) => {
                  if (value === "sales") return "Accredited Sales"
                  if (value === "withdrawals") return "Withdrawals"
                  return value
                }}
              />
              <Area 
                type="monotone" 
                dataKey="sales" 
                stroke={salesColor} 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorSales)"
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Area 
                type="monotone" 
                dataKey="withdrawals" 
                stroke={withdrawalsColor} 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorWithdrawals)"
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
