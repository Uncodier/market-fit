"use client"

import { MapPin } from "@/app/components/ui/icons"

export function buyerLocationChipClass(active = false, restricted = false) {
  const base =
    "flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-3xl shadow-sm"
  if (restricted) {
    return `${base} ${
      active
        ? "bg-red-600/70 text-white border-red-600/40"
        : "bg-red-600/20 text-red-600 border-red-600/40 md:hover:bg-red-600/30 dark:bg-red-500/25 dark:text-red-400 dark:border-red-500/40"
    }`
  }
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
