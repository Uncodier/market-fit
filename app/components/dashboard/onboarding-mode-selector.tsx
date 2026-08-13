"use client"

import { Megaphone, Send, Bot } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { OnboardingTasksState } from "./hooks/use-onboarding-validation"
import {
  getLaunchTasks,
  isOnboardingMode,
  type OnboardingMode,
} from "./onboarding-tasks"

const MODES = [
  { id: "inbound" as const, i18nKey: "inbound", Icon: Megaphone },
  { id: "outbound" as const, i18nKey: "outbound", Icon: Send },
  { id: "ai_tasks" as const, i18nKey: "aiTasks", Icon: Bot },
]

interface OnboardingModeSelectorProps {
  selected: OnboardingMode | null
  onSelect: (mode: OnboardingMode) => void
  completedTasks?: OnboardingTasksState
}

export function OnboardingModeSelector({
  selected,
  onSelect,
  completedTasks = {} as OnboardingTasksState,
}: OnboardingModeSelectorProps) {
  const { t } = useLocalization()

  if (selected) {
    return (
      <Tabs
        value={selected}
        onValueChange={(value) => {
          if (isOnboardingMode(value)) onSelect(value)
        }}
        className="w-full"
      >
        <TabsList className="h-9 p-1 bg-muted/50 rounded-lg w-full grid grid-cols-3">
          {MODES.map((mode) => {
            const launchTasks = getLaunchTasks(mode.id)
            const completed = launchTasks.filter((task) => completedTasks[task.id]).length
            const total = launchTasks.length
            const Icon = mode.Icon
            return (
              <TabsTrigger
                key={mode.id}
                value={mode.id}
                className="text-xs rounded-md w-full flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm"
              >
                <Icon size={13} />
                <span className="tab-label">
                  {t(`dashboard.onboarding.mode.${mode.i18nKey}`)}
                </span>
                <span className="tab-badge text-muted-foreground tabular-nums">
                  {completed}/{total}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t("dashboard.onboarding.selector.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboard.onboarding.selector.subtitle")}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((mode) => {
          const launchTasks = getLaunchTasks(mode.id)
          const completed = launchTasks.filter((task) => completedTasks[task.id]).length
          const total = launchTasks.length
          const Icon = mode.Icon
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelect(mode.id)}
              className="flex flex-col items-start text-left rounded-xl border border-border/70 bg-card p-5 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground mb-4">
                <Icon size={18} />
              </div>
              <div className="text-sm font-semibold text-foreground">
                {t(`dashboard.onboarding.mode.${mode.i18nKey}`)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground leading-snug">
                {t(`dashboard.onboarding.mode.${mode.i18nKey}.tagline`)}
              </p>
              <p className="mt-4 text-xs tabular-nums text-muted-foreground">
                {t("dashboard.onboarding.progressDone", { completed, total })}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type { OnboardingMode }
