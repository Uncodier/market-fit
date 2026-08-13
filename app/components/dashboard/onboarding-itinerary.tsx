"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Progress } from "@/app/components/ui/progress"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useOnboardingValidation } from "./hooks/use-onboarding-validation"
import { OnboardingModeSelector } from "./onboarding-mode-selector"
import { OnboardingTaskList } from "./onboarding-task-list"
import { OnboardingCompleteCard } from "./onboarding-complete"
import {
  formatOnboardingTime,
  getLaunchTasks,
  getLaterTasks,
  getScopedTasks,
  isOnboardingMode,
  onboardingModeStorageKey,
  type OnboardingMode,
} from "./onboarding-tasks"

const HELP_CALENDLY_URL = "https://www.calendly.com/sergio-prado"

interface OnboardingItineraryProps {
  userName?: string
}

export function OnboardingItinerary({ userName }: OnboardingItineraryProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()
  const { tasks: onboardingTasks, isLoading, toggleTask, markAllDone } =
    useOnboardingValidation()

  const [selectedMode, setSelectedMode] = useState<OnboardingMode | null>(null)
  const [modeReady, setModeReady] = useState(false)

  useEffect(() => {
    if (!currentSite?.id) {
      setSelectedMode(null)
      setModeReady(true)
      return
    }
    try {
      const stored = localStorage.getItem(onboardingModeStorageKey(currentSite.id))
      setSelectedMode(isOnboardingMode(stored) ? stored : null)
    } catch {
      setSelectedMode(null)
    }
    setModeReady(true)
  }, [currentSite?.id])

  const persistMode = useCallback(
    (mode: OnboardingMode | null) => {
      setSelectedMode(mode)
      if (!currentSite?.id) return
      const key = onboardingModeStorageKey(currentSite.id)
      try {
        if (mode) localStorage.setItem(key, mode)
        else localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
    [currentSite?.id]
  )

  const launchTasks = useMemo(
    () => (selectedMode ? getLaunchTasks(selectedMode) : []),
    [selectedMode]
  )
  const laterTasks = useMemo(
    () => (selectedMode ? getLaterTasks(selectedMode) : []),
    [selectedMode]
  )
  const scopedTasks = useMemo(
    () => (selectedMode ? getScopedTasks(selectedMode) : []),
    [selectedMode]
  )

  const completedCount = scopedTasks.filter((task) => onboardingTasks[task.id]).length
  const total = scopedTasks.length
  const totalTime = scopedTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)
  const completedTime = scopedTasks.reduce(
    (sum, task) => sum + (onboardingTasks[task.id] ? task.estimatedMinutes : 0),
    0
  )
  const remaining = Math.max(totalTime - completedTime, 0)
  const percent = totalTime > 0 ? Math.round((completedTime / totalTime) * 100) : 0
  const launchDone =
    launchTasks.length > 0 && launchTasks.every((task) => onboardingTasks[task.id])
  const allScopedDone = total > 0 && completedCount === total
  const activeTask =
    launchTasks.find((task) => !onboardingTasks[task.id]) ??
    laterTasks.find((task) => !onboardingTasks[task.id])

  const modeLabel = selectedMode
    ? t(`dashboard.onboarding.mode.${selectedMode === "ai_tasks" ? "aiTasks" : selectedMode}`)
    : null

  const goToTask = useCallback(
    (href: string) => {
      router.push(href)
    },
    [router]
  )

  if (isLoading || !modeReady) {
    return <OnboardingSkeleton showCards={!selectedMode} />
  }

  return (
    <div className="space-y-6 w-full pb-10">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("dashboard.onboarding.hero.title")}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("dashboard.onboarding.hero.greeting", { name: userName || "there" })}{" "}
              {selectedMode
                ? t("dashboard.onboarding.hero.subtitleMode", { mode: modeLabel || "" })
                : t("dashboard.onboarding.hero.subtitleAll")}
            </p>
          </div>
          {selectedMode && activeTask ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => markAllDone(scopedTasks.map((task) => task.id))}
            >
              {t("dashboard.onboarding.cta.skipRemaining")}
            </Button>
          ) : null}
        </div>

        {selectedMode && total > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {t("dashboard.onboarding.progressCount", {
                  completed: completedCount,
                  total,
                })}
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                {t("dashboard.onboarding.timeLeft", {
                  time: formatOnboardingTime(remaining),
                })}
              </span>
              <button
                type="button"
                className="hover:text-foreground transition-colors"
                onClick={() => window.open(HELP_CALENDLY_URL, "_blank")}
              >
                {t("dashboard.onboarding.cta.getAssistance")}
              </button>
            </div>
            <Progress value={percent} className="h-1" />
          </div>
        ) : null}

        {!selectedMode ? (
          <OnboardingModeSelector
            selected={selectedMode}
            onSelect={persistMode}
            completedTasks={onboardingTasks}
          />
        ) : null}
      </div>

      {selectedMode && launchDone ? (
        <OnboardingCompleteCard
          modeLabel={modeLabel}
          allDone={allScopedDone}
          onGoToDashboard={() => router.push("/dashboard")}
        />
      ) : null}

      {selectedMode ? (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
          <div className="border-b border-border/70 p-2">
            <OnboardingModeSelector
              selected={selectedMode}
              onSelect={persistMode}
              completedTasks={onboardingTasks}
            />
          </div>
          <OnboardingTaskList
            title={t("dashboard.onboarding.section.launch")}
            tasks={launchTasks}
            completed={onboardingTasks}
            activeTaskId={activeTask?.id}
            defaultExpanded
            flush
            onContinue={goToTask}
            onToggle={toggleTask}
          />
          <OnboardingTaskList
            title={t("dashboard.onboarding.section.later")}
            description={t("dashboard.onboarding.section.later.desc")}
            tasks={laterTasks}
            completed={onboardingTasks}
            activeTaskId={launchDone ? activeTask?.id : null}
            defaultExpanded={false}
            flush
            className="border-t border-border/70"
            onContinue={goToTask}
            onToggle={toggleTask}
          />
        </div>
      ) : null}
    </div>
  )
}

function OnboardingSkeleton({ showCards }: { showCards: boolean }) {
  return (
    <div className="space-y-8 w-full pb-10">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>
      {showCards ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/70 p-5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <Skeleton className="h-9 w-72 rounded-full" />
      )}
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

export default OnboardingItinerary
