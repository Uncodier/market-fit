"use client"

import Link from "next/link"
import { Badge } from "@/app/components/ui/badge"
import { useProcurementI18n } from "@/app/purchases/procurement/i18n/use-procurement-i18n"

export function TenderQuotationBadge({ href, title }: { href: string; title?: string }) {
  const { t } = useProcurementI18n()
  if (!/^\/(?:tenders\/[^/]+\/[^/]+|purchases\/tenders\/[^/]+)$/.test(href)) return null
  return <Link href={href} onClick={event => event.stopPropagation()} className="inline-flex"
    aria-label={t("procurement.portal.listing.view")}>
    <Badge variant="outline" className="max-w-64 truncate text-xs hover:bg-muted">{title || t("procurement.portal.activity.tender")}</Badge>
  </Link>
}