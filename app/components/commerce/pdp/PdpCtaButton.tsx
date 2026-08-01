"use client"

import { Button } from "@/app/components/ui/button"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PdpCtaButtonProps {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  className?: string
  variant?: "default" | "outline" | "secondary"
}

export function PdpCtaButton({ onClick, disabled, children, className, variant = "default" }: PdpCtaButtonProps) {
  return (
    <Button
      variant={variant}
      size="lg"
      className={cn(
        "w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-xl shadow-md transition-all active:scale-[0.98]",
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}
