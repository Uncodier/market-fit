import React from 'react'
import { CheckCircle } from "@/app/components/ui/icons"
import { InstanceLog } from '../types'

interface StepCompletedItemProps {
  log: InstanceLog
  isDarkMode: boolean
}

export const StepCompletedItem: React.FC<StepCompletedItemProps> = ({
  log,
  isDarkMode
}) => {
  // Parse the structured output to extract step information
  const parseStructuredOutput = (message: string) => {
    try {
      // Extract step number and assistant message from the structured output
      const stepMatch = message.match(/step=(\d+)/)
      const assistantMessageMatch = message.match(/assistant_message=(.+)/)
      
      return {
        stepNumber: stepMatch ? parseInt(stepMatch[1]) : null,
        assistantMessage: assistantMessageMatch ? assistantMessageMatch[1] : null
      }
    } catch (error) {
      console.error('Error parsing structured output:', error)
      return { stepNumber: null, assistantMessage: null }
    }
  }

  const { stepNumber, assistantMessage } = parseStructuredOutput(log.message)

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div 
        className="rounded-lg p-4 text-sm"
        style={{ 
          backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
          borderLeft: '3px solid #10b981', // Green accent for completed steps
          borderTop: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          boxShadow: 'none', 
          outline: 'none',
          filter: 'none'
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="text-sm font-medium text-green-600 dark:text-green-500">
            Step {stepNumber} Completed
          </span>
        </div>
        
        {assistantMessage && (
          <div className="text-sm text-muted-foreground leading-relaxed">
            {assistantMessage}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mt-2 opacity-70">
          {new Date(log.created_at).toLocaleTimeString([], { 
            hour: "2-digit", 
            minute: "2-digit" 
          })}
        </div>
      </div>
    </div>
  )
}
