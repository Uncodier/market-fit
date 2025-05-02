"use client"

import React from "react"
import { cn } from '@/app/lib/utils'

interface IconProps {
  className?: string
  size?: number
  style?: React.CSSProperties
  onClick?: () => void
  "aria-hidden"?: boolean
}

// Wrapper para nuestros iconos personalizados
const IconWrapper = ({ 
  children, 
  className = "", 
  size = 20, 
  style,
  ...props 
}: React.PropsWithChildren<IconProps>) => {
  return (
    <div 
      className={cn("inline-flex items-center justify-center", className)} 
      style={{ 
        width: size, 
        height: size,
        minWidth: size,
        minHeight: size,
        ...style
      }}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  )
}

// Iconos de flechas para el indicador
const ArrowUp = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 15 7-7 7 7" />
    </svg>
  </IconWrapper>
)

const ArrowDown = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 9-7 7-7-7" />
    </svg>
  </IconWrapper>
)

const Minus = ({ className = "", size = 20, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  </IconWrapper>
)

interface PercentageIndicatorProps {
  value: number;
  showZero?: boolean;
}

export function PercentageIndicator({ value, showZero = true }: PercentageIndicatorProps) {
  if (!showZero && value === 0) {
    return null;
  }
  
  // Determine the icon based on the value
  const getIcon = () => {
    if (value > 0) {
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    } else if (value < 0) {
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    } else {
      return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format the percentage value
  const formattedValue = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  
  // Determine the text color
  const textColorClass = value > 0 
    ? "text-green-500" 
    : value < 0 
      ? "text-red-500" 
      : "text-gray-500";

  return (
    <div className="flex items-center">
      {getIcon()}
      <span className={`text-xs font-medium ml-1 ${textColorClass}`}>
        {formattedValue}
      </span>
    </div>
  );
} 