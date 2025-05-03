"use client"

import React, { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

export interface ColorInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  colorPreviewClassName?: string
  containerClassName?: string
  showHexValue?: boolean
}

const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(
  ({ 
    className, 
    colorPreviewClassName, 
    containerClassName, 
    showHexValue = true,
    value, 
    onChange, 
    ...props 
  }, ref) => {
    const [color, setColor] = useState<string>(
      (value as string) || "#e0ff17"
    )
    const inputRef = useRef<HTMLInputElement>(null)
    const combinedRef = ref || inputRef

    useEffect(() => {
      if (value && value !== color) {
        setColor(value as string)
      }
    }, [value])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value
      setColor(newColor)
      if (onChange) {
        onChange(e)
      }
    }

    const handleClick = () => {
      if (inputRef.current) {
        inputRef.current.click()
      }
    }

    return (
      <div className={cn("flex items-center justify-between gap-2", containerClassName)}>
        {showHexValue && (
          <div 
            className="text-sm cursor-pointer hover:text-primary transition-colors"
            onClick={handleClick}
          >
            {color.toUpperCase()}
          </div>
        )}
        <div 
          className={cn(
            "h-9 w-9 rounded-md border cursor-pointer flex-shrink-0", 
            colorPreviewClassName
          )}
          style={{ backgroundColor: color }}
          onClick={handleClick}
        />
        <input
          type="color"
          className="sr-only"
          value={color}
          onChange={handleInputChange}
          ref={combinedRef as any}
          {...props}
        />
      </div>
    )
  }
)
ColorInput.displayName = "ColorInput"

export { ColorInput } 