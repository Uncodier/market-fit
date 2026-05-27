"use client"

import { useState, KeyboardEvent } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { X } from "@/app/components/ui/icons"

interface ArrayInputProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function ArrayInput({ value = [], onChange, disabled, placeholder = "Type and press Enter" }: ArrayInputProps) {
  const [inputValue, setInputValue] = useState("")

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const newTag = inputValue.trim()
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag])
        setInputValue("")
      } else if (newTag && value.includes(newTag)) {
        setInputValue("") // clear if already exists
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag on backspace if input is empty
      const newValue = [...value]
      newValue.pop()
      onChange(newValue)
    }
  }

  const removeTag = (indexToRemove: number) => {
    if (disabled) return
    onChange(value.filter((_, index) => index !== indexToRemove))
  }

  return (
    <div className={`flex flex-wrap gap-2 p-2 border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {value.map((tag, index) => (
        <Badge key={index} variant="secondary" className="flex items-center gap-1 px-2 py-1 text-sm font-normal">
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="hover:text-destructive focus:outline-none focus:text-destructive"
            >
              <X size={14} />
            </button>
          )}
        </Badge>
      ))}
      <input
        type="text"
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm disabled:cursor-not-allowed"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue.trim()) {
            const newTag = inputValue.trim()
            if (!value.includes(newTag)) {
              onChange([...value, newTag])
            }
            setInputValue("")
          }
        }}
        disabled={disabled}
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  )
}
