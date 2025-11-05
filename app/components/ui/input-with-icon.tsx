"use client"

import React, { forwardRef, useEffect, useRef } from 'react'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/lib/utils'

interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  rightIconButton?: React.ReactNode
  onRightIconClick?: () => void
  iconSize?: number
  forceAbsoluteIcon?: boolean // Forzar position absolute !important en Safari
}

const InputWithIcon = forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ 
    className, 
    leftIcon, 
    rightIcon, 
    rightIconButton,
    onRightIconClick,
    iconSize = 16,
    forceAbsoluteIcon = false,
    ...props 
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const leftIconRef = useRef<HTMLDivElement>(null)
    const rightIconRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    
    const providedStyle = (props as any).style || {}
    const customPaddingLeft = providedStyle.paddingLeft as string | undefined
    const customPaddingRight = providedStyle.paddingRight as string | undefined
    
    // Calcular padding por defecto solo si no se proporciona uno personalizado
    const defaultPaddingLeft = leftIcon && !customPaddingLeft ? `${iconSize + 24}px` : undefined
    const defaultPaddingRight = (rightIcon || rightIconButton) && !customPaddingRight ? `${iconSize + 24}px` : undefined
    
    // Detectar Safari una sola vez
    const isSafari = typeof navigator !== 'undefined' && 
      navigator.userAgent.match(/AppleWebKit\/[\d.]+/g) &&
      navigator.userAgent.match(/Version\/[\d.]+.*Safari/) &&
      !navigator.userAgent.match(/Chrome\/[\d.]+/g)
    
    useEffect(() => {
      if (!isSafari) return

      const applySafariIconFixes = (iconContainer: HTMLElement) => {
        iconContainer.style.position = 'absolute'
        iconContainer.style.top = '50%'
        iconContainer.style.transform = 'translateY(-50%)'
        iconContainer.style.display = 'flex'
        iconContainer.style.alignItems = 'center'
        iconContainer.style.justifyContent = 'center'
        iconContainer.style.zIndex = '10'
        iconContainer.style.pointerEvents = rightIconButton ? 'auto' : 'none'
        
        // Fix para SVG en Safari
        iconContainer.querySelectorAll('svg').forEach(svg => {
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

      // Aplicar fixes al icono izquierdo
      if (leftIconRef.current) {
        leftIconRef.current.style.left = '12px'
        leftIconRef.current.style.width = `${iconSize}px`
        leftIconRef.current.style.height = `${iconSize}px`
        applySafariIconFixes(leftIconRef.current)
        
        // Dimensiones exactas para Safari
        Object.assign(leftIconRef.current.style, {
          minWidth: `${iconSize}px`,
          minHeight: `${iconSize}px`,
          maxWidth: `${iconSize}px`,
          maxHeight: `${iconSize}px`
        })
        
        // Forzar position absolute !important para casos específicos
        if (forceAbsoluteIcon) {
          leftIconRef.current.style.setProperty('position', 'absolute', 'important')
          leftIconRef.current.style.setProperty('left', '12px', 'important')
        }
      }

      // Aplicar fixes al icono derecho
      if (rightIconRef.current) {
        rightIconRef.current.style.right = '12px'
        applySafariIconFixes(rightIconRef.current)
      }

      // Container fixes
      if (containerRef.current) {
        containerRef.current.style.position = 'relative'
        containerRef.current.style.display = 'block'
      }

      // Safari sobrescribe padding, necesitamos !important para forzarlo
      if (inputRef.current && customPaddingLeft && forceAbsoluteIcon) {
        inputRef.current.style.setProperty('padding-left', customPaddingLeft, 'important')
      }
    }, [leftIcon, rightIcon, rightIconButton, iconSize, forceAbsoluteIcon, customPaddingLeft, isSafari])

    return (
      <div ref={containerRef} className="relative safari-input-container">
        <Input
          className={cn(
            "safari-input-fix",
            className
          )}
          style={{
            ...providedStyle,
            ...(defaultPaddingLeft && { paddingLeft: defaultPaddingLeft }),
            ...(defaultPaddingRight && { paddingRight: defaultPaddingRight })
          }}
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              (ref as any).current = node
            }
          }}
          {...props}
        />
        
        {leftIcon && (
          <div 
            ref={leftIconRef}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none safari-icon-container"
            data-icon={props.type === 'email' ? 'mail' : 'generic'}
            style={{ 
              width: `${iconSize}px`, 
              height: `${iconSize}px`,
              zIndex: 10,
              ...(forceAbsoluteIcon && {
                position: 'absolute',
                left: '12px'
              })
            }}
          >
            {leftIcon}
          </div>
        )}
        
        {(rightIcon || rightIconButton) && (
          <div 
            ref={rightIconRef}
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center safari-icon-container",
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