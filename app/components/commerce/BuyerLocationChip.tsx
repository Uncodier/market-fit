"use client"

import { MapPin } from "@/app/components/ui/icons"

export function buyerLocationChipClass(active = false, restricted = false) {
  if (restricted) {
    return `flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border shadow-sm ${
      active
        ? "bg-red-600 text-white border-red-600"
        : "bg-red-600/15 text-red-600 border-red-600/40 md:hover:bg-red-600/25 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40"
    }`
  }
  return `flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
    active
      ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white shadow-sm"
      : "bg-white/90 text-gray-700 border-black/5 md:hover:bg-white active:bg-white dark:bg-[#030303]/80 dark:text-gray-300 dark:border-white/10 dark:md:hover:bg-[#030303] dark:active:bg-[#030303] backdrop-blur-md shadow-sm"
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${buyerLocationChipClass(active, restricted)} ${className}`}
      aria-label={label}
      aria-invalid={restricted || undefined}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[10rem]">{label}</span>
    </button>
  )
}
