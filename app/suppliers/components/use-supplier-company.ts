"use client"

import { useEffect, useState } from "react"
import type { Company } from "@/app/companies/types"
import { isDemoSiteId } from "@/lib/demo-utils"
import { demoProcurementReferences } from "@/lib/demo-data/procurement-suppliers"
import { supplierResponse } from "./client"

export function useSupplierCompany(siteId: string, supplierId: string, companyId?: string | null, version = 0) {
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState<{ key: string; company: Company | null; error?: string } | null>(null)
  const key = JSON.stringify([siteId, supplierId, companyId, version, revision])
  const demo = isDemoSiteId(siteId)
  const active = Boolean(companyId && supplierId !== "new")
  const result = loaded?.key === key ? loaded : null
  useEffect(() => {
    if (!active || demo) return
    const controller = new AbortController()
    void fetch(`/api/procurement/suppliers/${supplierId}/company?site_id=${siteId}`, { signal: controller.signal, cache: "no-store" })
      .then(response => supplierResponse<{ company: Company | null }>(response))
      .then(response => {
        if (controller.signal.aborted) return
        if (response.company && response.company.id !== companyId) {
          setLoaded({ key, company: null, error: "The linked company changed. Reload the supplier." })
        } else setLoaded({ key, company: response.company })
      }).catch(() => {
        if (!controller.signal.aborted) setLoaded({ key, company: null, error: "Unable to load linked company details. Please retry." })
      })
    return () => controller.abort()
  }, [active, demo, siteId, supplierId, companyId, key])
  const reference = demoProcurementReferences.companies.find(company => company.id === companyId)
  // The procurement demo only provides a company name. Do not invent a profile.
  const demoCompany: Company | null = reference ? { id: reference.id, name: reference.label, created_at: "", updated_at: "" } : null
  return {
    company: !active ? null : demo ? demoCompany : result?.company || null,
    loading: active && !demo && !result,
    error: result?.error,
    retry: () => setRevision(value => value + 1),
  }
}