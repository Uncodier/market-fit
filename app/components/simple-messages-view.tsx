"use client"

import { MessageSquare, User, Settings, ChevronRight, ChevronDown, ChevronUp, Clock, CheckCircle, Target, Pencil, Trash2, Eye, EyeOff, Code, Zap, LayoutGrid } from "@/app/components/ui/icons"
import { ContextSelectorModal } from "@/app/components/ui/context-selector-modal"

import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { MessagesSkeleton } from "@/app/components/skeletons/messages-skeleton"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { useTheme } from "@/app/context/ThemeContext"
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'
import { contextService, type SelectedContextIds } from '@/app/services/context-service'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'

// Mock messages for demonstration
const mockMessages = [
  {
    id: "1",
    role: "user" as const,
    text: "Hello, I need help with my account",
    timestamp: new Date("2024-01-30T14:30:00Z"),
    sender: "User"
  },
  {
    id: "2", 
    role: "assistant" as const,
    text: "Hi! I'd be happy to help you with your account. What specific issue are you experiencing?",
    timestamp: new Date("2024-01-30T14:31:00Z"),
    sender: "Assistant"
  },
  {
    id: "3",
    role: "user" as const,
    text: "I can't access my dashboard",
    timestamp: new Date("2024-01-30T14:32:00Z"),
    sender: "User"
  },
  {
    id: "4",
    role: "assistant" as const,
    text: "I understand you're having trouble accessing your dashboard. Let me help you troubleshoot this issue. Can you tell me what happens when you try to log in?",
    timestamp: new Date("2024-01-30T14:33:00Z"),
    sender: "Assistant"
  }
]

interface SimpleMessagesViewProps {
  className?: string
  activeRobotInstance?: any
}

interface InstanceLog {
  id: string
  log_type: 'system' | 'user_action' | 'agent_action' | 'tool_call' | 'tool_result' | 'error' | 'performance'
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  message: string
  details?: any
  created_at: string
  tool_name?: string
  tool_result?: any
  screenshot_base64?: string
  parent_log_id?: string | null
  // Support for alternative field names from different data sources
  toolName?: string
  tool_results?: any
  logType?: string
}

// Structured Output Types
type EventType = 
  | 'step_completed'
  | 'step_failed' 
  | 'step_canceled'
  | 'plan_failed'
  | 'plan_new_required'
  | 'session_acquired'
  | 'session_needed'
  | 'session_saved'
  | 'user_attention_required';

interface StructuredOutputResponse {
  event: EventType;
  step: number;
  assistant_message: string;
}

interface StructuredOutputStyle {
  icon: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  label: string;
  priority: 'success' | 'error' | 'warning' | 'neutral' | 'info';
}

// Structured Output Styles Configuration
const StructuredOutputStyles: Record<EventType, StructuredOutputStyle> = {
  // ✅ Estados de éxito
  step_completed: {
    icon: '✅',
    color: '#2e7d32',
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
    label: 'Step Completed',
    priority: 'success'
  },
  session_saved: {
    icon: '💾',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    label: 'Session Saved',
    priority: 'success'
  },
  session_acquired: {
    icon: '🔐',
    color: '#7b1fa2',
    backgroundColor: '#f3e5f5',
    borderColor: '#9c27b0',
    label: 'Session Acquired',
    priority: 'success'
  },
  // ❌ Estados de error
  step_failed: {
    icon: '❌',
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    label: 'Step Failed',
    priority: 'error'
  },
  plan_failed: {
    icon: '🔴',
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    label: 'Plan Failed',
    priority: 'error'
  },
  // ⚠️ Estados de atención
  user_attention_required: {
    icon: '⚠️',
    color: '#f57c00',
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    label: 'Attention Required',
    priority: 'warning'
  },
  session_needed: {
    icon: '🔐',
    color: '#f57c00',
    backgroundColor: '#fff3e0',
    borderColor: '#ff9800',
    label: 'Session Needed',
    priority: 'warning'
  },
  // 🔄 Estados de cambio
  step_canceled: {
    icon: '⏸️',
    color: '#616161',
    backgroundColor: '#f5f5f5',
    borderColor: '#9e9e9e',
    label: 'Step Canceled',
    priority: 'neutral'
  },
  plan_new_required: {
    icon: '🔄',
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    label: 'New Plan Required',
    priority: 'info'
  }
};

export interface InstancePlan {
  id: string
  title: string
  description?: string
  plan_type: 'objective' | 'task' | 'verification' | 'milestone'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  instructions?: string
  expected_output?: string
  progress_percentage: number
  steps_completed: number
  steps_total: number
  priority: number
  created_at: string
  steps?: any // Contains the steps for the plan
}

interface PlanStep {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed'
  order: number
}

