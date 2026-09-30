"use client"

import { useReportResource } from "@/app/hooks/use-report-resource"
import { distributionCurrency, distributionData, fetchReport, reportQueryKey, type ReportPeriod, type DistributionItem, type ReportRequestError } from "./report-query"

async function fetchDistribution(key: [string, string]) {
  const payload = await fetchReport(key)
  return { items: distributionData(payload), currency: distributionCurrency(payload) }
}

export function useDistributionReport({
  endpoint, userId, siteId, segmentId, period, enabled,
}: {
  endpoint: string
  userId?: string
  siteId?: string
  segmentId?: string
  period: ReportPeriod | null
  enabled: boolean
}) {
  const key = reportQueryKey({ endpoint, userId, siteId, segmentId, period, enabled })
  const result = useReportResource<{ items: DistributionItem[]; currency?: string }, ReportRequestError>(key, fetchDistribution)
  return { ...result, data: key ? result.data?.items : undefined, currency: key ? result.data?.currency : undefined }
}