"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { isRlsError } from "@/lib/permissions/error-map"
import { notifyPermissionDenied } from "@/lib/permissions/notify"
import { saveOnboardingProgress } from "../onboarding-progress"
import {
  ALL_TASK_IDS,
  type OnboardingTaskId,
  type OnboardingTasksState,
} from "@/app/lib/onboarding-task-ids"

export type { OnboardingTaskId, OnboardingTasksState }
export { ALL_TASK_IDS }

function reportSaveError(error: unknown) {
  if (isRlsError(error)) {
    // Also covers read failures; the notifier deduplicates write-guard errors.
    notifyPermissionDenied("update")
  } else {
    toast.error("Could not save onboarding progress. Please try again.")
  }
}

export function useOnboardingValidation() {
  const { currentSite } = useSite()
  const [tasks, setTasks] = useState<OnboardingTasksState>({} as OnboardingTasksState)
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [forceFullValidation, setForceFullValidation] = useState(true)
  const [skipNextValidation, setSkipNextValidation] = useState(false)
  const [isValidationRunning, setIsValidationRunning] = useState(false)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const isDemoMode = currentSite?.id?.startsWith('demo-') || false

  const loadTasks = useCallback(async () => {
    if (!currentSite?.id) {
      setTasks({} as OnboardingTasksState)
      setIsLoading(false)
      return
    }
    
    // In demo mode, all tasks are completed
    if (currentSite.id.startsWith('demo-')) {
      const demoCompleted = ALL_TASK_IDS.reduce((acc, id) => ({ ...acc, [id]: true }), {} as OnboardingTasksState)
      setTasks(demoCompleted)
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
        } else {
          localStorage.removeItem(`onboarding_completed_${currentSite.id}`)
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
    if (!currentSite?.id || isValidationRunning || skipNextValidation || isDemoMode) {
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
          .maybeSingle()
        if (error) throw error
        freshData = ((data?.onboarding || {}) as OnboardingTasksState)
      } catch {
        setIsValidating(false)
        setIsValidationRunning(false)
        return
      }

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

      // Automatically validate the tour if the user has completed it
      // Using site specific setting rather than user metadata since user might want
      // to review the tour for a new project, or we don't want to enforce global tracking strictly yet
      // await check("take_guided_tour", async () => {
      //   try {
      //     const { data: { user } } = await supabase.auth.getUser()
      //     return user?.user_metadata?.has_completed_tour === true
      //   } catch {
      //     return false
      //   }
      // }, true)

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

      await check("create_campaign", async () => {
        const { data } = await supabase.from("campaigns").select("id").eq("site_id", currentSite.id).limit(1)
        return !!data?.length
      }, true)

      await check("fine_tune_segments", async () => {
        const { data } = await supabase.from("segments").select("id").eq("site_id", currentSite.id).limit(1)
        return !!data?.length
      }, true)

      await check("invite_team", () => !!currentSite.settings?.team_members?.length)

      await check("setup_content", async () => {
        try {
          const r = await fetch(`/api/onboarding/check-files?siteId=${currentSite.id}`)
          return r.ok ? (await r.json()).hasFiles : false
        } catch { return false }
      }, true)

      await check("configure_store", async () => {
        const commerce = currentSite.settings?.commerce
        // Check if there are specific non-default commerce settings
        if (commerce && (commerce.stripe_account_id || commerce.currency !== 'USD' || (commerce.shipping_methods?.length ?? 0) > 0)) {
          return true
        }
        
        const { data } = await supabase.from("catalog_items").select("id").eq("site_id", currentSite.id).limit(1)
        return !!data?.length // Fallback: if they have items, they likely configured the store
      }, true)

      await check("add_catalog_items", async () => {
        const { data } = await supabase.from("catalog_items").select("id").eq("site_id", currentSite.id).limit(1)
        return !!data?.length
      }, true)

      await check("create_workflows", async () => {
        const { data } = await supabase.from("workflows").select("id").eq("site_id", currentSite.id).limit(1)
        return !!data?.length
      }, true)

      await check("setup_content_flows", async () => {
        // Checking if there are content requirements setup, can evolve as schemas get more complex
        const { data } = await supabase.from("requirements").select("id").eq("site_id", currentSite.id).limit(1)
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

      if (hasChanges) {
        try {
          const changes = Object.fromEntries(
            ALL_TASK_IDS.filter((id) => validated[id] && !freshData[id]).map((id) => [id, true])
          )
          await saveOnboardingProgress(currentSite.id, changes)
          await loadTasks()
        } catch (error) { reportSaveError(error) }
      }

      setIsValidating(false)
      setIsValidationRunning(false)
      setForceFullValidation(false)
    }, 1000)

    return () => { if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current) }
  }, [currentSite?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTasks = useCallback(async (changes: Partial<OnboardingTasksState>) => {
    setSkipNextValidation(true)
    if (!currentSite?.id || isDemoMode) return
    try {
      await saveOnboardingProgress(currentSite.id, changes)
      await loadTasks()
    } catch (error) { reportSaveError(error) }
  }, [currentSite?.id, isDemoMode, loadTasks])

  const toggleTask = useCallback(async (taskId: OnboardingTaskId, done: boolean) => {
    await saveTasks({ [taskId]: done })
  }, [saveTasks])

  const markAllDone = useCallback(async (taskIds: OnboardingTaskId[]) => {
    await saveTasks(Object.fromEntries(taskIds.map((id) => [id, true])))
  }, [saveTasks])

  return { tasks, isLoading, isValidating, toggleTask, markAllDone, loadTasks }
}
