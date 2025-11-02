"use client"

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { useRequestController } from "@/app/hooks/useRequestController"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { CheckSquare } from "@/app/components/ui/icons"

interface CompletedRequirementsData {
  actual: number
  percentChange: number
  periodType: string
}

interface CompletedRequirementsWidgetProps {
  segmentId: string
  startDate: Date
  endDate: Date
}

export function CompletedRequirementsWidget({ segmentId, startDate, endDate }: CompletedRequirementsWidgetProps) {
  const { user } = useAuth()
  const { site } = useSite()
  const { data, loading, error } = useRequestController<CompletedRequirementsData>({
    url: "/api/performance/completed-requirements",
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
      title="Requirements Completed"
      value={data?.actual || 0}
      percentChange={data?.percentChange || 0}
      loading={loading}
      error={error}
      icon={<CheckSquare className="h-4 w-4" />}
      formatValue={(value) => Math.round(value).toLocaleString()}
    />
  )
}
