"use client"

import React from "react"

interface AnimatedIconProps {
  icon: React.ComponentType<any>
  size?: number
  strokeWidth?: number
  className?: string
  isHovered?: boolean
  color?: string
}

export function AnimatedIcon({
  icon: Icon,
  size = 24,
  strokeWidth = 1.75, // Ligeramente más grueso para que destaque
  className = "",
  isHovered = false,
  color,
}: AnimatedIconProps) {
  return (
    <div 
      className={`relative flex items-center justify-center transition-transform duration-300 shrink-0 ${className}`}
      style={{ width: size, height: size, color }}
    >
      {/* 
        Efecto Simplificado para Mejor Rendimiento:
        Quitamos las multiples capas de drop-shadow y mix-blend-mode que causaban
        flickering y lentitud al scrollear (el navegador las ocultaba para mantener FPS).
      */}
      <div 
        className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isHovered ? "opacity-100 scale-110" : "opacity-90 group-hover:opacity-100 group-hover:scale-110"}`}
        style={{ 
          willChange: "transform, opacity" 
        }}
      >
        <Icon size={size} strokeWidth={strokeWidth} color="currentColor" />
      </div>
    </div>
  )
}
