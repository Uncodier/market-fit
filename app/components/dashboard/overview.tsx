"use client"

import React from "react"
import { useTheme } from "@/app/context/ThemeContext"

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

// Implementación mejorada usando DIVs con características visuales avanzadas
export function Overview() {
  // Obtener el estado del tema
  const { isDarkMode } = useTheme()
  
  // Encuentra el valor máximo para calcular las alturas relativas
  const maxValue = Math.max(...data.map(item => item.total))
  
  // Colores adaptables según el tema
  const colors = {
    textLabel: isDarkMode ? "#94A3B8" : "#6B7280", // slate-400 : gray-500
    barFill: isDarkMode ? "#818CF8" : "#6366F1",   // indigo-400 : indigo-500
    barHover: isDarkMode ? "#A5B4FC" : "#4F46E5",  // indigo-300 : indigo-600
    gridLines: isDarkMode ? "#334155" : "#F3F4F6", // slate-700 : gray-100
    tooltip: {
      bg: isDarkMode ? "#1E293B" : "white",        // slate-800 : white
      border: isDarkMode ? "#475569" : "#E5E7EB",  // slate-600 : gray-200
      title: isDarkMode ? "#F1F5F9" : "#111827",   // slate-100 : gray-900
      text: isDarkMode ? "#CBD5E1" : "#6366F1"     // slate-300 : indigo-500
    }
  }
  
  // Formato de números para mostrar de forma legible
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num)
  }

  return (
    <div className="w-full h-[350px] flex flex-col pl-4">
      {/* Agregar ejes Y con valores */}
      <div className="flex flex-1 relative">
        {/* Eje Y con valores */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-4">
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(maxValue)}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(Math.round(maxValue * 0.75))}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(Math.round(maxValue * 0.5))}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>{formatNumber(Math.round(maxValue * 0.25))}</div>
          <div className={`text-xs ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>0</div>
        </div>

        {/* Líneas de guía horizontales */}
        <div className="absolute left-14 right-4 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
          <div className={`border-t w-full h-0 ${isDarkMode ? "border-slate-700/70" : "border-gray-100"}`}></div>
        </div>

        {/* Contenedor de barras */}
        <div className="w-full ml-14 pr-4 h-full flex items-end space-x-1">
          {data.map((item, index) => {
            // Calculamos la altura relativa basada en el valor máximo
            const height = Math.max(5, (item.total / maxValue) * 100)
            return (
              <div 
                key={index} 
                className="flex-1 flex flex-col items-center justify-end h-full group relative px-1"
              >
                {/* Tooltip mejorado adaptado al tema */}
                <div 
                  className={`
                    absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 
                    transition-opacity duration-200 rounded-md shadow-md p-2 
                    text-sm z-10 whitespace-nowrap translate-x-[-50%] left-1/2
                    ${isDarkMode ? 
                      "bg-slate-800 border border-slate-600" : 
                      "bg-white border border-gray-200"}
                  `}
                  style={{ 
                    boxShadow: isDarkMode 
                      ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.3)' 
                      : '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
                  }}
                >
                  <p className={`font-semibold ${isDarkMode ? "text-slate-100" : "text-gray-900"}`}>{item.name}</p>
                  <p className={isDarkMode ? "text-indigo-300" : "text-indigo-600"}>
                    <span className="font-medium">Total:</span> {formatNumber(item.total)}
                  </p>
                </div>
                
                {/* Barra con animación al cargar */}
                <div 
                  className={`
                    w-full transition-all rounded-t-sm origin-bottom
                    ${isDarkMode ? "bg-indigo-400 hover:bg-indigo-300" : "bg-indigo-500 hover:bg-indigo-600"}
                  `}
                  style={{ 
                    height: `${height}%`,
                    animation: `growUp 1s ease-out forwards`,
                    animationDelay: `${index * 0.05}s`
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Eje X con meses */}
      <div className="h-8 flex ml-14 pr-4 mt-2">
        {data.map((item, index) => (
          <div key={index} className={`flex-1 text-center text-xs font-medium ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
            {item.name}
          </div>
        ))}
      </div>

      {/* Estilos para animación */}
      <style jsx>{`
        @keyframes growUp {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
} 