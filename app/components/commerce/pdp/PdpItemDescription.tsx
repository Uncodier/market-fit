"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { isShortItemDescription } from "./pdp-item-description"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"

type PdpItemDescriptionProps = {
  description?: string | null
  /** inline: under title/price, no heading. section: About this item below the fold (long copy only). */
  variant: "inline" | "section"
  className?: string
  aboutLabel?: string
  /** Section variant normally hides short copy. Tickets always show About. */
  showShort?: boolean
}

export function PdpItemDescription({
  description,
  variant,
  className,
  aboutLabel,
  showShort = false,
}: PdpItemDescriptionProps) {
  const { t } = useLocalization()
  const text = description?.trim().replace(/[«»]/g, '"')
  if (!text) return null

  const isShort = isShortItemDescription(text)

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-0 prose-ul:my-0 prose-li:my-0 prose-strong:font-bold prose-strong:text-foreground",
          !isShort && "line-clamp-3",
          className,
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
      </div>
    )
  }

  if (isShort && !showShort) return null

  return (
    <div className={cn("mb-10 sm:mb-12", className)}>
      <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
        {aboutLabel || t("marketplace.catalogDetails.about") || "About this item"}
      </h3>
      <div className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-muted-foreground leading-relaxed prose-strong:font-bold prose-strong:text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
      </div>
    </div>
  )
}
