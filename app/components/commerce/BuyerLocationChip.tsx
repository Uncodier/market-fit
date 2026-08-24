"use client"

import { Button } from "@/app/components/ui/button"
import { MapPin } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export function buyerLocationChipClass(active = false) {
  const base =
    "flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-3xl shadow-sm"
  return `${base} ${
    active
      ? "bg-black/60 text-white border-black/30 dark:bg-white/60 dark:text-black dark:border-white/30"
      : "bg-white/60 text-gray-700 border-black/5 md:hover:bg-white/80 active:bg-white/80 dark:bg-[#030303]/60 dark:text-gray-300 dark:border-white/10 dark:md:hover:bg-[#030303]/80 dark:active:bg-[#030303]/80"
  }`
}

export function BuyerLocationChip({
  label,
  onClick,
  active = false,
  restricted = false,
  className = "",
}: {
  label: string
  onClick: () => void
  active?: boolean
  /** Outside service area — red chip */
  restricted?: boolean
  className?: string
}) {
  if (restricted) {
    return (
      <Button
        type="button"
        tint="destructive"
        size="sm"
        onClick={onClick}
        data-permission="allow"
        className={cn("!min-w-0 shrink-0 gap-1.5 px-5", className)}
        aria-label={label}
        aria-invalid
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate max-w-[10rem]">{label}</span>
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${buyerLocationChipClass(active)} ${className}`}
      aria-label={label}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[10rem]">{label}</span>
    </button>
  )
}
