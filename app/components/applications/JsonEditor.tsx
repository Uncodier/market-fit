"use client"

import { useState, useEffect } from "react"
import { Textarea } from "@/app/components/ui/textarea"

interface JsonEditorProps {
  value: any
  onChange: (value: any) => void
  disabled?: boolean
  className?: string
}

export function JsonEditor({ value, onChange, disabled, className = "" }: JsonEditorProps) {
  const [strValue, setStrValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const formatted = typeof value === 'object' && value !== null 
        ? JSON.stringify(value, null, 2) 
        : (value || "")
      setStrValue(formatted)
      setError(null)
    } catch (err) {
      setStrValue(String(value))
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    setStrValue(newVal)
    
    if (!newVal.trim()) {
      setError(null)
      onChange(null)
      return
    }

    try {
      const parsed = JSON.parse(newVal)
      setError(null)
      onChange(parsed)
    } catch (err: any) {
      setError(err.message || "Invalid JSON")
      // Don't call onChange if invalid, let the parent keep the last valid or let the parent handle string?
      // Actually, if we want to allow typing freely, we should just emit the raw string or parsed object.
      // If we emit the string when it's invalid, the parent component might try to save invalid JSON.
      // It's better to just emit the raw string, and the parent can decide, or the parent can attempt to parse.
      onChange(newVal)
    }
  }

  return (
    <div className="relative">
      <Textarea
        value={strValue}
        onChange={handleChange}
        disabled={disabled}
        className={`font-mono text-xs ${error ? 'border-destructive focus-visible:ring-destructive' : ''} ${className}`}
        spellCheck={false}
      />
      {error && (
        <div className="absolute -bottom-5 right-0 text-[10px] text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
