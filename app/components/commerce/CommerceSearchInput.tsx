"use client"

import { forwardRef, useRef } from "react"
import type { InputProps } from "@/app/components/ui/input"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { Search, X } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

type Props = Omit<InputProps, "value" | "onChange" | "icon" | "iconPosition"> & {
  value: string
  onChange: (value: string) => void
}

export const CommerceSearchInput = forwardRef<HTMLInputElement, Props>(
  function CommerceSearchInput({ value, onChange, className, ...props }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)

    return (
      <div className="relative w-full">
        <Input
          {...props}
          ref={(node) => {
            inputRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) ref.current = node
          }}
          type="text"
          aria-label={props["aria-label"] || props.placeholder}
          icon={<Search className="h-4 w-4 text-muted-foreground" />}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full pl-9 pr-10 h-9 text-sm bg-muted/50 focus:bg-white dark:focus:bg-gray-950 border border-transparent focus:border-black/10 dark:focus:border-white/10 rounded-full transition-all outline-none shadow-sm",
            className,
          )}
        />
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 z-20 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            title="Clear search"
            disabled={props.disabled || props.readOnly}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("")
              inputRef.current?.focus()
            }}
          >
            <X className="h-4 w-4" aria-hidden={true} />
          </Button>
        )}
      </div>
    )
  },
)