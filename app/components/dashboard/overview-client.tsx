"use client"

import React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Datos para mostrar en el gráfico
const data = [
  { name: "Jan", total: 1200 },
  { name: "Feb", total: 1900 },
  { name: "Mar", total: 1500 },
  { name: "Apr", total: 1700 },
  { name: "May", total: 2400 },
  { name: "Jun", total: 2100 },
  { name: "Jul", total: 2300 },
  { name: "Aug", total: 2800 },
  { name: "Sep", total: 3200 },
  { name: "Oct", total: 2900 },
  { name: "Nov", total: 3500 },
  { name: "Dec", total: 3700 }
]

// Componente cliente puro para Recharts
export function OverviewClient() {
  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip 
            formatter={(value: number) => [value.toLocaleString(), 'Total']}
            labelStyle={{ fontWeight: 'bold', color: '#111827' }}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
            }}
            cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
          />
          <Bar 
            dataKey="total" 
            fill="#6366F1" 
            radius={[4, 4, 0, 0]} 
            barSize={40}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
} 