"use client"

import { Megaphone, Send, Bot, ArrowRight, CheckCircle2 } from "@/app/components/ui/icons"

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
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          What do you want to set up first?
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select your primary goal to see the relevant setup steps.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((mode) => {
          const isActive = selected === mode.id
          const completed = completedByMode[mode.id] ?? 0
          const total = totalByMode[mode.id] ?? mode.tasks.length
          const allDone = total > 0 && completed === total

          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className={`
                relative text-left rounded-xl border-2 p-4 transition-all duration-200
                hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                ${isActive
                  ? `${mode.activeBorder} ${mode.bg} shadow-md -translate-y-0.5`
                  : `border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/40 hover:${mode.bg}`
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <span className={`absolute top-3 right-3 h-2 w-2 rounded-full ${mode.activeBg}`} />
              )}

              {/* Icon */}
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg mb-3 ${isActive ? "bg-white/50 dark:bg-white/10" : "bg-gray-100 dark:bg-gray-800"}`}>
                <span className={isActive ? mode.color : "text-gray-500 dark:text-gray-400"}>
                  {mode.icon}
                </span>
              </div>

              {/* Label + tagline */}
              <div className="mb-2">
                <div className={`font-semibold text-sm ${isActive ? mode.color : "text-gray-800 dark:text-gray-200"}`}>
                  {mode.label}
                </div>
                <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                  {mode.tagline}
                </div>
              </div>

              {/* Task list */}
              <ul className="space-y-1 mb-3">
                {mode.tasks.map((task) => (
                  <li key={task} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight size={10} className="flex-shrink-0 opacity-60" />
                    {task}
                  </li>
                ))}
              </ul>

              {/* Progress pill */}
              {total > 0 && (
                <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${allDone ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : isActive ? `${mode.bg} ${mode.color}` : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                  {allDone ? (
                    <>
                      <CheckCircle2 size={10} />
                      Complete
                    </>
                  ) : (
                    `${completed}/${total} done`
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
