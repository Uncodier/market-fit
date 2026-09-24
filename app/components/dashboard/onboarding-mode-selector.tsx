"use client"

import { ArrowRight } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ModuleImage } from "@/app/components/navigation/ModuleImage"
import type { OnboardingTasksState } from "./hooks/use-onboarding-validation"
import {
  getLaunchTasks,
  isOnboardingMode,
  type OnboardingMode,
} from "./onboarding-tasks"

const MODES = [
  { id: "inbound", i18nKey: "inbound", area: "marketing", itemKey: "campaigns" },
  { id: "outbound", i18nKey: "outbound", area: "sales", itemKey: "leads" },
  { id: "ecommerce", i18nKey: "ecommerce", area: "sales", itemKey: "catalog" },
  { id: "automation", i18nKey: "automation", area: "automation", itemKey: "workflows" },
] as const

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
        <TabsList className="h-9 p-1 bg-muted/50 rounded-lg w-full grid grid-cols-4">
          {MODES.map((mode) => {
            const launchTasks = getLaunchTasks(mode.id)
            const completed = launchTasks.filter((task) => completedTasks[task.id]).length
            const total = launchTasks.length
            const title = t(`dashboard.onboarding.mode.${mode.i18nKey}`)
            return (
              <TabsTrigger
                key={mode.id}
                value={mode.id}
                className="text-xs rounded-md w-full flex items-center justify-center gap-1.5 data-[state=active]:shadow-sm"
              >
                <ModuleImage
                  area={mode.area}
                  itemKey={mode.itemKey}
                  title={title}
                  className="h-[18px] w-[18px] rounded-[5px] border border-black/10 dark:border-white/10"
                />
                <span className="tab-label">
                  {title}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODES.map((mode) => {
          const launchTasks = getLaunchTasks(mode.id)
          const completed = launchTasks.filter((task) => completedTasks[task.id]).length
          const total = launchTasks.length
          const title = t(`dashboard.onboarding.mode.${mode.i18nKey}`)
          const progress = total > 0 ? (completed / total) * 100 : 0
          
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelect(mode.id)}
              className="group relative flex flex-col items-start text-left rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-6 transition-all duration-300 hover:shadow-md hover:border-border hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden"
            >
              {/* Decorative background glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="flex w-full items-start justify-between mb-5">
                <ModuleImage
                  area={mode.area}
                  itemKey={mode.itemKey}
                  title={title}
                  className="h-12 w-12 rounded-xl border border-black/10 shadow-sm dark:border-white/10"
                  imageClassName="transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                  <ArrowRight size={16} />
                </div>
              </div>
              
              <div className="text-lg font-semibold text-foreground mb-1 tracking-tight">
                {title}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {t(`dashboard.onboarding.mode.${mode.i18nKey}.desc`)}
              </p>
              
              <div className="w-full mt-auto pt-4 border-t border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-foreground">
                    {t(`dashboard.onboarding.mode.${mode.i18nKey}.tagline`)}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {completed}/{total}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary/70 transition-all duration-500 ease-in-out group-hover:bg-primary rounded-full" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export type { OnboardingMode }
