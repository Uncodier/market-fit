import React from 'react'
import { CheckCircle } from "@/app/components/ui/icons"
import { InstancePlan, PlanStep } from '../types'
import { useTheme } from "@/app/context/ThemeContext"

interface CompletedPlanCardProps {
  plan: InstancePlan
}

export const CompletedPlanCard: React.FC<CompletedPlanCardProps> = ({ plan }) => {
  const { isDarkMode } = useTheme()
  const isCompleted = plan.status === 'completed'
  const isFailed = plan.status === 'failed'
  const isCancelled = plan.status === 'cancelled'
  const isPending = plan.status === 'pending'
  const isInProgress = plan.status === 'in_progress'
  const isBlocked = plan.status === 'blocked'
  const isPaused = plan.status === 'paused'

  const baseClasses = isCompleted
    ? {
        container: isDarkMode
          ? 'bg-indigo-950/25 border-indigo-600/35'
          : 'bg-indigo-50/90 border-indigo-200/70',
        labelWrap: isDarkMode
          ? 'text-indigo-200 bg-indigo-900/45'
          : 'text-indigo-800 bg-indigo-100',
        title: isDarkMode ? 'text-indigo-100' : 'text-indigo-950',
        text: isDarkMode ? 'text-indigo-200/90' : 'text-indigo-900/85',
        meta: isDarkMode ? 'text-indigo-300/90' : 'text-indigo-800/80',
        label: 'Plan completed',
      }
    : isFailed
      ? {
          container: isDarkMode
            ? 'bg-amber-950/20 border-amber-700/35'
            : 'bg-amber-50/90 border-amber-200/80',
          labelWrap: isDarkMode
            ? 'text-amber-200 bg-amber-900/40'
            : 'text-amber-900 bg-amber-100',
          title: isDarkMode ? 'text-amber-100' : 'text-amber-950',
          text: isDarkMode ? 'text-amber-200/90' : 'text-amber-900/85',
          meta: isDarkMode ? 'text-amber-300/90' : 'text-amber-800/85',
          label: 'Plan failed',
        }
      : isCancelled
        ? {
            container: isDarkMode
              ? 'bg-slate-900/30 border-slate-600/35'
              : 'bg-slate-50 border-slate-200',
            labelWrap: isDarkMode
              ? 'text-slate-200 bg-slate-800/50'
              : 'text-slate-800 bg-slate-200/80',
            title: isDarkMode ? 'text-slate-100' : 'text-slate-900',
            text: isDarkMode ? 'text-slate-300' : 'text-slate-700',
            meta: isDarkMode ? 'text-slate-400' : 'text-slate-600',
            label: 'Plan cancelled',
          }
        : isPending || isInProgress
          ? {
              container: isDarkMode
                ? 'bg-violet-950/25 border-violet-600/35'
                : 'bg-violet-50/90 border-violet-200/70',
              labelWrap: isDarkMode
                ? 'text-violet-200 bg-violet-900/45'
                : 'text-violet-900 bg-violet-100',
              title: isDarkMode ? 'text-violet-100' : 'text-violet-950',
              text: isDarkMode ? 'text-violet-200/90' : 'text-violet-900/85',
              meta: isDarkMode ? 'text-violet-300/90' : 'text-violet-800/80',
              label: plan.plan_type === 'objective' ? 'Plan · New objective' : 'Plan started',
            }
          : {
              container: isDarkMode
                ? 'bg-indigo-950/20 border-indigo-700/30'
                : 'bg-indigo-50/70 border-indigo-200/60',
              labelWrap: isDarkMode
                ? 'text-indigo-200 bg-indigo-900/40'
                : 'text-indigo-900 bg-indigo-100/90',
              title: isDarkMode ? 'text-indigo-100' : 'text-indigo-950',
              text: isDarkMode ? 'text-indigo-200/90' : 'text-indigo-900/85',
              meta: isDarkMode ? 'text-indigo-300/90' : 'text-indigo-800/80',
              label: isBlocked ? 'Plan blocked' : isPaused ? 'Plan paused' : 'Plan updated',
            }

  return (
    <div className="space-y-4 w-full min-w-[min(100%,450px)] overflow-hidden max-w-[calc(100%-80px)] lg:max-w-[calc(100%-240px)] mx-auto">
      <div className={`${baseClasses.container} border rounded-lg p-4`}>
        <div className="mb-3">
          <span className={`text-xs px-2 py-1 rounded ${baseClasses.labelWrap}`}>
            {baseClasses.label}
          </span>
        </div>
        <div className="mb-2">
          <h4 className={`font-medium ${baseClasses.title}`}>{plan.title}</h4>
        </div>

        {plan.description && (
          <p className={`text-sm mb-3 ${baseClasses.text}`}>{plan.description}</p>
        )}

        {isCompleted && plan.steps && Array.isArray(plan.steps) && (
          <div className="space-y-1">
            <div className={`text-xs font-medium mb-2 ${baseClasses.meta}`}>
              Steps ({plan.steps.length}):
            </div>
            {(plan.steps as PlanStep[]).map((step, stepIndex) => (
              <div key={step.id || stepIndex} className={`flex items-center gap-2 text-xs ${baseClasses.text}`}>
                <CheckCircle
                  className={
                    isDarkMode ? 'flex-shrink-0 text-indigo-300' : 'flex-shrink-0 text-indigo-600'
                  }
                  size={12}
                />
                <span className="font-medium">{step.order || stepIndex + 1}.</span>
                <span className="line-through opacity-75">{step.title}</span>
              </div>
            ))}
          </div>
        )}

        <div className={`flex items-center gap-4 mt-3 text-xs flex-wrap ${baseClasses.meta}`}>
          {typeof plan.progress_percentage === 'number' && (
            <span>Progress: {plan.progress_percentage}%</span>
          )}
          {(typeof plan.steps_completed === 'number' || typeof plan.steps_total === 'number') && (
            <span>
              Steps: {plan.steps_completed || 0}/{plan.steps_total || 0}
            </span>
          )}
          {(plan.completed_at || plan.updated_at) && (
            <span>
              {isFailed
                ? 'Failed'
                : isCompleted
                  ? 'Completed'
                  : isCancelled
                    ? 'Cancelled'
                    : isBlocked
                      ? 'Blocked'
                      : isPaused
                        ? 'Paused'
                        : 'Updated'}
              : {new Date(plan.completed_at || plan.updated_at!).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
