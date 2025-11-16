"use client"

import React, { forwardRef, useEffect, useRef } from 'react'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/lib/utils'

interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  rightIconButton?: React.ReactNode // Para botones como el eye toggle
  onRightIconClick?: () => void
  iconSize?: number
}

const InputWithIcon = forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ 
    className, 
    leftIcon, 
    rightIcon, 
    rightIconButton,
    onRightIconClick,
    iconSize = 14.4,
    ...props 
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const leftIconRef = useRef<HTMLDivElement>(null)
    const rightIconRef = useRef<HTMLDivElement>(null)
    
    useEffect(() => {
      // Detectar Safari
      const isSafari = typeof navigator !== 'undefined' && 
        navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
        navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
        !navigator.userAgent.match(/Chrome\/[\d.]+/g)

      if (isSafari) {
        // Aplicar fixes específicos para Safari
        const applyIconFixes = (iconContainer: HTMLElement) => {
          iconContainer.style.position = 'absolute'
          iconContainer.style.top = '50%'
          iconContainer.style.transform = 'translateY(-50%)'
          iconContainer.style.display = 'flex'
          iconContainer.style.alignItems = 'center'
          iconContainer.style.justifyContent = 'center'
          iconContainer.style.zIndex = '10'
          iconContainer.style.pointerEvents = rightIconButton ? 'auto' : 'none'
          
          // Aplicar estilos a todos los SVG dentro del contenedor
          const svgElements = iconContainer.querySelectorAll('svg')
          svgElements.forEach(svg => {
            svg.style.display = 'block'
            svg.style.visibility = 'visible'
            svg.style.opacity = '1'
            svg.style.width = `${iconSize}px`
            svg.style.height = `${iconSize}px`
            svg.style.minWidth = `${iconSize}px`
            svg.style.minHeight = `${iconSize}px`
            svg.style.position = 'static'
            svg.style.margin = '0 auto'
          })
        }

        if (leftIconRef.current) {
          leftIconRef.current.style.left = '12px'
          leftIconRef.current.style.width = `${iconSize}px`
          leftIconRef.current.style.height = `${iconSize}px`
          applyIconFixes(leftIconRef.current)
          
          // Fix extra específico para Safari - asegurar que el contenedor tenga las dimensiones exactas
          leftIconRef.current.style.minWidth = `${iconSize}px`
          leftIconRef.current.style.minHeight = `${iconSize}px`
          leftIconRef.current.style.maxWidth = `${iconSize}px`
          leftIconRef.current.style.maxHeight = `${iconSize}px`
        }

        if (rightIconRef.current) {
          rightIconRef.current.style.right = '12px'
          applyIconFixes(rightIconRef.current)
        }

        // Asegurar que el contenedor tenga posición relativa
        if (containerRef.current) {
          containerRef.current.style.position = 'relative'
          containerRef.current.style.display = 'block'
        }
      }
    }, [leftIcon, rightIcon, rightIconButton, iconSize])

    // Calcular padding dinámicamente
    const paddingLeft = leftIcon ? `${iconSize + 24}px` : undefined
    const paddingRight = (rightIcon || rightIconButton) ? `${iconSize + 24}px` : undefined

    return (
      <div ref={containerRef} className="relative safari-input-container">
        <Input
          className={cn(
            "safari-input-fix",
            leftIcon && "pl-10", // Add pl-* class to prevent Safari CSS from overriding padding
            className
          )}
          style={{
            paddingLeft,
            paddingRight,
            ...((props as any).style || {})
          }}
          ref={ref}
          {...props}
        />
        
        {leftIcon && (
          <div 
            ref={leftIconRef}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none safari-icon-container input-left-icon"
            style={{ 
              width: `${iconSize}px`, 
              height: `${iconSize}px`,
              zIndex: 10
            }}
          >
            {leftIcon}
          </div>
        )}
        
        {(rightIcon || rightIconButton) && (
          <div 
            ref={rightIconRef}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center safari-icon-container input-right-icon",
              rightIconButton ? "cursor-pointer" : "pointer-events-none"
            )}
            style={{ 
              width: `${iconSize}px`, 
              height: `${iconSize}px`,
              zIndex: 10
            }}
            data-clickable={rightIconButton ? "true" : "false"}
            onClick={rightIconButton ? onRightIconClick : undefined}
          >
            {rightIconButton || rightIcon}
          </div>
        )}
      </div>
    )
  }
)

InputWithIcon.displayName = "InputWithIcon"

export { InputWithIcon }
