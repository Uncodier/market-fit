import { InstanceLog, PlanStep, EventType, StructuredOutputStyle, StructuredOutputStylesLight } from "./types"

// Helper function to get style per theme
export const getStructuredStyle = (event: EventType, isDark: boolean): StructuredOutputStyle => {
  const base = StructuredOutputStylesLight[event]
  if (!isDark) return base
  const darkOverrides: Partial<Record<EventType, Partial<StructuredOutputStyle>>> = {
    step_failed: {
      color: '#fca5a5', // rose-300
      backgroundColor: 'rgba(239, 68, 68, 0.08)', // subtle red tint
      borderColor: '#ef4444' // red-500
    },
    plan_failed: {
      color: '#fca5a5',
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: '#ef4444'
    },
    user_attention_required: {
      color: '#fbbf24', // amber-400
      backgroundColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: '#f59e0b' // amber-500
    },
    session_needed: {
      color: '#fbbf24',
      backgroundColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: '#f59e0b'
    },
    step_canceled: {
      color: '#9ca3af', // gray-400
      backgroundColor: 'rgba(156, 163, 175, 0.08)',
      borderColor: '#6b7280' // gray-500
    }
  }
  const override = darkOverrides[event] || {}
  return { ...base, ...override }
}

export const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const getActivityName = (tabValue: string): string => {
  const activityMap: Record<string, string> = {
    "ask": "Ask",
    "robot": "Execute Plan",
    "generate-image": "Publish Content",
    "generate-video": "Publish Content",
    "generate-audio": "Publish Content"
  }
  return activityMap[tabValue] || tabValue
}

export const getSystemPromptForActivity = (activity: string): string => {
  const promptMap: Record<string, string> = {
    "ask": "answer",
    "generate-image": "generate image",
    "generate-video": "generate video",
    "generate-audio": "generate audio"
  }
  return promptMap[activity] || "answer"
}

// Helper function to remove duplicate steps
export const removeDuplicateSteps = (steps: PlanStep[]): PlanStep[] => {
  const seen = new Set<string>()
  const uniqueSteps = steps.filter(step => {
    if (seen.has(step.id)) {
      console.warn(`🚨 Removing duplicate step with ID: ${step.id}, title: ${step.title}`)
      return false
    }
    seen.add(step.id)
    return true
  })
  
  // Re-order the steps to ensure consistent ordering
  return uniqueSteps.sort((a, b) => a.order - b.order)
}

// Helper function to get tool name from various possible field names
export const getToolName = (log: InstanceLog): string | null => {
  return log.tool_name || log.toolName || null
}

// Helper function to get tool result from various possible field names
export const getToolResult = (log: InstanceLog): any => {
  return log.tool_result || log.tool_results || null
}

// Helper function to get the appropriate icon for a tool
export const getToolIcon = (toolName: string): string => {
  switch (toolName.toLowerCase()) {
    case 'computer':
      return 'computer'
    case 'structured_output':
      return 'structured_output'
    default:
      return 'default'
  }
}

// Helper function to check if a string is a base64 image
export const isBase64Image = (str: string): boolean => {
  if (typeof str !== 'string') return false
  
  // Check for data URL format
  if (str.startsWith('data:image/')) return true
  
  // Check for plain base64 (common patterns)
  if (str.length > 100 && /^[A-Za-z0-9+/]*={0,2}$/.test(str)) {
    // Additional check: base64 strings are typically much longer for images
    return str.length > 1000
  }
  
  return false
}

// Helper function to ensure proper data URL format
export const formatBase64Image = (base64: string): string => {
  if (base64.startsWith('data:image/')) {
    return base64
  }
  // Assume PNG if no format specified
  return `data:image/png;base64,${base64}`
}
