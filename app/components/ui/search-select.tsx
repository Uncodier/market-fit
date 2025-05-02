"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { cn } from "@/lib/utils"
import { X, Search, ChevronDown } from "@/app/components/ui/icons"

export interface SearchSelectOption {
  value: string
  label: string
}

interface SearchSelectProps {
  options: SearchSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  icon?: React.ReactNode
  emptyMessage?: string
  clearable?: boolean
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  className,
  icon,
  emptyMessage = "No results found",
  clearable = true
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(option => option.value === value)
  
  // Initialize search value from selected option
  useEffect(() => {
    if (selectedOption) {
      setSearch(selectedOption.label)
    } else if (value === "") {
      setSearch("")
    }
  }, [selectedOption, value])
  
  const filteredOptions = search.trim() === "" 
    ? options 
    : options.filter(option => 
        option.label.toLowerCase().includes(search.toLowerCase())
      )
  
  useEffect(() => {
    if (isOpen && filteredOptions.length > 0) {
      setHighlightedIndex(0)
    }
  }, [isOpen, filteredOptions])
  
  const handleInputClick = () => {
    setIsOpen(true)
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setIsOpen(true)
  }
  
  const handleOptionClick = (option: SearchSelectOption) => {
    onChange(option.value)
    setSearch(option.label)
    setIsOpen(false)
    inputRef.current?.blur()
  }
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
    setSearch("")
    inputRef.current?.focus()
  }
  
  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on an option in the dropdown
    if (listboxRef.current?.contains(e.relatedTarget as Node)) {
      return
    }
    
    // If user has selected an item but then changed the text manually,
    // reset to the selected value or empty
    if (!filteredOptions.some(opt => opt.label.toLowerCase() === search.toLowerCase())) {
      if (selectedOption) {
        setSearch(selectedOption.label)
      } else {
        setSearch("")
      }
    }
    
    setIsOpen(false)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }
    
    switch (e.key) {
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        break
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case "Enter":
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleOptionClick(filteredOptions[highlightedIndex])
        }
        break
    }
  }
  
  return (
    <div className="relative w-full">
      {label && <Label className="mb-2 block">{label}</Label>}
      
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "h-12 pr-9",
            icon && "pl-9",
            selectedOption && "bg-muted/40 font-medium", // Highlight when an option is selected
            className
          )}
        />
        
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {icon}
          </div>
        )}
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {clearable && value && (
            <button
              type="button"
              onClick={handleClear}
              className="mr-2 rounded-full h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      {isOpen && (
        <div 
          ref={listboxRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto bg-popover text-popover-foreground rounded-md border shadow-md"
        >
          {filteredOptions.length > 0 ? (
            <div className="py-1">
              {filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  className={cn(
                    "px-3 py-2 flex items-center gap-2 cursor-pointer text-sm",
                    index === highlightedIndex && "bg-accent text-accent-foreground",
                    value === option.value && "bg-primary/10 font-medium"
                  )}
                  onClick={() => handleOptionClick(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  role="option"
                  aria-selected={value === option.value}
                >
                  {value === option.value && (
                    <div className="h-4 w-4 text-primary flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <span className={cn("", value === option.value ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {option.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 