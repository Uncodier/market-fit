"use client"

import React from "react"
import { VariantAxis, VariantAxisValue, CatalogItem } from "@/app/types"
import { getVariantWidgetForKind } from "@/app/catalog/variant-axes"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

interface VariantPickerProps {
  axes: VariantAxis[]
  selectedOptions: Record<string, string>
  onOptionSelect: (axisId: string, valueId: string) => void
  childrenItems?: CatalogItem[] // To check availability of combinations
}

export function VariantPicker({ axes, selectedOptions, onOptionSelect, childrenItems = [] }: VariantPickerProps) {
  const { t } = useLocalization()

  if (!axes || axes.length === 0) return null

  // Helper to check if a specific option value is available given the other selected options
  const isValueAvailable = (axisId: string, valueId: string) => {
    if (!childrenItems || childrenItems.length === 0) return true // optimistic if no children loaded

    // Create a hypothetical selection
    const testSelection = { ...selectedOptions, [axisId]: valueId }
    
    // Find if any active child matches all selected options so far
    return childrenItems.some(child => {
      if (!child.metadata?.option_values) return false
      
      return Object.entries(testSelection).every(([aId, vId]) => {
        // Only check axes that have a selection in testSelection
        if (!vId) return true
        return child.metadata!.option_values![aId] === vId
      })
    })
  }

  return (
    <div className="space-y-6 mb-8">
      {axes.map(axis => {
        const widget = getVariantWidgetForKind(axis.kind)
        const label = axis.label || axis.kind
        
        return (
          <div key={axis.id} className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              {selectedOptions[axis.id] && (
                <span className="text-sm font-medium">
                  {axis.values.find(v => v.id === selectedOptions[axis.id])?.label}
                </span>
              )}
            </div>
            
            {widget === 'swatches' && (
              <div className="flex flex-wrap gap-3">
                {axis.values.map(v => {
                  const selected = selectedOptions[axis.id] === v.id
                  const available = isValueAvailable(axis.id, v.id)
                  
                  return (
                    <button
                      key={v.id}
                      onClick={() => onOptionSelect(axis.id, v.id)}
                      disabled={!available}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all
                        ${selected ? 'ring-2 ring-primary ring-offset-2' : 'ring-1 ring-border'}
                        ${!available ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}
                      `}
                      style={{ backgroundColor: v.hex || '#ccc' }}
                      title={v.label}
                    />
                  )
                })}
              </div>
            )}
            
            {(widget === 'chips' || widget === 'radio') && (
              <div className="flex flex-wrap gap-2">
                {axis.values.map(v => {
                  const selected = selectedOptions[axis.id] === v.id
                  const available = isValueAvailable(axis.id, v.id)
                  
                  return (
                    <button
                      key={v.id}
                      onClick={() => onOptionSelect(axis.id, v.id)}
                      disabled={!available}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium transition-all
                        ${selected 
                          ? 'bg-primary text-primary-foreground shadow-md' 
                          : 'bg-muted/50 hover:bg-muted border'}
                        ${!available ? 'opacity-40 cursor-not-allowed line-through' : ''}
                      `}
                    >
                      {v.label}
                    </button>
                  )
                })}
              </div>
            )}
            
            {widget === 'select' && (
              <Select
                value={selectedOptions[axis.id] || ''}
                onValueChange={(val) => onOptionSelect(axis.id, val)}
              >
                <SelectTrigger className="w-full max-w-[280px]">
                  <SelectValue placeholder={`Select ${label}`} />
                </SelectTrigger>
                <SelectContent>
                  {axis.values.map(v => (
                    <SelectItem 
                      key={v.id} 
                      value={v.id}
                      disabled={!isValueAvailable(axis.id, v.id)}
                    >
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )
      })}
    </div>
  )
}
