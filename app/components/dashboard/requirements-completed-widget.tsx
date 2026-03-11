"use client"

import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useEffect, useState } from "react"

interface RequirementsCompletedData {
  actual: number
  percentChange: number
  periodType: string
}

export function RequirementsCompletedWidget({ 
  segmentId, 
  startDate, 
  endDate 
}: { 
  segmentId: string
  startDate: Date
  endDate: Date 
}) {
  const { t } = useLocalization()
  const { user } = useAuth()
  const { currentSite } = useSite()
  const [data, setData] = useState<RequirementsCompletedData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !currentSite) return

      setIsLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          siteId: currentSite.id,
          userId: user.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          segmentId: segmentId || "all"
        })

        const response = await fetch(`/api/performance/requirements-completed?${params}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        console.error("Error fetching requirements completed data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch requirements completed data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, currentSite, segmentId, startDate, endDate])

  const formatPeriodType = (periodType: string) => {
    switch (periodType) {
      case "daily": return t('dashboard.widgets.revenue.yesterday') || 'yesterday';
      case "weekly": return t('dashboard.widgets.revenue.lastWeek') || 'last week';
      case "monthly": return t('dashboard.widgets.revenue.lastMonth') || 'last month';
      case "quarterly": return t('dashboard.widgets.revenue.lastQuarter') || 'last quarter';
      case "yearly": return t('dashboard.widgets.revenue.lastYear') || 'last year';
      default: return t('dashboard.widgets.revenue.previousPeriod') || 'last period';
    }
  };

  const changeText = error 
    ? (t('dashboard.widgets.errorLoading') || 'Error loading data')
    : `${data?.percentChange || 0}% from ${formatPeriodType(data?.periodType || "monthly")}`;

  return (
    <BaseKpiWidget
      title={t('dashboard.widgets.requirementsCompleted') || 'Requirements Completed'}
      value={data?.actual || 0}
      changeText={changeText}
      isPositiveChange={(data?.percentChange || 0) > 0}
      isLoading={isLoading}
      customStatus={error ? (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      ) : undefined}
    />
  )
}