export function SimpleMessagesView({ className = "", activeRobotInstance }: SimpleMessagesViewProps) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { toast } = useToast()
  const [logs, setLogs] = useState<InstanceLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [message, setMessage] = useState('')
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<string>>(new Set())
  const [collapsedToolDetails, setCollapsedToolDetails] = useState<Set<string>>(new Set())
  const [isStepIndicatorExpanded, setIsStepIndicatorExpanded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Steps management state - loaded from database
  const [steps, setSteps] = useState<PlanStep[]>([])
  const [instancePlans, setInstancePlans] = useState<InstancePlan[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  
  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<PlanStep | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  
  // Loading/response state
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  
  // Context selection state
  const [selectedContext, setSelectedContext] = useState<SelectedContextIds>({
    leads: [],
    contents: [],
    requirements: [],
    tasks: []
  })
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Helper function to get tool name from various possible field names
  const getToolName = (log: InstanceLog): string | null => {
    return log.tool_name || log.toolName || null
  }

  // Helper function to get tool result from various possible field names
  const getToolResult = (log: InstanceLog): any => {
    return log.tool_result || log.tool_results || null
  }

  // Helper function to get the appropriate icon for a tool
  const getToolIcon = (toolName: string): React.ReactElement => {
    switch (toolName.toLowerCase()) {
      case 'computer':
        return <Code className="h-3.5 w-3.5" />
      case 'structured_output':
        return <LayoutGrid className="h-3.5 w-3.5" />
      default:
        return <Zap className="h-3.5 w-3.5" />
    }
  }

  // Helper function to render structured output based on tool_result.output
  const renderStructuredOutput = (log: InstanceLog): React.ReactElement | null => {
    const toolResult = getToolResult(log)
    
    try {
      let structuredData: StructuredOutputResponse | null = null

      // Try to parse the output from tool_result.output
      if (toolResult?.output) {
        if (typeof toolResult.output === 'string') {
          structuredData = JSON.parse(toolResult.output)
        } else {
          structuredData = toolResult.output
        }
      }

      if (!structuredData || !structuredData.event || !StructuredOutputStyles[structuredData.event]) {
        return null
      }

      const style = StructuredOutputStyles[structuredData.event]

      return (
        <div 
          className="text-xs bg-muted p-3 rounded overflow-x-auto transition-colors"
          style={{
            borderLeft: `3px solid ${style.borderColor}`,
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span 
                  className="font-medium text-sm"
                  style={{ color: style.color }}
                >
                  {style.label}
                </span>
                {structuredData.step && (
                  <span 
                    className="text-xs px-2 py-1 rounded"
                    style={{ 
                      backgroundColor: style.color + '20',
                      color: style.color 
                    }}
                  >
                    Step {structuredData.step}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    } catch (error) {
      console.error('Error parsing structured output:', error)
      return null
    }
  }

  // Helper function to check if a string is a base64 image
  const isBase64Image = (str: string): boolean => {
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
  const formatBase64Image = (base64: string): string => {
    if (base64.startsWith('data:image/')) {
      return base64
    }
    // Assume PNG if no format specified
    return `data:image/png;base64,${base64}`
  }

  // Helper function to render object with base64 images extracted
  const renderObjectWithImages = (obj: any, depth: number = 0): React.ReactElement => {
    if (depth > 3) return <span>...</span> // Prevent infinite recursion
    
    if (typeof obj === 'string' && isBase64Image(obj)) {
      return (
        <div className="mt-2">
          <div className="text-xs text-gray-600 mb-1">Screenshot:</div>
          <img 
            src={formatBase64Image(obj)} 
            alt="Screenshot" 
            className="w-full h-auto rounded border shadow-sm"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )
    }
    
    if (Array.isArray(obj)) {
      return (
        <div>
          {obj.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="text-xs text-gray-500">[{index}]:</div>
              <div className="ml-2">
                {renderObjectWithImages(item, depth + 1)}
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    if (obj && typeof obj === 'object') {
      return (
        <div>
          {Object.entries(obj).map(([key, value]) => (
            <div key={key} className="mb-2">
              <div className="text-xs text-gray-600 font-medium">{key}:</div>
              <div className="ml-2">
                {renderObjectWithImages(value, depth + 1)}
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    return <span className="font-mono text-xs">{JSON.stringify(obj, null, 2)}</span>
  }

  // Toggle collapse for system messages
  const toggleSystemMessageCollapse = (messageId: string) => {
    setCollapsedSystemMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // Toggle all system messages
  const toggleAllSystemMessages = () => {
    const systemMessages = logs.filter(log => log.log_type === 'system')
    const allCollapsed = systemMessages.every(log => collapsedSystemMessages.has(log.id))
    
    if (allCollapsed) {
      // Expand all
      setCollapsedSystemMessages(new Set())
    } else {
      // Collapse all system messages
      const systemIds = systemMessages.map(log => log.id)
      setCollapsedSystemMessages(new Set(systemIds))
    }
  }

  // Toggle tool details collapse
  const toggleToolDetails = (logId: string) => {
    setCollapsedToolDetails(prev => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) {
        newSet.delete(logId)
      } else {
        newSet.add(logId)
      }
      return newSet
    })
  }

  // Toggle all tool details
  const toggleAllToolDetails = () => {
    const logsWithTools = logs.filter(log => 
      log.tool_name && ((log.tool_result && Object.keys(log.tool_result).length > 0) || 
                       (log.details && Object.keys(log.details).length > 0))
    )
    const allCollapsed = logsWithTools.every(log => collapsedToolDetails.has(log.id))
    
    if (allCollapsed) {
      // Expand all
      setCollapsedToolDetails(new Set())
    } else {
      // Collapse all tool details
      const toolIds = logsWithTools.map(log => log.id)
      setCollapsedToolDetails(new Set(toolIds))
    }
  }

  // Step management functions
  const openEditModal = (step: PlanStep) => {
    setEditingStep(step)
    setEditTitle(step.title)
    setEditDescription(step.description || '')
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingStep(null)
    setEditTitle('')
    setEditDescription('')
  }

  const saveStep = async () => {
    if (!editingStep || !editTitle.trim() || !activeRobotInstance?.id) return

    // Check if step can be edited
    if (!canEditOrDeleteStep(editingStep)) {
      console.log('Cannot edit completed step')
      closeEditModal()
      return
    }

    try {
      const supabase = createClient()
      
      // Update the plan in the database
      const { error } = await supabase
        .from('instance_plans')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingStep.id)

      if (error) {
        console.error('Error updating plan:', error)
        // Could show a toast notification here
      } else {
        console.log('Plan updated successfully')
        // The real-time subscription will handle updating the local state
        closeEditModal()
      }
    } catch (error) {
      console.error('Error saving step:', error)
    }
  }

  const deleteStep = async (stepId: string) => {
    if (!activeRobotInstance?.id) return

    // Find the step to check if it can be deleted
    const stepToDelete = steps.find(step => step.id === stepId)
    if (!stepToDelete || !canEditOrDeleteStep(stepToDelete)) {
      toast({
        title: "Cannot delete step",
        description: "Completed steps cannot be deleted",
        variant: "destructive"
      })
      return
    }

    try {
      const supabase = createClient()
      
      // Helper function to check if string is a valid UUID format
      const isValidUUID = (str: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(str)
      }

      // If stepId is a valid UUID, it's likely a plan ID itself
      if (isValidUUID(stepId)) {
        // Try to find the plan by ID and delete it entirely
        const { error } = await supabase
          .from('instance_plans')
          .delete()
          .eq('id', stepId)

        if (error) {
          console.error('Error deleting plan:', error)
          toast({
            title: "Error deleting step",
            description: error.message || "Failed to delete the step",
            variant: "destructive"
          })
        } else {
          console.log('Plan deleted successfully')
          toast({
            title: "Step deleted",
            description: "The step has been removed from the plan"
          })
        }
      } else {
        // stepId is not a UUID, so it must be a step within a plan's steps array
        // Find which plan contains this step
        const planWithStep = instancePlans.find(plan => {
          if (plan.steps && Array.isArray(plan.steps)) {
            return plan.steps.some((step: any) => step.id === stepId)
          }
          return false
        })

        if (!planWithStep) {
          toast({
            title: "Error deleting step",
            description: "Step not found in any plan",
            variant: "destructive"
          })
          return
        }

        // Remove the step from the plan's steps array
        const updatedSteps = (planWithStep.steps as any[]).filter((step: any) => step.id !== stepId)
        
        // If no steps remain, delete the plan entirely
        if (updatedSteps.length === 0) {
          const { error } = await supabase
            .from('instance_plans')
            .delete()
            .eq('id', planWithStep.id)

          if (error) {
            console.error('Error deleting plan:', error)
            toast({
              title: "Error deleting step",
              description: error.message || "Failed to delete the plan",
              variant: "destructive"
            })
          } else {
            console.log('Plan deleted successfully (no steps remaining)')
            toast({
              title: "Step deleted",
              description: "The step has been removed from the plan"
            })
          }
        } else {
          // Update the plan with the modified steps array
          const { error } = await supabase
            .from('instance_plans')
            .update({
              steps: updatedSteps,
              steps_total: updatedSteps.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', planWithStep.id)

          if (error) {
            console.error('Error updating plan steps:', error)
            toast({
              title: "Error deleting step",
              description: error.message || "Failed to update the plan",
              variant: "destructive"
            })
          } else {
            console.log('Step removed from plan successfully')
            toast({
              title: "Step deleted",
              description: "The step has been removed from the plan"
            })
          }
        }
      }
    } catch (error) {
      console.error('Error deleting step:', error)
      toast({
        title: "Error deleting step",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const toggleStepStatus = async (stepId: string) => {
    if (!activeRobotInstance?.id) return

    try {
      const supabase = createClient()
      
      // Find the current status
      const currentStep = steps.find(step => step.id === stepId)
      if (!currentStep) return

      const newStatus = currentStep.status === 'completed' ? 'pending' : 
                       currentStep.status === 'pending' ? 'in_progress' : 'completed'
      
      // Update the plan status in the database
      const { error } = await supabase
        .from('instance_plans')
        .update({
          status: newStatus,
          progress_percentage: newStatus === 'completed' ? 100 : 
                             newStatus === 'in_progress' ? 50 : 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepId)

      if (error) {
        console.error('Error updating plan status:', error)
        // Could show a toast notification here
      } else {
        console.log('Plan status updated successfully')
        // The real-time subscription will handle updating the local state
        
        // Check if all steps will be completed after this update
        const updatedSteps = steps.map(step => 
          step.id === stepId ? { ...step, status: newStatus } : step
        )
        
        const allWillBeCompleted = updatedSteps.every(step => step.status === 'completed')
        
        if (allWillBeCompleted && updatedSteps.length > 0) {
          // Mark all instance plans as completed
          await markAllInstancePlansCompleted()
        }
      }
    } catch (error) {
      console.error('Error toggling step status:', error)
    }
  }

  // Mark all instance plans as completed when all steps are done
  const markAllInstancePlansCompleted = async () => {
    if (!activeRobotInstance?.id) return

    try {
      const supabase = createClient()
      
      // Update all instance plans for this instance to completed
      const { error } = await supabase
        .from('instance_plans')
        .update({
          status: 'completed',
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('instance_id', activeRobotInstance.id)

      if (error) {
        console.error('Error marking instance plans as completed:', error)
      } else {
        console.log('All instance plans marked as completed successfully')
      }
    } catch (error) {
      console.error('Error marking instance plans as completed:', error)
    }
  }

  const getCurrentStep = () => {
    // Check if all steps are completed
    const allCompleted = steps.length > 0 && steps.every(step => step.status === 'completed')
    
    if (allCompleted) {
      // If all steps are completed, return the first step
      return steps[0]
    }
    
    const inProgressStep = steps.find(step => step.status === 'in_progress')
    if (inProgressStep) return inProgressStep
    
    const firstPendingStep = steps.find(step => step.status === 'pending')
    return firstPendingStep || steps[0]
  }

  // Check if all steps are completed
  const areAllStepsCompleted = () => {
    return steps.length > 0 && steps.every(step => step.status === 'completed')
  }

  // Check if a step can be edited or deleted (completed steps cannot be edited/deleted)
  const canEditOrDeleteStep = (step: PlanStep) => {
    return step.status !== 'completed'
  }

  // Create test plans for debugging
  const createTestPlansFunc = async (instanceId: string, siteId: string, userId: string) => {
    try {
      const supabase = createClient()
      
      const testPlans = [
        {
          title: 'Research Target Market',
          description: 'Analyze the target market and identify key opportunities',
          plan_type: 'objective',
          priority: 1,
          status: 'in_progress',
          instructions: 'Research and analyze the target market to understand customer needs and preferences',
          progress_percentage: 30,
          steps_completed: 1,
          steps_total: 3,
          instance_id: instanceId,
          site_id: siteId,
          user_id: userId
        },
        {
          title: 'Content Strategy Planning',
          description: 'Develop a comprehensive content strategy for the channel',
          plan_type: 'task',
          priority: 2,
          status: 'pending',
          instructions: 'Create a detailed content calendar and strategy document',
          progress_percentage: 0,
          steps_completed: 0,
          steps_total: 5,
          instance_id: instanceId,
          site_id: siteId,
          user_id: userId
        },
        {
          title: 'Performance Metrics Setup',
          description: 'Set up tracking and monitoring for key performance indicators',
          plan_type: 'task',
          priority: 3,
          status: 'pending',
          instructions: 'Configure analytics and tracking systems',
          progress_percentage: 0,
          steps_completed: 0,
          steps_total: 4,
          instance_id: instanceId,
          site_id: siteId,
          user_id: userId
        }
      ]
      
      console.log('🔧 Creating test plans:', testPlans)
      
      const { data, error } = await supabase
        .from('instance_plans')
        .insert(testPlans)
        .select()
      
      if (error) {
        console.error('❌ Error creating test plans:', error)
      } else {
        console.log('✅ Test plans created successfully:', data)
      }
    } catch (error) {
      console.error('❌ Error in createTestPlans:', error)
    }
  }

  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto scroll when logs change or when waiting for response
  useEffect(() => {
    scrollToBottom()
  }, [logs, isWaitingForResponse])







  // Load instance plans
  const loadInstancePlans = async () => {
    console.log('🔍 loadInstancePlans called with activeRobotInstance:', activeRobotInstance)
    
    // First, let's test if the table exists regardless of activeRobotInstance
    try {
      const supabase = createClient()
      console.log('🔧 Testing if instance_plans table exists...')
      
      const { data: tableTest, error: tableError, count: totalCount } = await supabase
        .from('instance_plans')
        .select('id', { count: 'exact' })
        .limit(1)
      
      console.log('🔧 Table test result:', { 
        tableExists: !tableError, 
        error: tableError?.message || 'none',
        totalCount: totalCount || 0,
        data: tableTest 
      })
    } catch (testError) {
      console.error('🔧 Table test failed:', testError)
    }
    
    if (!activeRobotInstance?.id) {
      console.log('❌ No active robot instance ID, clearing plans')
      setInstancePlans([])
      setSteps([])
      return
    }

    const instanceId = activeRobotInstance.id
    
    console.log('🚀 Loading plans for instance:', {
      instanceId: instanceId,
      instanceName: activeRobotInstance.name,
      instanceStatus: activeRobotInstance.status
    })

    setIsLoadingPlans(true)
    try {
      const supabase = createClient()
      
      console.log('🔍 Building Supabase query for instance_plans with instanceId:', instanceId)
      
      // Query instance plans using the remote_instances.id
      const { data, error, count } = await supabase
        .from('instance_plans')
        .select('*', { count: 'exact' })
        .eq('instance_id', instanceId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })

      console.log('📊 Query executed. Results:', { 
        dataLength: data?.length || 0, 
        count, 
        error: error?.message || null,
        data: data
      })

      if (error) {
        console.error('❌ Error loading instance plans:', error)
        setInstancePlans([])
        setSteps([])
        
        // Debug: Check if table exists and has any data
        try {
          const { data: allPlans, error: debugError, count: totalCount } = await supabase
            .from('instance_plans')
            .select('id, instance_id, title, status', { count: 'exact' })
            .limit(5)
          
          console.log('🔧 Debug - Sample plans in table:', allPlans, 'Error:', debugError, 'Total count:', totalCount)
        } catch (debugErr) {
          console.error('🔧 Debug query failed:', debugErr)
        }
      } else {
        console.log(`✅ Loaded ${data?.length || 0} plans for instance ${instanceId}`)
        const plans = data || []
        setInstancePlans(plans)
        
        // If no plans found, let's create some test data to verify the functionality
        if (plans.length === 0) {
          console.log('🔧 No plans found, creating test plans for debugging...')
          await createTestPlansFunc(instanceId, activeRobotInstance.site_id, activeRobotInstance.user_id)
          // Reload after creating test data
          return loadInstancePlans()
        }
        
        // Convert instance plans to step format for the UI
        let convertedSteps: PlanStep[] = []
        
        // Extract steps from the plan structure
        plans.forEach((plan: InstancePlan, planIndex: number) => {
          if (plan.steps && Array.isArray(plan.steps)) {
            // Use steps directly from the plan
            const planSteps = plan.steps.map((step: any, stepIndex: number) => ({
              id: step.id || `${plan.id}-${stepIndex}`,
              title: step.title || `Step ${stepIndex + 1}`,
              description: step.description || undefined,
              status: step.status || 'pending' as const,
              order: convertedSteps.length + stepIndex + 1
            }))
            convertedSteps = [...convertedSteps, ...planSteps]
          } else {
            // Fallback: use the plan itself as a single step
            convertedSteps.push({
              id: plan.id,
              title: plan.title,
              description: plan.description || undefined,
              status: plan.status === 'in_progress' ? 'in_progress' : 
                     plan.status === 'completed' ? 'completed' : 'pending',
              order: convertedSteps.length + 1
            })
          }
        })
        
        console.log('✅ Setting real plan steps extracted from complex structure:', convertedSteps.length, 'steps')
        console.log('🔍 First few steps:', convertedSteps.slice(0, 3))
        setSteps(convertedSteps)
      }
    } catch (error) {
      console.error('Error loading instance plans:', error)
      setInstancePlans([])
      setSteps([])
    } finally {
      setIsLoadingPlans(false)
    }
  }

  // Load instance logs
  const loadInstanceLogs = async () => {
    if (!activeRobotInstance?.id) {
      console.log('No active robot instance ID, clearing logs')
      setLogs([])
      return
    }

    // Use the remote_instances.id (this should match instance_logs.instance_id)
    const instanceId = activeRobotInstance.id
    
    console.log('Loading logs for instance:', {
      instanceId: instanceId,
      instanceIdType: typeof instanceId,
      instanceIdLength: instanceId?.length,
      instanceName: activeRobotInstance.name,
      instanceStatus: activeRobotInstance.status
    })
    
    if (!instanceId) {
      console.error('Instance ID is null/undefined!')
      setLogs([])
      setIsLoadingLogs(false)
      return
    }

    setIsLoadingLogs(true)
    try {
      const supabase = createClient()
      
      // Query logs using the remote_instances.id
      console.log('Building query with instance_id =', instanceId)
      const { data, error, count } = await supabase
        .from('instance_logs')
        .select('*', { count: 'exact' })
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: true })
        
      console.log('Query executed. Results:', { 
        dataLength: data?.length || 0, 
        count, 
        error: error?.message || null 
      })

      if (error) {
        console.error('Error loading instance logs:', {
          error,
          instanceId: activeRobotInstance.id,
          query: 'instance_logs'
        })
        setLogs([])
      } else {
        console.log(`Loaded ${data?.length || 0} logs for instance ${activeRobotInstance.id}. Total count: ${count}`)
        const logs = data || []
        setLogs(logs)
        
        // Auto-collapse long system messages (>200 characters)
        const longSystemMessages = logs
          .filter((log: InstanceLog) => log.log_type === 'system' && log.message.length > 200)
          .map((log: InstanceLog) => log.id)
        
        if (longSystemMessages.length > 0) {
          setCollapsedSystemMessages(new Set(longSystemMessages))
        }

        // Auto-collapse all tool details by default
        const logsWithToolDetails = logs
          .filter((log: InstanceLog) => (log.tool_result && Object.keys(log.tool_result).length > 0) || 
                        (log.details && Object.keys(log.details).length > 0))
          .map((log: InstanceLog) => log.id)
        
        if (logsWithToolDetails.length > 0) {
          setCollapsedToolDetails(new Set(logsWithToolDetails))
        }
        
        // If no logs found, let's check if there are any logs in the table at all
        if (!data || data.length === 0) {
          try {
            const { data: allLogs, error: allLogsError, count: totalCount } = await supabase
              .from('instance_logs')
              .select('instance_id, log_type, level, created_at', { count: 'exact' })
              .limit(5)
            
            console.log('Debug - Sample logs in table:', allLogs, 'Error:', allLogsError, 'Total count:', totalCount)
            
            setDebugInfo({
              instanceId: activeRobotInstance.id,
              logsFound: data?.length || 0,
              totalLogsInTable: totalCount || 0,
              sampleInstanceIds: allLogs?.map((l: any) => l.instance_id) || [],
              sampleLogs: allLogs || [],
              lastChecked: new Date().toISOString(),
              queryError: allLogsError?.message || null
            })
          } catch (debugError) {
            console.error('Error in debug query:', debugError)
            setDebugInfo({
              instanceId: activeRobotInstance.id,
              logsFound: data?.length || 0,
              totalLogsInTable: 0,
              sampleInstanceIds: [],
              sampleLogs: [],
              lastChecked: new Date().toISOString(),
              queryError: debugError instanceof Error ? debugError.message : 'Unknown error'
            })
          }
        } else {
          setDebugInfo(null)
        }
      }
    } catch (error) {
      console.error('Error loading instance logs:', error)
      setLogs([])
    } finally {
      setIsLoadingLogs(false)
    }
  }

  // Load instance plans


  // Load data when activeRobotInstance changes and setup real-time subscriptions
  useEffect(() => {
    // Always try to load plans to test the connection
    loadInstancePlans()
    
    if (activeRobotInstance?.id) {
      loadInstanceLogs()

      // Setup real-time subscription for logs
      const supabase = createClient()
      
      const logsSubscription = supabase
        .channel(`instance_logs_${activeRobotInstance.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'instance_logs',
            filter: `instance_id=eq.${activeRobotInstance.id}`
          },
          (payload: any) => {
            console.log('Real-time log update:', payload)
            if (payload.eventType === 'INSERT') {
              const newLog = payload.new as InstanceLog
              setLogs(prevLogs => [...prevLogs, newLog])
              
              // Stop loading animation when agent responds
              if (newLog.log_type === 'agent_action' || newLog.log_type === 'tool_result') {
                setIsWaitingForResponse(false)
              }
              
              // Auto-collapse if it's a long system message
              if (newLog.log_type === 'system' && newLog.message.length > 200) {
                setCollapsedSystemMessages(prev => new Set(prev).add(newLog.id))
              }
              
              // Auto-collapse if it has tool details
              if ((newLog.tool_result && Object.keys(newLog.tool_result).length > 0) || 
                  (newLog.details && Object.keys(newLog.details).length > 0)) {
                setCollapsedToolDetails(prev => new Set(prev).add(newLog.id))
              }
            } else if (payload.eventType === 'UPDATE') {
              setLogs(prevLogs => 
                prevLogs.map(log => 
                  log.id === payload.new.id ? payload.new as InstanceLog : log
                )
              )
            } else if (payload.eventType === 'DELETE') {
              setLogs(prevLogs => 
                prevLogs.filter(log => log.id !== payload.old.id)
              )
            }
          }
        )
        .subscribe()

      // Setup real-time subscription for plans
      const plansSubscription = supabase
        .channel(`instance_plans_${activeRobotInstance.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'instance_plans',
            filter: `instance_id=eq.${activeRobotInstance.id}`
          },
          (payload: any) => {
            console.log('Real-time plan update:', payload)
            if (payload.eventType === 'INSERT') {
              const newPlan = payload.new as InstancePlan
              setInstancePlans(prevPlans => {
                const updatedPlans = [...prevPlans, newPlan]
                
                // Add steps from the plan
                if (newPlan.steps && Array.isArray(newPlan.steps)) {
                  const newSteps = newPlan.steps.map((step: any, stepIndex: number) => ({
                    id: step.id || `${newPlan.id}-${stepIndex}`,
                    title: step.title || `Step ${stepIndex + 1}`,
                    description: step.description || undefined,
                    status: step.status || 'pending' as const,
                    order: stepIndex + 1 // Will be reordered below
                  }))
                  
                  setSteps(prevSteps => {
                    const allSteps = [...prevSteps, ...newSteps]
                    // Reorder all steps
                    return allSteps.map((step, index) => ({
                      ...step,
                      order: index + 1
                    }))
                  })
                } else {
                  // Fallback: use the plan itself as a single step
                  const newStep: PlanStep = {
                    id: newPlan.id,
                    title: newPlan.title,
                    description: newPlan.description || undefined,
                    status: newPlan.status === 'in_progress' ? 'in_progress' : 
                           newPlan.status === 'completed' ? 'completed' : 'pending',
                    order: updatedPlans.length
                  }
                  setSteps(prevSteps => [...prevSteps, newStep])
                }
                
                return updatedPlans
              })
            } else if (payload.eventType === 'UPDATE') {
              const updatedPlan = payload.new as InstancePlan
              setInstancePlans(prevPlans => 
                prevPlans.map(plan => 
                  plan.id === updatedPlan.id ? updatedPlan : plan
                )
              )
              
              // Update steps - rebuild all steps from all plans to ensure consistency
              setInstancePlans(currentPlans => {
                const allPlans = currentPlans.map(plan => 
                  plan.id === updatedPlan.id ? updatedPlan : plan
                )
                
                let convertedSteps: PlanStep[] = []
                allPlans.forEach((plan: InstancePlan) => {
                  if (plan.steps && Array.isArray(plan.steps)) {
                    const planSteps = plan.steps.map((step: any, stepIndex: number) => ({
                      id: step.id || `${plan.id}-${stepIndex}`,
                      title: step.title || `Step ${stepIndex + 1}`,
                      description: step.description || undefined,
                      status: step.status || 'pending' as const,
                      order: convertedSteps.length + stepIndex + 1
                    }))
                    convertedSteps = [...convertedSteps, ...planSteps]
                  } else {
                    convertedSteps.push({
                      id: plan.id,
                      title: plan.title,
                      description: plan.description || undefined,
                      status: plan.status === 'in_progress' ? 'in_progress' : 
                             plan.status === 'completed' ? 'completed' : 'pending',
                      order: convertedSteps.length + 1
                    })
                  }
                })
                
                setSteps(convertedSteps)
                return allPlans
              })
            } else if (payload.eventType === 'DELETE') {
              setInstancePlans(prevPlans => 
                prevPlans.filter(plan => plan.id !== payload.old.id)
              )
              setSteps(prevSteps => {
                // Remove all steps that belong to the deleted plan
                const filteredSteps = prevSteps.filter(step => 
                  !step.id.startsWith(payload.old.id) && step.id !== payload.old.id
                )
                // Reorder the remaining steps
                return filteredSteps.map((step, index) => ({
                  ...step,
                  order: index + 1
                }))
              })
            }
          }
        )
        .subscribe()

      // Cleanup subscriptions on unmount or when instance changes
      return () => {
        logsSubscription.unsubscribe()
        plansSubscription.unsubscribe()
      }
    } else {
      setLogs([])
      setInstancePlans([])
      setSteps([])
    }
  }, [activeRobotInstance?.id])

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!activeRobotInstance?.id || !message.trim() || !currentSite?.id) return

    const messageToSend = message.trim()
    setMessage('') // Clear immediately for better UX
    setIsWaitingForResponse(true) // Start loading animation

    try {
      const supabase = createClient()
      
      // First, save the user message to the log for immediate UI feedback
      await supabase
        .from('instance_logs')
        .insert({
          instance_id: activeRobotInstance.id,
          site_id: activeRobotInstance.site_id,
          log_type: 'user_action',
          level: 'info',
          message: messageToSend,
          details: { 
            user_input: true,
            timestamp: new Date().toISOString(),
            context_summary: contextService.getContextSummary(await contextService.getContextData(selectedContext, currentSite.id))
          }
        })

      // Get complete context data using the service
      const contextData = await contextService.getContextData(selectedContext, currentSite.id)
      
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/robots/instance/act', {
        instance_id: activeRobotInstance.id,
        message: messageToSend,
        context: contextData
      })

      if (!response.success) {
        console.error('Error sending message to robot:', response.error?.message)
        
        // Add error log locally for immediate feedback
        await supabase
          .from('instance_logs')
          .insert({
            instance_id: activeRobotInstance.id,
            site_id: activeRobotInstance.site_id,
            log_type: 'error',
            level: 'error',
            message: `Failed to send message: ${response.error?.message}`,
            details: { 
              error: response.error?.message,
              original_message: messageToSend
            }
          })
      } else {
        console.log('Message sent successfully:', response.data)
        
        // Process the response from instance act API
        // The API returns { message: string, context: object } in the root
        const responseMessage = response.data?.message || response.data
        const responseContext = response.data?.context
        
        if (responseMessage && typeof responseMessage === 'string') {
          // Add the robot's response to the log
          await supabase
            .from('instance_logs')
            .insert({
              instance_id: activeRobotInstance.id,
              site_id: activeRobotInstance.site_id,
              log_type: 'robot_response',
              level: 'info',
              message: responseMessage,
              details: { 
                response_context: responseContext,
                user_input: messageToSend,
                timestamp: new Date().toISOString()
              }
            })
        }
      }
    } catch (error) {
      console.error('Error calling robot API:', error)
      
      // Add error log locally for immediate feedback
      const supabase = createClient()
      await supabase
        .from('instance_logs')
        .insert({
          instance_id: activeRobotInstance.id,
          site_id: activeRobotInstance.site_id,
          log_type: 'error',
          level: 'error',
          message: `Network error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { 
            error: error instanceof Error ? error.message : String(error),
            original_message: messageToSend
          }
        })
    }
    
    // Auto-stop loading animation after 30 seconds
    setTimeout(() => {
      setIsWaitingForResponse(false)
    }, 30000)
  }



  // Show loading skeleton when loading logs
  if (isLoadingLogs) {
    return <MessagesSkeleton />
  }

  return (
    <div className={`flex flex-col h-full max-w-full overflow-hidden relative ${className}`}>


      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-[30px] py-4 space-y-6 max-w-full pb-[175px]">
        {!activeRobotInstance ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {/* Custom fancy empty card without bubbles */}
            <div className="relative">
              <div className="border-dashed bg-card/50 border border-border rounded-lg w-full max-w-md mx-auto shadow-sm">
                <div className="flex flex-col items-center justify-center px-6 pb-0 relative z-[1] min-h-[200px]">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    {/* Hero section with icon */}
                    <div className="flex flex-col items-center space-y-3">
                      <div className="relative z-[2]">
                        {/* Main icon container - fancy style */}
                        <div className="w-16 h-16 mx-auto rounded-lg bg-primary/8 backdrop-blur-sm border border-primary/15 flex items-center justify-center shadow-sm">
                          <div className="text-primary/70 flex items-center justify-center [&>*]:!w-6 [&>*]:!h-6 [&_svg]:!stroke-primary/70 [&_svg]:!fill-primary/70 [&_svg_*]:!stroke-primary/70 [&_svg_*]:!fill-none">
                            <MessageSquare className="h-6 w-6" />
                          </div>
                        </div>
                      </div>
                      
                      <h3 className="text-sm font-medium text-muted-foreground relative z-[2] text-center">
                        No logs yet
                      </h3>
                      
                      <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-md mx-auto relative z-[2] text-center">
                        Instance logs will appear here when a robot is running.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>

            
            {logs.map((log, index) => {
              const toolName = getToolName(log)
              const toolResult = getToolResult(log)
              
              // Simple debug for tool_call entries only
              if (log.log_type === 'tool_call') {
                console.log('🔧 Tool Call:', {
                  id: log.id,
                  resolved_tool_name: toolName,
                  has_tool_result: !!toolResult,
                  has_details: !!log.details
                });
              }
              
              // If this is a tool call with a parent_log_id, render only as gray card section
              if ((log.log_type === 'tool_call' || log.log_type === 'tool_result') && log.parent_log_id) {
                // Special handling for structured_output tools
                if (toolName && toolName.toLowerCase() === 'structured_output') {
                  const structuredOutput = renderStructuredOutput(log)
                  if (structuredOutput) {
                    return (
                      <div key={log.id} className="space-y-2 max-w-full overflow-hidden">
                        {structuredOutput}
                      </div>
                    )
                  }
                }

                // Regular tool call rendering
                return (
                  <div key={log.id} className="space-y-2 max-w-full overflow-hidden">
                    <div 
                      className="text-xs bg-muted p-3 rounded overflow-x-auto cursor-pointer hover:bg-muted/60 hover:shadow-sm transition-all duration-200 border border-transparent hover:border-muted-foreground/20"
                      onClick={() => toggleToolDetails(log.id)}
                    >
                      <div className="flex items-center gap-2">
                        {getToolIcon(toolName || '')}
                        <div className="flex-1 min-w-0">
                          {log.message && (
                            <div className="text-sm leading-relaxed truncate">
                              {log.message}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {!collapsedToolDetails.has(log.id) && (
                        <>
                          {log.screenshot_base64 && (
                            <div className="mt-2 text-muted-foreground">
                              <strong>Screenshot:</strong>
                              <div className="mt-2">
                                <img 
                                  src={formatBase64Image(log.screenshot_base64)} 
                                  alt="Tool Screenshot" 
                                  className="w-full h-auto rounded border shadow-sm"
                                  style={{ maxHeight: '400px' }}
                                />
                              </div>
                            </div>
                          )}
                          {toolResult && Object.keys(toolResult).length > 0 && (
                            <div className="mt-2 text-muted-foreground">
                              <strong>Result:</strong> 
                              <div className="mt-1">
                                {renderObjectWithImages(toolResult)}
                              </div>
                            </div>
                          )}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <div className="mt-3 text-muted-foreground">
                              <div className="flex items-center gap-2 mb-2">
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                                <strong className="text-sm text-blue-600">Details Overview:</strong>
                              </div>
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                {renderObjectWithImages(log.details)}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              }

              return (
              <div key={log.id} className="space-y-4 max-w-full overflow-hidden">
              
              {log.log_type === "user_action" ? (
                // User message - styled like visitor messages in chat
                <div className="flex flex-col w-full items-end group">
                  <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                    <Avatar className="h-7 w-7 border border-amber-500/20">
                      <AvatarImage src="/avatars/visitor-default.png" alt="User" />
                      <AvatarFallback className="bg-amber-500/10 text-amber-600">
                        U
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-amber-600 dark:text-amber-500">User Action</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(new Date(log.created_at))}
                    </span>
                  </div>
                  <div 
                    className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ml-8 max-w-full"
                    style={{ 
                      backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                      border: 'none', 
                      boxShadow: 'none', 
                      outline: 'none',
                      filter: 'none' 
                    }}
                  >
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words whitespace-pre-wrap" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}>
                      {log.message}
                      {toolName && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span><strong>Tool:</strong> {toolName}</span>
                              {(toolName && (
                                (toolResult && Object.keys(toolResult).length > 0) || 
                                (log.details && Object.keys(log.details).length > 0) ||
                                log.screenshot_base64
                              )) && (
                                <button
                                  onClick={() => toggleToolDetails(log.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all duration-200 shadow-sm border border-slate-200/50"
                                  title={collapsedToolDetails.has(log.id) ? "Show details overview" : "Hide details overview"}
                                >
                                  {collapsedToolDetails.has(log.id) ? (
                                    <>
                                      <Eye className="h-3.5 w-3.5" />
                                      <span className="font-medium">Overview</span>
                                    </>
                                  ) : (
                                    <>
                                      <EyeOff className="h-3.5 w-3.5" />
                                      <span className="font-medium">Hide</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {!collapsedToolDetails.has(log.id) && (
                            <>
                              {log.screenshot_base64 && (
                                <div className="mt-2 text-muted-foreground">
                                  <strong>Screenshot:</strong>
                                  <div className="mt-2">
                                    <img 
                                      src={formatBase64Image(log.screenshot_base64)} 
                                      alt="Tool Screenshot" 
                                      className="w-full h-auto rounded border shadow-sm"
                                      style={{ maxHeight: '400px' }}
                                    />
                                  </div>
                                </div>
                              )}
                              {toolResult && Object.keys(toolResult).length > 0 && (
                                <div className="mt-2 text-muted-foreground">
                                  <strong>Result:</strong>
                                  <div className="mt-1">
                                    {renderObjectWithImages(toolResult)}
                                  </div>
                                </div>
                              )}
                              {log.details && Object.keys(log.details).length > 0 && (
                                <div className="mt-3 text-muted-foreground">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Eye className="h-3.5 w-3.5 text-blue-600" />
                                    <strong className="text-sm text-blue-600">Details Overview:</strong>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    {renderObjectWithImages(log.details)}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // System/Agent/Instance message - styled like agent messages in chat
                <div className="flex flex-col w-full items-start group max-w-full">
                  <div className="flex items-center mb-1 gap-2 w-full">
                    <div className="relative">
                      <Avatar className={`h-7 w-7 border ${
                        log.log_type === 'system' ? 'border-blue-500/20' :
                        log.log_type === 'agent_action' ? 'border-primary/20' :
                        log.log_type === 'error' ? 'border-red-500/20' :
                        'border-gray-500/20'
                      }`}>
                        <AvatarFallback className={`${
                          log.log_type === 'system' ? 'bg-blue-500/10 text-blue-600' :
                          log.log_type === 'agent_action' ? 'bg-primary/10 text-primary' :
                          log.log_type === 'error' ? 'bg-red-500/10 text-red-600' :
                          'bg-gray-500/10 text-gray-600'
                        }`}>
                          {log.log_type === 'system' ? 'S' :
                           log.log_type === 'agent_action' ? 'A' :
                           log.log_type === 'error' ? 'E' :
                           log.log_type === 'tool_call' ? 'T' :
                           log.log_type === 'tool_result' ? 'R' : 'I'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className={`text-sm font-medium ${
                      log.log_type === 'system' ? 'text-blue-600' :
                      log.log_type === 'agent_action' ? 'text-primary' :
                      log.log_type === 'error' ? 'text-red-600' :
                      'text-muted-foreground'
                    }`}>
                      {log.log_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.level === 'error' ? 'bg-red-100 text-red-700' :
                      log.level === 'warn' ? 'bg-yellow-100 text-yellow-700' :
                      log.level === 'info' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(new Date(log.created_at))}
                    </span>
                    
                    {/* Collapse button for system messages */}
                    {log.log_type === 'system' && (
                      <button
                        onClick={() => toggleSystemMessageCollapse(log.id)}
                        className="ml-auto p-1 hover:bg-muted rounded transition-colors"
                        title={collapsedSystemMessages.has(log.id) ? "Expand message" : "Collapse message"}
                      >
                        {collapsedSystemMessages.has(log.id) ? (
                          <ChevronRight className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                  
                  {/* Message content - collapsible for system messages */}
                  {!(log.log_type === 'system' && collapsedSystemMessages.has(log.id)) && (
                    <div className="mr-8 w-full max-w-full">
                      <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words whitespace-pre-wrap" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}>
                      {log.message}
                      {toolName && (
                          <div className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span><strong>Tool:</strong> {toolName}</span>
                                {(toolName && (
                                  (toolResult && Object.keys(toolResult).length > 0) || 
                                  (log.details && Object.keys(log.details).length > 0) ||
                                  log.screenshot_base64
                                )) && (
                                  <button
                                    onClick={() => toggleToolDetails(log.id)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all duration-200 shadow-sm border border-slate-200/50"
                                    title={collapsedToolDetails.has(log.id) ? "Show details overview" : "Hide details overview"}
                                  >
                                    {collapsedToolDetails.has(log.id) ? (
                                      <>
                                        <Eye className="h-3.5 w-3.5" />
                                        <span className="font-medium">Overview</span>
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff className="h-3.5 w-3.5" />
                                        <span className="font-medium">Hide</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                            
                                                        {!collapsedToolDetails.has(log.id) && (
                              <>
                                {log.screenshot_base64 && (
                                  <div className="mt-2 text-muted-foreground">
                                    <strong>Screenshot:</strong>
                                    <div className="mt-2">
                                      <img 
                                        src={formatBase64Image(log.screenshot_base64)} 
                                        alt="Tool Screenshot" 
                                        className="w-full h-auto rounded border shadow-sm"
                                        style={{ maxHeight: '400px' }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {toolResult && Object.keys(toolResult).length > 0 && (
                                  <div className="mt-2 text-muted-foreground">
                                    <strong>Result:</strong> 
                                    <div className="mt-1">
                                      {renderObjectWithImages(toolResult)}
                                    </div>
                                  </div>
                                )}
                                {log.details && Object.keys(log.details).length > 0 && (
                                  <div className="mt-3 text-muted-foreground">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                                      <strong className="text-sm text-blue-600">Details Overview:</strong>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                      {renderObjectWithImages(log.details)}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                    </div>
                        )}
                  </div>
                </div>
              )}
                  
                  {/* Collapsed preview for system messages */}
                  {log.log_type === 'system' && collapsedSystemMessages.has(log.id) && (
                    <div className="mr-8 w-full max-w-full">
                      <div className="text-sm text-muted-foreground italic truncate">
                        {log.message.substring(0, 100)}...
            </div>
                    </div>
                  )}
                </div>
              )}
              </div>
              )
            })}
            
            {/* Loading indicator when waiting for response */}
            {isWaitingForResponse && (
              <div className="flex flex-col w-full items-start group max-w-full">
                <div className="flex items-center mb-1 gap-2 w-full">
                  <div className="relative">
                    <Avatar className="h-7 w-7 border border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        A
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <span className="text-sm font-medium text-primary">Robot</span>
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    thinking
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(new Date())}
                  </span>
                </div>
                
                {/* Loading message content */}
                <div className="mr-8 w-full max-w-full">
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words whitespace-pre-wrap bg-background/50 rounded-lg p-4 border border-dashed border-primary/20">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm">Robot is thinking...</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-2 mb-0">
                      Processing your request and preparing a response
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Extra padding to avoid floating step indicator overlap */}
        <div className="pb-48"></div>
        
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Step Indicator - Expandable */}
      {steps.length > 0 && (
        <div className="absolute bottom-[175px] md:bottom-[180px] left-0 right-0 z-[5] transition-all duration-500 ease-in-out">
          <div className="px-[30px]">
            <div className={`backdrop-blur-sm border rounded-lg shadow-lg transition-all duration-500 ${
              areAllStepsCompleted() ? 'bg-green-50/95 border-green-200' : 'bg-background/95 border-border'
            }`} style={{
              marginLeft: '5px',
              marginRight: '5px',
              padding: '0.5rem 0.75rem'
            }}>
              {isStepIndicatorExpanded ? (
                <div className="space-y-2">
                  {/* Current step header */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      areAllStepsCompleted() ? 'bg-green-500' :
                      getCurrentStep()?.status === 'in_progress' ? 'bg-primary animate-pulse' : 
                      getCurrentStep()?.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/60'
                    }`}></div>
                    {areAllStepsCompleted() ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium whitespace-nowrap text-green-600">All steps completed!</span>
                        <span className="text-xs text-green-600/70">Back to step 1</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium whitespace-nowrap">Step {getCurrentStep()?.order || 1} of {steps.length}</span>
                        <span className="text-xs truncate">- {getCurrentStep()?.title}</span>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsStepIndicatorExpanded(false)}
                      className="h-6 w-6 p-0 ml-auto hover:bg-muted"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-border"></div>
                  
                  {/* All steps list */}
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {steps.map((step) => {
                      const canEdit = canEditOrDeleteStep(step)
                      const allCompleted = areAllStepsCompleted()
                      
                      return (
                        <div 
                          key={step.id} 
                          className={`group flex items-center gap-2 text-sm transition-all duration-200 py-1 rounded px-1 -mx-1 ${
                            canEdit ? 'hover:text-primary cursor-pointer hover:bg-muted/20' : 
                            'cursor-not-allowed opacity-75'
                          }`}
                          onClick={() => canEdit ? openEditModal(step) : null}
                          title={!canEdit ? 'Completed steps cannot be edited' : 'Click to edit'}
                        >
                          <div 
                            className={`w-2 h-2 rounded-full flex-shrink-0 cursor-pointer ${
                              step.status === 'in_progress' ? 'bg-primary animate-pulse' : 
                              step.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/60'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleStepStatus(step.id)
                            }}
                            title="Click to change status"
                          ></div>
                          <span className={`font-medium ${step.status === 'completed' ? 'text-green-600' : step.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.order}.
                          </span>
                          <div className="flex-1 min-w-0 mr-2 overflow-hidden">
                            <div className="truncate">
                              <span className={`${step.status === 'completed' ? 'text-green-600 line-through' : step.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {step.title}
                                {step.description && (
                                  <span className="text-xs text-muted-foreground/60 ml-1">
                                    - {step.description}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          {/* Delete button only for non-completed steps */}
                          {canEdit && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteStep(step.id)
                                }}
                                className="h-4 w-4 p-0 hover:bg-red-100 hover:text-red-600"
                                title="Delete step"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          )}
                          
                          {/* Show lock icon for completed steps */}
                          {!canEdit && (
                            <div className="opacity-50">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            </div>
                          )}
                        </div>
                      )
                    })}

                  </div>
                </div>
              ) : steps.length > 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    areAllStepsCompleted() ? 'bg-green-500' :
                    getCurrentStep()?.status === 'in_progress' ? 'bg-primary animate-pulse' : 
                    getCurrentStep()?.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/60'
                  }`}></div>
                  {areAllStepsCompleted() ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium whitespace-nowrap text-green-600">All steps completed!</span>
                      <span className="text-xs text-green-600/70">Back to step 1</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium whitespace-nowrap">Step {getCurrentStep()?.order || 1} of {steps.length}</span>
                      <span className="text-xs truncate">- {getCurrentStep()?.title}</span>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsStepIndicatorExpanded(true)}
                    className="h-6 w-6 p-0 ml-auto hover:bg-muted"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
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
      )}

      {/* Message input area - styled exactly like ChatInput */}
      <div className="absolute bottom-4 left-0 right-0 flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-[20]">
        <div className="px-[30px]">
          <form className="relative" onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}>
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={activeRobotInstance ? "Message..." : "No active robot instance"}
                className="resize-none min-h-[135px] w-full py-5 pl-[30px] pr-[30px] rounded-2xl border border-input bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
                disabled={!activeRobotInstance}
                style={{
                  lineHeight: '1.5',
                  overflowY: 'hidden',
                  wordWrap: 'break-word',
                  paddingBottom: '50px',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  height: '135px'
                }}
              />
              
              {/* Context selector button in bottom left */}
              <div className="absolute bottom-[15px] left-[15px] z-50">
                <ContextSelectorModal 
                  selectedContext={selectedContext}
                  onContextChange={setSelectedContext}
                />
              </div>
              
              {/* Send button on the right */}
              <div className="absolute bottom-[15px] right-[15px]" style={{ zIndex: 51 }}>
                <Button 
                  type="submit" 
                  size="icon"
                  variant="ghost"
                  disabled={!activeRobotInstance || !message.trim()}
                  className={`rounded-xl h-[39px] w-[39px] transition-colors hover:bg-muted ${
                    activeRobotInstance && message.trim() 
                      ? 'text-primary hover:text-primary/90 opacity-100' 
                      : 'text-muted-foreground opacity-50'
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                  <span className="sr-only">Send</span>
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Step Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Step</DialogTitle>
            <DialogDescription>
              Modify the step title and description. Press Escape or click Cancel to discard changes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="col-span-3"
                placeholder="Enter step title..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    saveStep()
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right mt-2">
                Description
              </Label>
              <textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="col-span-3 min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Describe what this step involves..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault()
                    saveStep()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>
              Cancel
            </Button>
            <Button onClick={saveStep} disabled={!editTitle.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}