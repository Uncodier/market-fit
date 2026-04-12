"use client"

import React, { forwardRef, useEffect, useRef, useState } from "react"
import { Input } from "./input"
import { Search, X } from "./icons"
import { Button } from "./button"
import { cn } from "@/lib/utils"

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch?: (value: string) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  showShortcut?: boolean
  shortcut?: string
  className?: string
  containerClassName?: string
  alwaysExpanded?: boolean
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ 
    onSearch, 
    onChange,
    showShortcut = true, 
    shortcut = "K", 
    placeholder = "Buscar...", 
    className,
    containerClassName,
    value,
    alwaysExpanded = false,
    ...props 
  }, ref) => {
    const localRef = useRef<HTMLInputElement>(null)
    const actualRef = ref || localRef

    // Expand state
    const hasValue = value !== undefined && value !== null && value !== ""
    const [isExpanded, setIsExpanded] = useState(alwaysExpanded || hasValue)

    // Expand automatically if a value is set from outside or if alwaysExpanded changes
    useEffect(() => {
      if (alwaysExpanded && !isExpanded) {
        setIsExpanded(true)
      } else if (hasValue && !isExpanded) {
        setIsExpanded(true)
      }
    }, [hasValue, isExpanded, alwaysExpanded])

    // Manejar el atajo de teclado (Command+K o Ctrl+K)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcut.toLowerCase()) {
          e.preventDefault()
          setIsExpanded(true)
          
          setTimeout(() => {
            // Usar la ref correcta para acceder al elemento
            if (typeof actualRef === 'function') {
              // No podemos hacer nada si es una función callback
            } else if (actualRef && actualRef.current) {
              actualRef.current.focus()
            }
          }, 50)
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [shortcut, actualRef])

    // Configurar el atributo para que useCommandK pueda encontrarlo
    useEffect(() => {
      if (typeof actualRef !== 'function' && actualRef && actualRef.current) {
        actualRef.current.setAttribute('data-command-k-input', 'true')
      }
    }, [actualRef])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Llamar a onSearch si se proporciona
      onSearch && onSearch(e.target.value)
      
      // También propagar el evento onChange original si se proporciona
      onChange && onChange(e)
    }

    const handleClear = () => {
      const e = { target: { value: '' } } as React.ChangeEvent<HTMLInputElement>
      handleInputChange(e)
      if (!alwaysExpanded) {
        setIsExpanded(false)
      }
    }

    const expandedWidthClass = containerClassName || "w-64"
    const expandedHeightClass = className?.includes("h-9") ? "h-9" : "h-11"

    return (
      <div 
        className={cn(
          "relative transition-all duration-300 ease-in-out",
          isExpanded ? cn(expandedWidthClass, expandedHeightClass) : "w-9 h-9",
          // Add containerClassName when expanded so any other classes apply
          isExpanded && containerClassName
        )}
      >
        {/* Collapsed State: Button */}
        <div 
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9 transition-all duration-300 ease-in-out",
            isExpanded ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"
          )}
        >
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => {
              setIsExpanded(true)
              setTimeout(() => {
                if (typeof actualRef !== 'function' && actualRef.current) {
                  actualRef.current.focus()
                }
              }, 50)
            }}
            title={placeholder}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* Expanded State: Input */}
        <div 
          className={cn(
            "absolute right-0 top-0 w-full flex items-center transition-all duration-300 ease-in-out origin-right",
            isExpanded ? cn("opacity-100 scale-100", expandedHeightClass) : "opacity-0 scale-95 pointer-events-none h-9"
          )}
        >
          <Input
            ref={actualRef}
            type="text"
            value={value}
            placeholder={placeholder}
            className={cn("w-full pr-16", expandedHeightClass, className)}
            icon={<Search className="h-4 w-4 text-muted-foreground" />}
            iconPosition="left"
            onChange={handleInputChange}
            onBlur={(e) => {
              const val = e.target.value;
              // Optional: collapse when it loses focus and is empty
              if (!hasValue && !val && !alwaysExpanded) {
                // Delay collapse to allow 'Clear' button click to register
                setTimeout(() => {
                  if (!val && !alwaysExpanded) {
                    setIsExpanded(false)
                  }
                }, 150)
              }
              props.onBlur?.(e)
            }}
            {...props}
          />
          {showShortcut && !hasValue && (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex z-20">
              <span className="text-xs">⌘</span>{shortcut}
            </kbd>
          )}
          {hasValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    )
  }
)

SearchInput.displayName = "SearchInput"

export { SearchInput } 