"use client"

import * as React from "react"
import { Check, ChevronDown, X, Search } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/app/components/ui/command"
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
          <Command>
            <CommandInput 
              placeholder={searchPlaceholder} 
              className="h-9"
              value={searchQuery}
              onValueChange={setSearchQuery}
              icon={<Search className="h-4 w-4" />} 
            />
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue: string) => {
                      onValueChange(currentValue)
                      const selectedItem = options.find(opt => opt.value === currentValue)
                      if (selectedItem) {
                        setSearchQuery(selectedItem.label)
                      }
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))
              ) : (
                <div className="py-6 text-center text-sm">{emptyMessage}</div>
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
} 