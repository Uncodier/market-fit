"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { getSegments } from "@/app/segments/actions"
import { createClient } from "@/lib/supabase/client"

export type OnboardingTaskId =
  | "configure_channels"
  | "install_tracking_script"
  | "set_business_hours"
  | "setup_branding"
  | "setup_billing"
  | "validate_geographic_restrictions"
  | "fine_tune_segments"
  | "create_campaign"
  | "setup_content"
  | "configure_agents"
  | "complete_requirement"
  | "publish_and_feedback"
  | "personalize_customer_journey"
  | "assign_attribution_link"
  | "import_leads"
  | "pay_first_campaign"
  | "invite_team"
  | "create_coordination_task"

export const ALL_TASK_IDS: OnboardingTaskId[] = [
  "configure_channels", "install_tracking_script", "set_business_hours",
  "setup_branding", "setup_billing", "validate_geographic_restrictions",
  "fine_tune_segments", "create_campaign", "setup_content", "configure_agents",
  "complete_requirement", "publish_and_feedback", "personalize_customer_journey",
  "assign_attribution_link", "import_leads", "pay_first_campaign", "invite_team",
  "create_coordination_task"
]

export type OnboardingTasksState = Record<OnboardingTaskId, boolean>

export function useOnboardingValidation() {
  const { currentSite } = useSite()
  const [tasks, setTasks] = useState<OnboardingTasksState>({} as OnboardingTasksState)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [forceFullValidation, setForceFullValidation] = useState(true)
  const [skipNextValidation, setSkipNextValidation] = useState(false)
  const [isValidationRunning, setIsValidationRunning] = useState(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const loadTasks = useCallback(async () => {
    if (!currentSite?.id) {
      setTasks({} as OnboardingTasksState)
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("settings")
        .select("onboarding")
        .eq("site_id", currentSite.id)
        .single()
      if (error && error.code !== "PGRST116") {
        setTasks({} as OnboardingTasksState)
      } else {
        const loaded = (data?.onboarding || {}) as OnboardingTasksState
        setTasks(loaded)
        const allCompleted = ALL_TASK_IDS.every((id) => loaded[id] === true)
        if (allCompleted) {
          localStorage.setItem(`onboarding_completed_${currentSite.id}`, "true")
        }
      }
    } catch {
      setTasks({} as OnboardingTasksState)
    } finally {
      setIsLoading(false)
    }
  }, [currentSite?.id])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Reset on site change
  useEffect(() => {
    if (currentSite?.id) {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
      setIsValidating(false)
      setForceFullValidation(true)
    }
  }, [currentSite?.id])

  // Auto-validation
  useEffect(() => {
    if (!currentSite?.id || isValidationRunning || skipNextValidation) {
      if (skipNextValidation) setSkipNextValidation(false)
      return
    }
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)

    updateTimeoutRef.current = setTimeout(async () => {
      setIsValidationRunning(true)
      setIsValidating(true)
      const supabase = createClient()

      let freshData: OnboardingTasksState = {} as OnboardingTasksState
      try {
        const { data, error } = await supabase
          .from("settings")
          .select("onboarding")
          .eq("site_id", currentSite.id)
          .single()
        if (!error || error.code === "PGRST116") {
          freshData = ((data?.onboarding || {}) as OnboardingTasksState)
        }
      } catch { /* ignore */ }

      const validated: OnboardingTasksState = { ...freshData }
      let hasChanges = false

      const shouldSkip = (id: OnboardingTaskId) => validated[id] === true && !forceFullValidation

      const check = async (
        id: OnboardingTaskId,
        fn: () => Promise<boolean> | boolean,
        skipExpensive = false
      ) => {
        try {
          if (skipExpensive && shouldSkip(id)) return
          if (validated[id] === true) return
          const result = await fn()
          if (result) { validated[id] = true; hasChanges = true }
        } catch { /* ignore */ }
      }

      await check("install_tracking_script", async () => {
        const hasCode = currentSite.tracking?.tracking_code
        let hasSessions = false
        try {
          const r = await fetch(`/api/onboarding/check-sessions?siteId=${currentSite.id}`)
          if (r.ok) hasSessions = (await r.json()).hasSessions
        } catch { /* ignore */ }
        return !!(hasCode || hasSessions)
      }, true)

      await check("configure_channels", () => {
        const ch = currentSite.settings?.channels
        return !!(
          (ch?.email?.enabled && ch.email.status === "synced") ||
          (ch?.whatsapp?.enabled && ch.whatsapp.status === "active")
        )
      })

      await check("set_business_hours", () => {
        const bh = currentSite.settings?.business_hours
        return !!(bh && Array.isArray(bh) && bh.length > 0)
      })

      await check("setup_branding", () => {
        const b = currentSite.settings?.branding
        return !!(b?.primary_color && b?.brand_essence)
      })

      await check("setup_billing", async () => {
        try {
          const r = await fetch(`/api/onboarding/check-billing?siteId=${currentSite.id}`)
          return r.ok ? (await r.json()).hasBillingSetup : false
        } catch { return false }
      }, true)

      await check("pay_first_campaign", async () => {
        try {
          const r = await fetch(`/api/onboarding/check-credits?siteId=${currentSite.id}`)
          return r.ok ? (await r.json()).hasCredits : false
        } catch { return false }
      }, true)

      await check("configure_agents", async () => {
        const { data } = await supabase.from("agents").select("id").eq("site_id", currentSite.id).limit(1)
        return !!data?.length
      }, true)

      await check("create_campaign", async () => {
        const r = await getCampaigns(currentSite.id)
        return !!r.data?.length
      })

      await check("fine_tune_segments", async () => {
        const r = await getSegments(currentSite.id)
        return !!r.segments?.length
      })

      await check("invite_team", () => !!currentSite.settings?.team_members?.length)

      await check("setup_content", async () => {
        try {
          const r = await fetch(`/api/onboarding/check-files?siteId=${currentSite.id}`)
          return r.ok ? (await r.json()).hasFiles : false
        } catch { return false }
      }, true)

      await check("complete_requirement", async () => {
        const { data } = await supabase.from("requirements").select("id").eq("site_id", currentSite.id).eq("completion_status", "completed").limit(1)
        return !!data?.length
      }, true)

      await check("publish_and_feedback", async () => {
        const { data } = await supabase.from("content").select("id").eq("site_id", currentSite.id).eq("status", "published").gte("performance_rating", 1).limit(1)
        return !!data?.length
      }, true)

      await check("assign_attribution_link", async () => {
        try {
          const r = await fetch(`/api/onboarding/check-attribution?siteId=${currentSite.id}`)
          return r.ok ? (await r.json()).hasAttribution : false
        } catch { return false }
      }, true)

      await check("personalize_customer_journey", () => {
        const cj = currentSite.settings?.customer_journey
        if (!cj) return false
        const stages = ["awareness", "consideration", "decision", "purchase", "retention", "referral"]
        return stages.some((stage) => {
          const s = cj[stage as keyof typeof cj]
          if (!s) return false
          return ["metrics", "actions", "tactics"].some((f) => {
            const v = s[f as keyof typeof s]
            return Array.isArray(v) && v.length > 0
          })
        })
      })

      if (hasChanges || Object.keys(validated).length > 0) {
        try {
          const { data: existing } = await supabase.from("settings").select("*").eq("site_id", currentSite.id).single()
          await supabase.from("settings").upsert(
            { ...existing, site_id: currentSite.id, onboarding: validated },
            { onConflict: "site_id", ignoreDuplicates: false }
          )
          await loadTasks()
        } catch { /* ignore */ }
      }

      setIsValidating(false)
      setIsValidationRunning(false)
      setForceFullValidation(false)
    }, 1000)

    return () => { if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current) }
  }, [currentSite?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTask = useCallback(async (taskId: OnboardingTaskId, done: boolean) => {
    setSkipNextValidation(true)
    if (!currentSite?.id) return
    try {
      const supabase = createClient()
      const { data: existing } = await supabase.from("settings").select("*").eq("site_id", currentSite.id).single()
      const updated = { ...(existing?.onboarding || {}), [taskId]: done }
      await supabase.from("settings").upsert(
        { ...existing, site_id: currentSite.id, onboarding: updated },
        { onConflict: "site_id", ignoreDuplicates: false }
      )
      await loadTasks()
    } catch { /* ignore */ }
  }, [currentSite?.id, loadTasks])

  const markAllDone = useCallback(async (taskIds: OnboardingTaskId[]) => {
    setSkipNextValidation(true)
    if (!currentSite?.id) return
    try {
      const supabase = createClient()
      const { data: existing } = await supabase.from("settings").select("*").eq("site_id", currentSite.id).single()
      const allDone = taskIds.reduce((acc, id) => ({ ...acc, [id]: true }), existing?.onboarding || {})
      await supabase.from("settings").upsert(
        { ...existing, site_id: currentSite.id, onboarding: allDone },
        { onConflict: "site_id", ignoreDuplicates: false }
      )
      await loadTasks()
    } catch { /* ignore */ }
  }, [currentSite?.id, loadTasks])

  return { tasks, isLoading, isValidating, toggleTask, markAllDone, loadTasks }
}
