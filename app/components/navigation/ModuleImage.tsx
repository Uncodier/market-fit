"use client"

import { useState } from "react"
import type { WorkspaceArea } from "@/app/config/navigation-areas"
import { getModuleImageUrl } from "@/app/config/module-image-visuals"
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

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden bg-muted/50",
        className,
      )}
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
    </span>
  )
}
