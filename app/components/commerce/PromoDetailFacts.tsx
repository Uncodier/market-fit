"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import type { PromoDetailFacts } from "@/app/promotions/promo-detail-facts"

type Section = {
  key: keyof PromoDetailFacts
  titleKey: string
  fallback: string
}

const SECTIONS: Section[] = [
  {
    key: "restrictions",
    titleKey: "shop.promo.restrictions",
    fallback: "Restrictions",
  },
  {
    key: "conditions",
    titleKey: "shop.promo.conditions",
    fallback: "Conditions",
  },
  {
    key: "specifications",
    titleKey: "shop.promo.specifications",
    fallback: "Specifications",
  },
]

type Props = {
  facts: PromoDetailFacts
}

export function PromoDetailFacts({ facts }: Props) {
  const { t } = useLocalization()

  const visible = SECTIONS.filter((section) => facts[section.key].length > 0)
  if (visible.length === 0) return null

  return (
    <div className="mt-12 sm:mt-16 space-y-10 sm:space-y-12">
      {visible.map((section) => (
        <div key={section.key} className="pt-8 border-t">
          <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
            {t(section.titleKey) || section.fallback}
          </h3>
          <ul className="space-y-2 text-muted-foreground leading-relaxed">
            {facts[section.key].map((line) => (
              <li key={line} className="flex gap-3 text-sm sm:text-base">
                <span
                  className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0"
                  aria-hidden
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
