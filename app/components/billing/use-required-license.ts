"use client"

import { useEffect, useState } from "react"
import type { Site } from "@/app/context/site-types"
import { siteMembersService } from "@/app/services/site-members-service"
import { LICENSE_PLANS, requiredLicensePlan, type LicensePlan } from "@/lib/license-entitlements"

/** Recommendations are presentation only; Stripe and SQL authorize the change. */
export function useRequiredLicense(site: Site | null) {
  const [resolved, setResolved] = useState<{ siteId: string; members: number } | null>(null)
  const siteId = site?.id
  const plan = site?.billing?.plan
  const preference = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("requiredPlan") : null
  const requested: LicensePlan | undefined = LICENSE_PLANS.find(candidate => candidate === preference)
  const members = resolved?.siteId === siteId ? resolved?.members ?? null : null

  useEffect(() => {
    let active = true
    if (siteId && !siteId.startsWith("demo-")) {
      void siteMembersService.getLicense(siteId).then(license => {
        if (active) setResolved({ siteId, members: license.total ?? license.current })
      }).catch(() => {
        // The team screen exposes availability errors; billing remains accessible.
      })
    }
    return () => { active = false }
  }, [siteId, plan])

  if (!site) return { requiredPlan: requested, members }
  if (members === null) return { requiredPlan: requested, members }
  const socialAccounts = (site.settings?.social_media ?? []).filter(account =>
    account.isActive === true || account.isActive === 1 || (account as unknown as Record<string, unknown>).license_suspended === true
  ).length
  const agentChannels = (site.settings?.channels?.connections ?? []).filter(channel =>
    channel.status === "connected" || (channel as unknown as Record<string, unknown>).license_suspended === true
  ).length
  const recommendation = requiredLicensePlan({ members, socialAccounts, agentChannels, addons: site.billing?.addons_count })
  const requiredPlan = requested && LICENSE_PLANS.indexOf(requested) > LICENSE_PLANS.indexOf(recommendation.plan)
    ? requested : recommendation.plan
  return { requiredPlan, members, missingConnectionAddons: recommendation.missingConnectionAddons }
}