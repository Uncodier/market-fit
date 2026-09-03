"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SHOP_UNCATEGORIZED_NAME } from "./shop-catalog-shared"

interface ShopCategoryChipsProps {
  categories: string[]
  activeCategory: string
  onSelect: (category: string) => void
  disabled?: boolean
  /** Optional location pill rendered first in the row */
  leadingChip?: ReactNode
}

export function ShopCategoryChips({
  categories,
  activeCategory,
  onSelect,
  disabled = false,
  leadingChip,
}: ShopCategoryChipsProps) {
  const { t } = useLocalization()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const btn = activeRef.current
    const scroller = scrollerRef.current
    if (!btn || !scroller) return
    const left = btn.offsetLeft - scroller.clientWidth / 2 + btn.clientWidth / 2
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" })
  }, [activeCategory])

  if (categories.length === 0 && !leadingChip) return null

  const chipClass = (active: boolean) =>
    `flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 border backdrop-blur-3xl shadow-sm ${
      active
        ? "bg-black/60 text-white border-black/30 dark:bg-white/60 dark:text-black dark:border-white/30"
        : "bg-white/60 text-gray-700 border-black/5 md:hover:bg-white/80 active:bg-white/80 dark:bg-[#030303]/60 dark:text-gray-300 dark:border-white/10 dark:md:hover:bg-[#030303]/80 dark:active:bg-[#030303]/80"
    }`

  return (
    <div className="sticky top-[72px] z-30 pointer-events-none -mx-4 md:mx-0 pt-2 pb-4 mb-6">
      <div
        ref={scrollerRef}
        className="flex overflow-x-auto gap-3 scrollbar-hide w-full items-center pointer-events-auto py-2 px-4 md:px-0"
      >
        {leadingChip}
        {categories.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            ref={activeCategory === "all" ? activeRef : undefined}
            onClick={() => onSelect("all")}
            className={chipClass(activeCategory === "all")}
          >
            {t("shop.allCategories") || "All Categories"}
          </button>
        )}
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            disabled={disabled}
            ref={activeCategory === cat ? activeRef : undefined}
            onClick={() => onSelect(cat)}
            className={chipClass(activeCategory === cat)}
          >
            {cat === SHOP_UNCATEGORIZED_NAME ? t("shop.other") || "Other" : cat}
          </button>
        ))}
      </div>
    </div>
  )
}
