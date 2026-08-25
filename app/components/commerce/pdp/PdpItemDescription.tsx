"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { isShortItemDescription } from "./pdp-item-description"

type PdpItemDescriptionProps = {
  description?: string | null
  /** inline: under title/price, no heading. section: About this item below the fold (long copy only). */
  variant: "inline" | "section"
  className?: string
}

export function PdpItemDescription({
  description,
  variant,
  className,
}: PdpItemDescriptionProps) {
  const { t } = useLocalization()
  const text = description?.trim()
  if (!text) return null

  const isShort = isShortItemDescription(text)

  if (variant === "inline") {
    return (
      <p
        className={cn(
          "text-muted-foreground leading-relaxed whitespace-pre-wrap",
          !isShort && "line-clamp-3",
          className,
        )}
      >
        {text}
      </p>
    )
  }

  if (isShort) return null

  return (
    <div className={cn("mb-10 sm:mb-12", className)}>
      <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
        {t("marketplace.catalogDetails.about") || "About this item"}
      </h3>
      <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
        <p>{text}</p>
      </div>
    </div>
  )
}
