"use client"

import * as React from "react"
import { Check, ChevronDown, X, Search } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover"
import { Input } from "@/app/components/ui/input"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  clearable?: boolean
  disabled?: boolean
  searchPlaceholder?: string
  label?: string
  icon?: React.ReactNode
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  emptyMessage = "No results found",
  className,
  clearable = true,
  disabled = false,
  searchPlaceholder = "Search...",
  label,
  icon
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  
  const selectedOption = React.useMemo(() => 
    options.find(option => option.value === value), 
    [options, value]
  )
  
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options
    
    const lowerCaseQuery = searchQuery.toLowerCase()
    return options.filter(option => 
      option.label.toLowerCase().includes(lowerCaseQuery)
    )
  }, [options, searchQuery])

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onValueChange("")
    setSearchQuery("")
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    
    // Always open dropdown when typing
    if (!open) {
      setOpen(true)
    }
  }

  const handleSelectOption = (option: ComboboxOption) => {
    onValueChange(option.value)
    setSearchQuery(option.label)
    setOpen(false)
  }

  // Update displayed value when selected option changes
  React.useEffect(() => {
    if (selectedOption) {
      setSearchQuery(selectedOption.label)
    }
  }, [selectedOption])

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium">{label}</label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Input
              value={searchQuery}
              onChange={handleInputChange}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "w-full pr-9",
                icon && "pl-9",
                className
              )}
              onClick={() => setOpen(true)}
            />
            {icon && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {icon}
              </div>
            )}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {clearable && value && (
                <button
                  type="button"
                  className="h-4 w-4 mr-1 rounded-full text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                  onClick={handleClear}
                  aria-label="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden={true} />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[300px]" align="start">
          <div className="p-2">
            <div className="flex items-center border-b border-border px-3 pb-2 mb-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 h-8"
              />
            </div>
            <div className="max-h-64 overflow-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors",
                      value === option.value && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleSelectOption(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
} 