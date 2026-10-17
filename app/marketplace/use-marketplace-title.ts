import { useEffect } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

const kindKeys: Record<string, string> = {
  product: "marketplace.categories.products",
  service: "marketplace.categories.services",
  digital_asset: "marketplace.categories.digitalAssets",
  recurring: "marketplace.categories.subscriptions",
  discounts: "marketplace.categories.discounts",
}
const subtypeKeys: Record<string, string> = {
  course: "marketplace.subtypes.courses",
  ticket: "marketplace.subtypes.tickets",
  pass: "marketplace.subtypes.passes",
  license: "marketplace.subtypes.licenses",
  file: "marketplace.subtypes.files",
}

export function useMarketplaceTitle(kind: string, subtype: string) {
  const { t } = useLocalization()
  const key = subtype !== "all" ? subtypeKeys[subtype] : kindKeys[kind]
  const title = key ? `${t(key)} | Marketplace` : "Marketplace | Makinari"
  useEffect(() => { document.title = title }, [title])
}