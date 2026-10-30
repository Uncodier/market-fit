"use client"

import { useState } from "react"
import type { WorkspaceArea } from "@/app/config/navigation-areas"
import {
  FULL_SIZE_MODULE_IMAGE_KEYS,
  getModuleImageUrl,
} from "@/app/config/module-image-visuals"
import { cn } from "@/lib/utils"
import { NAV_ITEM_ICON, AREA_ICON } from "@/app/config/module-visuals"

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
  const isFullSize = FULL_SIZE_MODULE_IMAGE_KEYS.has(itemKey)
  const FallbackIcon = NAV_ITEM_ICON[itemKey] ?? AREA_ICON[area]

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden",
        !isFullSize && "bg-muted/50",
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
          className={cn(
            "h-full w-full dark:brightness-[0.82]",
            isFullSize ? "object-contain" : "object-cover",
            imageClassName,
          )}
          onError={() => setFailed(true)}
        />
      ) : <span role="img" aria-label={`${title} app icon`} className="flex h-full w-full items-center justify-center text-foreground/80">
        <FallbackIcon className="h-1/2 w-1/2" aria-hidden={true} />
      </span>}
    </span>
  )
}
