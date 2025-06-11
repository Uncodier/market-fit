"use client"

import React, { forwardRef, useRef } from 'react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import { useSafariIconFix } from '@/app/hooks/use-safari-detection'

interface SafariIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode
  iconSize?: number
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const SafariIconButton = forwardRef<HTMLButtonElement, SafariIconButtonProps>(
  ({ 
    icon,
    iconSize = 16,
    className,
    children,
    variant = "ghost",
    size = "icon",
    ...props 
  }, ref) => {
    const iconRef = useRef<HTMLDivElement>(null)
    
    // Aplicar fixes de Safari automáticamente
    useSafariIconFix(iconRef as React.RefObject<HTMLElement>, { 
      iconSize, 
      isButton: true 
    })

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn("safari-icon-button", className)}
        {...props}
      >
        <div 
          ref={iconRef}
          className="safari-icon-container"
          style={{ 
            width: `${iconSize}px`, 
            height: `${iconSize}px` 
          }}
        >
          {icon}
        </div>
        {children}
      </Button>
    )
  }
)

SafariIconButton.displayName = "SafariIconButton"

export { SafariIconButton } 