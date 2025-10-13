import React from 'react'
import { CheckCircle } from "@/app/components/ui/icons"
import { InstancePlan } from '../types'
import { useTheme } from "@/app/context/ThemeContext"

interface CompletedPlanCardProps {
  plan: InstancePlan
}

export const CompletedPlanCard: React.FC<CompletedPlanCardProps> = ({ plan }) => {
  const { isDarkMode } = useTheme()
  const isCompleted = plan.status === 'completed'
  const isFailed = plan.status === 'failed'
  const isCancelled = plan.status === 'cancelled'
  
  const baseClasses = isCompleted
    ? {
        container: isDarkMode 
          ? 'bg-green-900/20 border-green-700/30' 
          : 'bg-green-50/50 border-green-200/50',
        labelWrap: isDarkMode 
          ? 'text-green-400 bg-green-800/30' 
          : 'text-green-600 bg-green-100',
        title: isDarkMode 
          ? 'text-green-300' 
          : 'text-green-800',
        text: isDarkMode 
          ? 'text-green-400' 
          : 'text-green-700',
        meta: isDarkMode 
          ? 'text-green-500' 
          : 'text-green-600',
        label: 'Plan Completed',
      }
    : isFailed
    ? {
        container: isDarkMode 
          ? 'bg-red-900/20 border-red-700/30' 
          : 'bg-red-50/50 border-red-200/50',
        labelWrap: isDarkMode 
          ? 'text-red-400 bg-red-800/30' 
          : 'text-red-600 bg-red-100',
        title: isDarkMode 
          ? 'text-red-300' 
          : 'text-red-800',
        text: isDarkMode 
          ? 'text-red-400' 
          : 'text-red-700',
        meta: isDarkMode 
          ? 'text-red-500' 
          : 'text-red-600',
        label: 'Plan Failed',
      }
    : {
        container: isDarkMode 
          ? 'bg-amber-900/20 border-amber-700/30' 
          : 'bg-amber-50/50 border-amber-200/50',
        labelWrap: isDarkMode 
          ? 'text-amber-400 bg-amber-800/30' 
          : 'text-amber-700 bg-amber-100',
        title: isDarkMode 
          ? 'text-amber-300' 
          : 'text-amber-900',
        text: isDarkMode 
          ? 'text-amber-400' 
          : 'text-amber-800',
        meta: isDarkMode 
          ? 'text-amber-500' 
          : 'text-amber-700',
        label: 'Plan Update',
      }

  return (
    <div className="space-y-4 w-full min-w-0 overflow-hidden">
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
            {plan.steps.map((step: any, stepIndex: number) => (
              <div key={step.id || stepIndex} className={`flex items-center gap-2 text-xs ${baseClasses.text}`}>
                <CheckCircle className={`h-3 w-3 flex-shrink-0 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
                <span className="font-medium">{step.order || stepIndex + 1}.</span>
                <span className="line-through opacity-75">{step.title}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className={`flex items-center gap-4 mt-3 text-xs ${baseClasses.meta}`}>
          {typeof plan.progress_percentage === 'number' && (
            <span>Progress: {plan.progress_percentage}%</span>
          )}
          {(typeof plan.steps_completed === 'number' || typeof plan.steps_total === 'number') && (
            <span>Steps: {plan.steps_completed || 0}/{plan.steps_total || 0}</span>
          )}
          {(plan.completed_at || plan.updated_at) && (
            <span>{isFailed ? 'Failed' : isCompleted ? 'Completed' : 'Updated'}: {new Date(plan.completed_at || plan.updated_at!).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  )
}
