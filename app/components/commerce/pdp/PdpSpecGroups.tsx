"use client"

import { CheckCircle, Play } from "@/app/components/ui/icons"
import { optimizeForPreset } from "@/app/lib/image-utils"
import type { PdpSpecGroup, PdpSpecHighlight } from "@/app/catalog/product-details"

function HighlightMedia({ item }: { item: PdpSpecHighlight }) {
  if (item.image_url) {
    return (
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-muted">
        <img
          src={optimizeForPreset(item.image_url, "thumb")}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {item.video_url ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play className="w-5 h-5 text-white" />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      <CheckCircle className="w-5 h-5 text-primary" />
    </div>
  )
}

function HighlightCard({ item }: { item: PdpSpecHighlight }) {
  const body = (
    <div className="flex w-full items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-muted/30 border">
      <HighlightMedia item={item} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm sm:text-base text-foreground leading-snug">
          {item.name}
        </div>
      </div>
    </div>
  )

  if (!item.video_url) return body

  return (
    <a
      href={item.video_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block hover:opacity-90 transition-opacity"
    >
      {body}
    </a>
  )
}

export function PdpSpecGroups({ groups }: { groups: PdpSpecGroup[] }) {
  if (groups.length === 0) return null

  return (
    <div className="space-y-8 sm:space-y-10">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-5">{group.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {group.items.map((item, index) => (
              <HighlightCard key={item.id || `${group.title}-${item.name}-${index}`} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
