"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Check, ChevronDown, ChevronUp, Clock } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { openOnboardingTaskHelp } from "./onboarding-help"
import type { OnboardingTaskDef } from "./onboarding-tasks"
import { formatOnboardingTime } from "./onboarding-tasks"
import type { OnboardingTaskId, OnboardingTasksState } from "./hooks/use-onboarding-validation"

interface OnboardingTaskListProps {
  title: string
  description?: string
  tasks: OnboardingTaskDef[]
  completed: OnboardingTasksState
  activeTaskId?: OnboardingTaskId | null
  defaultExpanded?: boolean
  flush?: boolean
  className?: string
  onContinue: (href: string) => void
  onToggle: (taskId: OnboardingTaskId, done: boolean) => void
}

export function OnboardingTaskList({
  title,
  description,
  tasks,
  completed,
  activeTaskId,
  defaultExpanded = true,
  flush = false,
  className,
  onContinue,
  onToggle,
}: OnboardingTaskListProps) {
  const { t } = useLocalization()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const doneCount = tasks.filter((task) => completed[task.id]).length

  return (
    <div
      className={cn(
        "overflow-hidden",
        flush ? null : "rounded-xl border border-border/70 bg-card",
        className
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{title}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {doneCount}/{tasks.length}
            </span>
          </div>
          {description && !expanded ? (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{description}</p>
          ) : null}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded ? (
        <ul className="border-t border-border/70">
          {tasks.map((task) => (
            <OnboardingTaskRow
              key={task.id}
              task={task}
              isDone={!!completed[task.id]}
              isActive={task.id === activeTaskId && !completed[task.id]}
              onContinue={() => onContinue(task.href)}
              onToggle={() => onToggle(task.id, !completed[task.id])}
              t={t}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function OnboardingTaskRow({
  task,
  isDone,
  isActive,
  onContinue,
  onToggle,
  t,
}: {
  task: OnboardingTaskDef
  isDone: boolean
  isActive: boolean
  onContinue: () => void
  onToggle: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const title = t(`dashboard.onboarding.task.${task.id}.title`)
  const description = t(`dashboard.onboarding.task.${task.id}.desc`)
  const why = t(`dashboard.onboarding.task.${task.id}.why`)
  const cta = t(`dashboard.onboarding.task.${task.id}.cta`)

  return (
    <li
      className={cn(
        "border-b border-border/70 last:border-b-0 px-5",
        isActive ? "bg-muted/30 py-5" : "py-3.5"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={title}
          onClick={onToggle}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            isDone
              ? "border-foreground bg-foreground text-background"
              : "border-muted-foreground/40 hover:border-foreground"
          )}
        >
          {isDone ? <Check className="h-3 w-3" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              className={cn(
                "text-sm leading-snug",
                isDone ? "text-muted-foreground line-through" : "font-medium text-foreground"
              )}
            >
              {title}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground pt-0.5">
              <Clock className="h-3 w-3" />
              {formatOnboardingTime(task.estimatedMinutes)}
            </span>
          </div>
          {isActive ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              {why && why !== `dashboard.onboarding.task.${task.id}.why` ? (
                <p className="text-sm text-foreground/80 leading-relaxed">{why}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={onContinue}>
                  {cta}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openOnboardingTaskHelp(title, description)}
                >
                  {t("dashboard.onboarding.cta.askAi")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}
