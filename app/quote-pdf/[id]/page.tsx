"use client"

import React, { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getQuotation } from "@/app/quotations/actions"
import { ensureQuotationPublicAccessToken } from "@/app/quotations/public-actions"
import { buildPublicQuoteUrl } from "@/app/quotations/public-token"
import {
  PrintableQuotation,
  PrintableQuotationSkeleton,
} from "@/app/quotations/components/PrintableQuotation"

export default function QuotePdfPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params)
  const { currentSite } = useSite()
  const [quotation, setQuotation] = useState<any>(null)
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
      document.title = `Quote - ${quotation.id.substring(0, 8)}`
    }
    return () => {
      document.title = "Quotations | Market Fit"
    }
  }, [quotation])

  const siteName = quotation?.site?.name || currentSite?.name || ""
  const siteUrl = quotation?.site?.url || currentSite?.url || ""
  const logoUrl = quotation?.site?.logo_url || currentSite?.logo_url || ""
  const locale = currentSite?.settings?.default_locale || "en"
  const location = currentSite?.settings?.locations?.[0] || null

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white py-8 print:py-0">
      {loading ? (
        <PrintableQuotationSkeleton />
      ) : quotation ? (
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
          <p className="text-gray-500">Quote not found</p>
        </div>
      )}
    </div>
  )
}
