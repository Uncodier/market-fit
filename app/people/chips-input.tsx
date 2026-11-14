import { useState } from "react"
import { Input } from "@/app/components/ui/input"
import { X } from "@/app/components/ui/icons"

export function ChipsInput({
  values,
  onChange,
  placeholder = "Search",
  onTextChange,
  inputValue,
  onInputChange
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  onTextChange?: (text: string) => void
  /** When provided with onInputChange, the input is controlled (e.g. for clearing from parent). */
  inputValue?: string
  onInputChange?: (text: string) => void
}) {
  const [internalText, setInternalText] = useState("")
  const isControlled = inputValue !== undefined && onInputChange !== undefined
  const text = isControlled ? inputValue : internalText
  const setText = isControlled ? onInputChange : setInternalText

  const add = () => {
    const v = text.trim()
    if (!v) return
    onChange(Array.from(new Set([...values, v])))
    setText("")
    if (onTextChange) onTextChange("")
  }
  return (
    <div className="space-y-2">
      <Input
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const newValue = e.target.value
          setText(newValue)
          if (onTextChange) onTextChange(newValue)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        className="h-10"
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="hover:text-destructive"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Press Enter to add; current text is included in search.</p>
    </div>
  )
}
