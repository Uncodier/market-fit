"use client"

import React, { forwardRef, useEffect, useRef } from "react"
import { Input } from "./input"
import { Search } from "./icons"
import { cn } from "@/lib/utils"

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onSearch?: (value: string) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  showShortcut?: boolean
  shortcut?: string
  className?: string
  containerClassName?: string
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ 
    onSearch, 
    onChange,
    showShortcut = true, 
    shortcut = "K", 
    placeholder = "Search...", 
    className,
    containerClassName,
    ...props 
  }, ref) => {
    const localRef = useRef<HTMLInputElement>(null)
    const actualRef = ref || localRef

    // Manejar el atajo de teclado (Command+K o Ctrl+K)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === shortcut.toLowerCase()) {
          e.preventDefault()
          
          // Usar la ref correcta para acceder al elemento
          if (typeof actualRef === 'function') {
            // No podemos hacer nada si es una función callback
          } else if (actualRef && actualRef.current) {
            actualRef.current.focus()
          }
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

    return (
      <div className={cn("relative w-64", containerClassName)}>
        <Input
          ref={ref}
          type="text"
          placeholder={placeholder}
          className={cn("w-full", className)}
          icon={<Search className="h-4 w-4 text-muted-foreground" />}
          iconPosition="left"
          onChange={handleInputChange}
          {...props}
        />
        {showShortcut && (
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>{shortcut}
          </kbd>
        )}
      </div>
    )
  }
)

SearchInput.displayName = "SearchInput"

export { SearchInput } 