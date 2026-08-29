"use client"

import type { PdpGalleryEntry } from "@/app/lib/image-utils"

export function PdpProductGallery({
  itemName,
  mainSrc,
  entries,
  selectedIndex,
  onThumbClick,
}: {
  itemName: string
  mainSrc: string | null | undefined
  entries: PdpGalleryEntry[]
  selectedIndex: number
  onThumbClick: (index: number) => void
}) {
  return (
    <div className="space-y-4">
      <div className="relative aspect-[4/5] bg-muted rounded-[2rem] overflow-hidden border shadow-sm">
        {mainSrc ? (
          <img
            src={mainSrc}
            alt={itemName}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-center hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-muted-foreground font-medium">No Image</span>
          </div>
        )}
      </div>

      {entries.length > 1 && (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 snap-x">
          {entries.map((entry, i) => {
            const selected = selectedIndex === i
            return (
              <button
                key={`${entry.catalogItemId || "extra"}-${i}`}
                type="button"
                onClick={() => onThumbClick(i)}
                aria-pressed={selected}
                className={`relative aspect-square w-20 sm:w-24 shrink-0 rounded-2xl p-[3px] snap-start transition-colors ${
                  selected
                    ? "bg-foreground"
                    : "bg-border/60 hover:bg-foreground/40"
                }`}
              >
                <span className="relative block h-full w-full overflow-hidden rounded-[0.85rem] bg-muted">
                  <img
                    src={entry.url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
