"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { listBuyerVisitSites } from "@/app/visits/actions"
import { VisitRegistrationForm } from "@/app/visits/components/VisitRegistrationForm"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Label } from "@/app/components/ui/label"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function BuyerNewVisitPage() {
  const { t } = useLocalization()
  const { data: sitesData, isLoading } = useSWR("buyer-visit-sites", () => listBuyerVisitSites())
  const [siteId, setSiteId] = useState("")
  const [buyerName, setBuyerName] = useState("")
  const [buyerEmail, setBuyerEmail] = useState("")

  const sites = sitesData?.data || []

  useEffect(() => {
    if (sites.length && !siteId) setSiteId(sites[0].id)
  }, [sites, siteId])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      if (!user) return
      const name =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        ""
      setBuyerName(name)
      setBuyerEmail(user.email || "")
    })
  }, [])

  return (
    <div className="max-w-xl mx-auto w-full px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("buyer.visits.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("buyer.visits.subtitle")}</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/buyer">{t("common.back")}</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-32 bg-muted/40 rounded-xl animate-pulse" />
      ) : sites.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-muted-foreground">
          {t("buyer.visits.noBusinesses")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>{t("buyer.visits.business")}</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger>
                <SelectValue placeholder={t("buyer.visits.selectBusiness")} />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {siteId && (
            <div className="rounded-xl border bg-card p-6">
              <VisitRegistrationForm
                siteId={siteId}
                mode="buyer"
                buyerName={buyerName || t("visits.yourAccount")}
                buyerEmail={buyerEmail}
                backUrl="/buyer"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
