"use client"

import { Children, cloneElement, isValidElement, type CSSProperties, type SVGProps } from "react"

export interface IconProps {
  className?: string
  size?: number
  strokeWidth?: SVGProps<SVGSVGElement>["strokeWidth"]
  style?: CSSProperties
  onClick?: () => void
  "aria-hidden"?: boolean
}

// Base Component
export const IconWrapper = ({ 
  children, 
  className = "", 
  size = 18, 
  style = {}, 
  onClick,
  strokeWidth,
  "aria-hidden": ariaHidden = true
}: IconProps & { children: React.ReactNode }) => {
  return (
    <span 
      className={`inline-flex items-center justify-center safari-icon-fix shrink-0 [&>svg]:w-full [&>svg]:h-full ${className}`}
      style={{ 
        width: size, 
        height: size, 
        minWidth: size,
        minHeight: size,
        display: 'inline-flex',  // Explicit display style for Safari
        alignItems: 'center',    // Explicit alignment for Safari
        justifyContent: 'center', // Explicit justification for Safari
        ...style 
      }}
      onClick={onClick}
      aria-hidden={ariaHidden}
    >
      {Children.map(children, child =>
        strokeWidth !== undefined && isValidElement<SVGProps<SVGSVGElement>>(child)
          ? cloneElement(child, { strokeWidth })
          : child
      )}
    </span>
  )
}

