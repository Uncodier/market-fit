"use client"

import { Megaphone, Send, Bot, ArrowRight, CheckCircle2 } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export type OnboardingMode = "inbound" | "outbound" | "ai_tasks"

interface ModeOption {
  id: OnboardingMode
  label: string
  tagline: string
  description: string
  tasks: string[]
  icon: React.ReactNode
  color: string
  bg: string
  border: string
  activeBg: string
  activeBorder: string
}

const MODES: ModeOption[] = [
  {
    id: "inbound",
    label: "Inbound",
    tagline: "Capture & convert visitors",
    description: "Set up your website widget, WhatsApp, and launch campaigns to attract and convert inbound leads.",
    tasks: ["Create campaign", "Install widget & configure WhatsApp", "Configure provider"],
    icon: <Megaphone size={24} />,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-100 dark:border-blue-900/50",
    activeBg: "bg-blue-600",
    activeBorder: "border-blue-600",
  },
  {
    id: "outbound",
    label: "Outbound",
    tagline: "Reach & engage prospects",
    description: "Build segments, import contact lists, and configure your email provider to run outbound campaigns.",
    tasks: ["Create segments", "Create people lists", "Configure email provider"],
    icon: <Send size={24} />,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-100 dark:border-violet-900/50",
    activeBg: "bg-violet-600",
    activeBorder: "border-violet-600",
  },
  {
    id: "ai_tasks",
    label: "AI Tasks",
    tagline: "Automate with AI agents",
    description: "Configure AI agents (Makinas) to automate repetitive tasks, qualify leads, and run intelligent workflows.",
    tasks: ["Configure AI agents", "Create coordination tasks", "Publish & give feedback"],
    icon: <Bot size={24} />,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-100 dark:border-emerald-900/50",
    activeBg: "bg-emerald-600",
    activeBorder: "border-emerald-600",
  },
]

interface OnboardingModeSelectorProps {
  selected: OnboardingMode | null
  onSelect: (mode: OnboardingMode) => void
  completedByMode?: Partial<Record<OnboardingMode, number>>
  totalByMode?: Partial<Record<OnboardingMode, number>>
}

export function OnboardingModeSelector({
  selected,
  onSelect,
  completedByMode = {},
  totalByMode = {},
}: OnboardingModeSelectorProps) {
  const { t } = useLocalization()
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('dashboard.onboarding.selector.title') || 'What do you want to set up first?'}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('dashboard.onboarding.selector.subtitle') || 'Select your primary goal to see the relevant setup steps.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MODES.map((mode) => {
          const isActive = selected === mode.id
          const completed = completedByMode[mode.id] ?? 0
          const total = totalByMode[mode.id] ?? mode.tasks.length
          const allDone = total > 0 && completed === total
          const label = t(`dashboard.onboarding.mode.${mode.id === 'ai_tasks' ? 'aiTasks' : mode.id}`) || mode.label
          const tagline = t(`dashboard.onboarding.mode.${mode.id === 'ai_tasks' ? 'aiTasks' : mode.id}.tagline`) || mode.tagline

          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className={`
                relative flex flex-col items-start text-left rounded-xl border-2 p-5 transition-all duration-200 h-full w-full
                hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset
                ${isActive
                  ? `${mode.activeBorder} ${mode.bg} shadow-md -translate-y-0.5`
                  : `border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 hover:${mode.bg}`
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <span className={`absolute top-4 right-4 h-2 w-2 rounded-full font-inter ${mode.activeBg}`} />
              )}

              {/* Header: Icon + Label + Progress Pill */}
              <div className="flex items-center justify-between w-full mb-2 pr-2">
                <div className="flex items-center gap-3.5">
                  <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg flex-shrink-0 ${isActive ? "bg-white/50 dark:bg-white/10" : "bg-gray-100 dark:bg-gray-800"}`}>
                    <span className={isActive ? mode.color : "text-gray-500 dark:text-gray-400"}>
                      {mode.icon}
                    </span>
                  </div>
                  <div className={`font-semibold text-base ${isActive ? mode.color : "text-gray-900 dark:text-gray-100"}`}>
                    {mode.label}
                  </div>
                </div>

                {/* Progress pill */}
                {total > 0 && (
                  <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full font-inter ${allDone ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : isActive ? `${mode.bg} ${mode.color}` : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {allDone ? (
                      <>
                        <CheckCircle2 size={12} />
                        {t('dashboard.onboarding.badge.complete') || 'Complete'}
                      </>
                    ) : (
                      (t('dashboard.onboarding.progressDone') || '{completed}/{total} done').replace('{completed}', String(completed)).replace('{total}', String(total))
                    )}
                  </div>
                )}
              </div>

              {/* Tagline */}
              <div className="mb-4 flex-shrink-0 w-full pl-[54px] pr-2">
                <div className="text-sm text-muted-foreground leading-snug">
                  {mode.tagline}
                </div>
              </div>

              {/* Task list */}
              <ul className="space-y-2.5 mb-2 flex-grow w-full pl-[54px]">
                {mode.tasks.map((task, index) => {
                  const isTaskDone = index < completed;
                  return (
                    <li key={task} className={`flex items-start gap-2.5 text-sm ${isTaskDone ? 'text-gray-400 dark:text-gray-500' : 'text-muted-foreground'}`}>
                      {isTaskDone ? (
                        <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      ) : (
                        <ArrowRight size={14} className="flex-shrink-0 opacity-60 mt-0.5" />
                      )}
                      <span className={`leading-tight ${isTaskDone ? 'line-through' : ''}`}>{task}</span>
                    </li>
                  );
                })}
              </ul>
            </button>
          )
        })}
      </div>
    </div>
  )
}
