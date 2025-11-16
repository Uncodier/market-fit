"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { cn } from "@/lib/utils"
import { X, ChevronDown, User } from "@/app/components/ui/icons"

export interface Option {
  value: string
  label: string
}

interface SimpleSearchSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  icon?: React.ReactNode
  className?: string
  emptyMessage?: string
}

export function SimpleSearchSelect({
  options,
  value,
  onChange,
  label,
  placeholder = "Select an option...",
  icon,
  className,
  emptyMessage = "No results found"
}: SimpleSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(option => option.value === value)
  
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  useEffect(() => {
    // Update input value when selectedOption changes
    if (selectedOption) {
      setSearchTerm(selectedOption.label)
    }
  }, [selectedOption])
  
  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [wrapperRef])
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) setIsOpen(true)
  }
  
  const handleSelect = (selected: Option) => {
    onChange(selected.value)
    setSearchTerm(selected.label)
    setIsOpen(false)
  }
  
  const handleClear = () => {
    onChange("")
    setSearchTerm("")
    setIsOpen(false)
  }
  
  return (
    <div ref={wrapperRef} className="w-full relative">
      {label && <Label className="mb-2 block">{label}</Label>}
      
      <div className="relative">
        <Input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "h-12 pr-8",
            icon && "pl-8",
            selectedOption && "bg-muted/30 border-primary",
            className
          )}
        />
        
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
        )}
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              isOpen && "transform rotate-180"
            )}
          />
        </div>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg">
          <div className="py-1 max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center px-3 py-2 cursor-pointer hover:bg-accent",
                    option.value === value && "bg-muted/50 font-medium"
                  )}
                  onClick={() => handleSelect(option)}
                >
                  {/* Removed check icon - selection indicated by background color */}
                  <span>{option.label}</span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 