"use client"

import React, { useEffect, useState } from "react"
import { getQuotation } from "@/app/quotations/actions"
import { ensureQuotationPublicAccessToken } from "@/app/quotations/public-actions"
import { buildPublicQuoteUrl } from "@/app/quotations/public-token"
import { PublicDocumentShopNav } from "@/app/documents/components/PublicDocumentShopNav"
import { PublicDocumentViewSkeleton } from "@/app/documents/components/PublicDocumentViewSkeleton"
import { PrintableQuotation } from "@/app/quotations/components/PrintableQuotation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { documentT } from "@/app/lib/i18n/document-t"

export default function QuotePdfPage(props: { params: Promise<{ id: string }> }) {
  const { t } = useLocalization()
  const unwrappedParams = React.use(props.params)
  const [quotation, setQuotation] = useState<Awaited<ReturnType<typeof getQuotation>>["data"] | null>(null)
  const [buyerLink, setBuyerLink] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!unwrappedParams.id) return
      setLoading(true)
      try {
        const res = await getQuotation(String(unwrappedParams.id))
        if (res.error || !res.data) {
          setQuotation(null)
          return
        }
        setQuotation(res.data)

        const tokenRes = await ensureQuotationPublicAccessToken(res.data.id)
        if (tokenRes.token) {
          setBuyerLink(buildPublicQuoteUrl(tokenRes.token))
        }
      } catch (error) {
        console.error("Error loading quotation for print:", error)
        setQuotation(null)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [unwrappedParams.id])

  useEffect(() => {
    if (quotation) {
      document.title = documentT(quotation.site?.settings?.default_locale || "en", "commercePages.quote.title", { reference: quotation.id.substring(0, 8) })
    }
    return () => {
      document.title = t("commercePages.quote.returnTitle")
    }
  }, [quotation, t])

  const siteId = quotation?.site?.id || quotation?.site_id || null
  const siteName = quotation?.site?.name || ""
  const siteUrl = quotation?.site?.url || ""
  const logoUrl = quotation?.site?.logo_url || ""
  const locale = quotation?.site?.settings?.default_locale || "en"
  const location = quotation?.site?.settings?.locations?.[0] || null

  if (loading) {
    return <PublicDocumentViewSkeleton />
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-[#030303] dark:text-gray-100 print:bg-white print:text-black">
      <PublicDocumentShopNav
        siteId={siteId}
        siteName={siteName}
        logoUrl={logoUrl}
        currency={quotation?.currency || quotation?.site?.settings?.currency}
      />
      <div className="py-8 print:py-0">
        {quotation ? (
          <PrintableQuotation
            quotation={quotation}
            siteName={siteName}
            siteUrl={siteUrl}
            logoUrl={logoUrl}
            location={location}
            locale={locale}
            buyerLink={buyerLink}
          />
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">{t("commercePages.quote.notFound")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
