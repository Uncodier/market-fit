"use client"

import { useState } from "react"
import type { WorkspaceArea } from "@/app/config/navigation-areas"
import { getModuleImageUrl } from "@/app/config/module-image-visuals"
import { getModuleVisual } from "@/app/config/module-visuals"
import { cn } from "@/lib/utils"

interface ModuleImageProps {
  area: WorkspaceArea
  itemKey: string
  title: string
  className?: string
  imageClassName?: string
  loading?: "eager" | "lazy"
}

export function ModuleImage({
  area,
  itemKey,
  title,
  className,
  imageClassName,
  loading = "lazy",
}: ModuleImageProps) {
  const [failed, setFailed] = useState(false)
  const visual = getModuleVisual(area, itemKey)

  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-hidden", className)}
      style={{ background: visual.gradient }}
    >
      {!failed ? (
        <img
          src={getModuleImageUrl(area, itemKey, title)}
          alt={`${title} app icon`}
          width={256}
          height={256}
          loading={loading}
          decoding="async"
          draggable={false}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 35%, rgba(0,0,0,0.08) 100%)",
        }}
      />
    </span>
  )
}
