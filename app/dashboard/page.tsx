"use client"

import dynamic from "next/dynamic"
import { useAuth } from "@/app/hooks/use-auth"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import useSWR from "swr"
import { useRouter, useSearchParams } from "next/navigation"
import { getSegments } from "@/app/segments/actions"
import { useSite } from "@/app/context/SiteContext"
import { format, subMonths } from "date-fns"
import { useProfile } from "@/app/hooks/use-profile"
import { usePageRefreshPrevention } from "@/app/hooks/use-prevent-refresh"
import { DashboardFilters } from "./DashboardFilters"
import { DashboardPerformanceTab } from "./DashboardPerformanceTab"
import { DashboardOverviewTab } from "./DashboardOverviewTab"
import { DashboardAnalyticsTab } from "./DashboardAnalyticsTab"
import { determineRangeType, validateDates, formatRangeLabel } from "./dashboard-dates"

const CostReports = dynamic(
  () => import("@/app/components/dashboard/cost-reports").then((m) => m.CostReports),
  { ssr: false }
)
const SalesReports = dynamic(
  () => import("@/app/components/dashboard/sales-reports").then((m) => m.SalesReports),
  { ssr: false }
)
const TrafficReports = dynamic(
  () => import("@/app/components/dashboard/traffic-reports").then((m) => m.TrafficReports),
  { ssr: false }
)
const SocialReports = dynamic(
  () => import("@/app/components/dashboard/social-reports").then((m) => m.SocialReports),
  { ssr: false }
)

const VALID_TABS = ["performance", "overview", "analytics", "traffic", "costs", "sales", "social"] as const

function DashboardPageContent() {
  const { t } = useLocalization()
  const { user } = useAuth()
  const { currentSite } = useSite()
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"
  const [selectedSegment, setSelectedSegment] = useState("all")
  const { data: segments = [], isLoading: isLoadingSegments } = useSWR(
    currentSite && currentSite.id !== "default" ? ["segments", currentSite.id] : null,
    async ([, siteId]) => {
      const result = await getSegments(siteId)
      if (result.error) throw new Error(result.error)
      return result.segments || []
    }
  )
  const searchParams = useSearchParams()
  const tabFromUrlRef = useRef<string | null>(null)
  const { shouldPreventRefresh } = usePageRefreshPrevention()
  const [navigationBlocked, setNavigationBlocked] = useState(false)
  const today = new Date()
  const [selectedRangeType, setSelectedRangeType] = useState("This month")
  const [dateRange, setDateRange] = useState({ startDate: subMonths(today, 1), endDate: today })
  const [formattedTotal, setFormattedTotal] = useState("")
  useProfile()
  const [showConversations, setShowConversations] = useState(false)
  const [activeTab, setActiveTab] = useState("performance")
  const router = useRouter()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const urlTab = searchParams.get("tab")
    if (urlTab === "onboarding") {
      router.replace("/onboarding")
      return
    }
    if (urlTab && !VALID_TABS.includes(urlTab as (typeof VALID_TABS)[number])) {
      router.replace("/dashboard")
      return
    }
    const next = urlTab && VALID_TABS.includes(urlTab as (typeof VALID_TABS)[number]) ? urlTab : "performance"
    if (tabFromUrlRef.current !== next) {
      if (tabFromUrlRef.current !== null) {
        setFormattedTotal("")
        window.dispatchEvent(new CustomEvent("dashboard:tabchange", { detail: { activeTab: next } }))
      }
      tabFromUrlRef.current = next
      setActiveTab(next)
    }
  }, [searchParams, router])

  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    const validated = validateDates(startDate, endDate)
    setDateRange(validated)
    setSelectedRangeType(determineRangeType(validated.startDate, validated.endDate))
  }, [])

  useEffect(() => {
    if (isInitialized) return
    const validated = validateDates(subMonths(new Date(), 1), new Date())
    setDateRange(validated)
    setSelectedRangeType(determineRangeType(validated.startDate, validated.endDate))
    setIsInitialized(true)
  }, [isInitialized])

  useEffect(() => {
    if (!currentSite?.id) return
    setSelectedSegment("all")
    setFormattedTotal("")
  }, [currentSite?.id])

  useEffect(() => {
    setNavigationBlocked(Boolean(shouldPreventRefresh))
  }, [shouldPreventRefresh])

  const rangeTypeLabel = formatRangeLabel(selectedRangeType, t)

  return (
    <div className="flex-1 min-w-0 w-full p-0 min-h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col">
      {navigationBlocked && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-sm text-yellow-700">
            {t("dashboard.navigationBlocked") ||
              "Navigation is temporarily blocked to protect your work. Please wait for the current operation to complete."}
          </p>
        </div>
      )}

      <DashboardFilters
        t={t}
        selectedSegment={selectedSegment}
        onSegmentChange={setSelectedSegment}
        isLoadingSegments={isLoadingSegments}
        segments={segments}
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />

      <div className="p-8 space-y-4 bg-muted/30 flex-1">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {(t("dashboard.greeting") || "Hi, {userName}! 👋").replace("{userName}", userName)}
          </h2>
          <p className="text-muted-foreground">
            {(t("dashboard.subtitle") ||
              "Welcome to your control panel - Viewing {rangeType} data ({startDate} to {endDate} {year})")
              .replace("{rangeType}", rangeTypeLabel)
              .replace("{startDate}", format(dateRange.startDate, "MMMM d"))
              .replace("{endDate}", format(dateRange.endDate, "MMMM d"))
              .replace("{year}", format(dateRange.endDate, "yyyy"))}
          </p>
        </div>

        <div className="space-y-4">
          {activeTab === "performance" && (
            <DashboardPerformanceTab
              t={t}
              segmentId={selectedSegment}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              showConversations={showConversations}
              onShowConversationsChange={setShowConversations}
            />
          )}
          {activeTab === "overview" && (
            <DashboardOverviewTab
              t={t}
              segmentId={selectedSegment}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
            />
          )}
          {activeTab === "analytics" && (
            <DashboardAnalyticsTab
              t={t}
              segmentId={selectedSegment}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              formattedTotal={formattedTotal}
              onTotalUpdate={setFormattedTotal}
            />
          )}
          {activeTab === "traffic" && currentSite && (
            <TrafficReports
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              segmentId={selectedSegment}
              siteId={currentSite.id}
            />
          )}
          {activeTab === "costs" && (
            <CostReports
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              segmentId={selectedSegment}
            />
          )}
          {activeTab === "sales" && (
            <SalesReports
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              segmentId={selectedSegment}
            />
          )}
          {activeTab === "social" && (
            <SocialReports
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              segmentId={selectedSegment}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  )
}
