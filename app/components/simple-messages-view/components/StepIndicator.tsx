import React from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Pause, Play, Pencil, Trash2, Target } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { PlanStep, InstancePlan } from '../types'

interface StepIndicatorProps {
  steps: PlanStep[]
  instancePlans: InstancePlan[]
  currentStep?: PlanStep | null
  allCompleted: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onTogglePause: (planId: string) => void
  onToggleResume: (planId: string) => void
  onEditStep: (step: PlanStep) => void
  onDeleteStep: (stepId: string) => void
  onToggleStepStatus: (stepId: string) => void
  canEditOrDeleteStep: (step: PlanStep) => boolean
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  instancePlans,
  currentStep,
  allCompleted,
  expanded,
  onToggleExpanded,
  onTogglePause,
  onToggleResume,
  onEditStep,
  onDeleteStep,
  onToggleStepStatus,
  canEditOrDeleteStep
}) => {
  if (steps.length === 0) return null

  return (
    <div className="absolute bottom-[175px] md:bottom-[180px] left-0 right-0 z-[5] transition-all duration-500 ease-in-out">
      <div className="px-[30px]">
        <div className={`backdrop-blur-sm border rounded-lg shadow-lg transition-all duration-500 ${
          allCompleted ? 'bg-green-50/95 border-green-200' : 'bg-background/95 border-border'
        }`} style={{
          padding: '0.5rem 0.75rem'
        }}>
          {expanded ? (
            <div className="space-y-2">
              {/* Current step header */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  allCompleted ? 'bg-green-500' :
                  currentStep?.status === 'in_progress' ? 'bg-primary animate-pulse' : 
                  currentStep?.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/60'
                }`}></div>
                {allCompleted ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium whitespace-nowrap text-green-600">All steps completed!</span>
                    <span className="text-xs text-green-600/70">Back to step 1</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium whitespace-nowrap">Step {currentStep?.order || 1} of {steps.length}</span>
                    <span className="text-xs truncate">- {currentStep?.title}</span>
                  </>
                )}
                
                {/* Play/Pause buttons */}
                <div className="flex items-center gap-1 ml-auto">
                  {instancePlans.some(plan => plan.status === 'in_progress') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const inProgressPlan = instancePlans.find(plan => plan.status === 'in_progress')
                        if (inProgressPlan) {
                          onTogglePause(inProgressPlan.id)
                        }
                      }}
                      className="h-6 w-6 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      title="Pause plan"
                    >
                      <Pause className="h-3 w-3 text-amber-600" />
                    </Button>
                  )}
                  {instancePlans.some(plan => plan.status === 'paused') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const pausedPlan = instancePlans.find(plan => plan.status === 'paused')
                        if (pausedPlan) {
                          onToggleResume(pausedPlan.id)
                        }
                      }}
                      className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                      title="Resume plan"
                    >
                      <Play className="h-3 w-3 text-green-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleExpanded()}
                    className="h-6 w-6 p-0 hover:bg-muted"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* All steps list */}
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {steps.map((step, index) => {
                  const canEdit = canEditOrDeleteStep(step)
                  const isCurrentStep = step.id === currentStep?.id
                  const isCompleted = step.status === 'completed'
                  const isInProgress = step.status === 'in_progress'
                  
                  return (
                    <div 
                      key={step.id} 
                      className={`group flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer ${
                        isCurrentStep ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => canEdit && onEditStep(step)}
                      title={canEdit ? "Click to edit step" : "Step completed"}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isCompleted ? 'bg-green-500' :
                          isInProgress ? 'bg-primary animate-pulse' : 
                          'bg-muted-foreground/60'
                        }`}></div>
                        <span className="text-xs font-medium text-muted-foreground">#{step.order}</span>
                        <span className="text-sm truncate">{step.title}</span>
                      </div>
                      
                      {/* Action buttons - delete only shows on hover */}
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteStep(step.id)
                            }}
                            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete step"
                          >
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        )}
                        
                        {/* Show lock icon for completed steps */}
                        {!canEdit && (
                          <div className="opacity-50">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : steps.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                allCompleted ? 'bg-green-500' :
                currentStep?.status === 'in_progress' ? 'bg-primary animate-pulse' : 
                currentStep?.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/60'
              }`}></div>
              {allCompleted ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium whitespace-nowrap text-green-600">All steps completed!</span>
                  <span className="text-xs text-green-600/70">Back to step 1</span>
                </>
              ) : (
                <>
                  <span className="font-medium whitespace-nowrap">Step {currentStep?.order || 1} of {steps.length}</span>
                  <span className="text-xs truncate">- {currentStep?.title}</span>
                </>
              )}
              
              {/* Play/Pause buttons */}
              <div className="flex items-center gap-1 ml-auto">
                {instancePlans.some(plan => plan.status === 'in_progress') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const inProgressPlan = instancePlans.find(plan => plan.status === 'in_progress')
                      if (inProgressPlan) {
                        onTogglePause(inProgressPlan.id)
                      }
                    }}
                    className="h-6 w-6 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                    title="Pause plan"
                  >
                    <Pause className="h-3 w-3 text-amber-600" />
                  </Button>
                )}
                {instancePlans.some(plan => plan.status === 'paused') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const pausedPlan = instancePlans.find(plan => plan.status === 'paused')
                      if (pausedPlan) {
                        onToggleResume(pausedPlan.id)
                      }
                    }}
                    className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                    title="Resume plan"
                  >
                    <Play className="h-3 w-3 text-green-600" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleExpanded()}
                  className="h-6 w-6 p-0 hover:bg-muted"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full flex-shrink-0 bg-muted-foreground/60"></div>
              <span className="font-medium">No plan available</span>
              <span className="text-xs">- Robot will generate plan when started</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
