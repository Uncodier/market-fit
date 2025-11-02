"use client"

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { useRequestController } from "@/app/hooks/useRequestController"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { CheckCircle } from "@/app/components/ui/icons"

interface ApprovedContentsData {
  actual: number
  percentChange: number
  periodType: string
}

interface ApprovedContentsWidgetProps {
  segmentId: string
  startDate: Date
  endDate: Date
}

export function ApprovedContentsWidget({ segmentId, startDate, endDate }: ApprovedContentsWidgetProps) {
  const { user } = useAuth()
  const { site } = useSite()
  const { data, loading, error } = useRequestController<ApprovedContentsData>({
    url: "/api/performance/approved-contents",
    params: {
      siteId: site?.id,
      userId: user?.id,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      segmentId
    }
  })

  return (
    <BaseKpiWidget
      title="Contents Approved"
      value={data?.actual || 0}
      percentChange={data?.percentChange || 0}
      loading={loading}
      error={error}
      icon={<CheckCircle className="h-4 w-4" />}
      formatValue={(value) => Math.round(value).toLocaleString()}
    />
  )
}
