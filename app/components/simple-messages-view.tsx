"use client"

import { MessageSquare, User, Settings, ChevronRight, Clock, CheckCircle, AlertCircle, Target, ListTodo, ChevronDown, ChevronUp, Pencil, Save, X, FileText } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { MessagesSkeleton } from "@/app/components/skeletons/messages-skeleton"
import { useTheme } from "@/app/context/ThemeContext"
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef } from 'react'

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
}

interface InstancePlan {
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
}

export function SimpleMessagesView({ className = "", activeRobotInstance }: SimpleMessagesViewProps) {
  const { isDarkMode } = useTheme()
  const [logs, setLogs] = useState<InstanceLog[]>([])
  const [plans, setPlans] = useState<InstancePlan[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Plan UI states
  const [collapsedPlans, setCollapsedPlans] = useState<Set<string>>(new Set())
  const [editingPlans, setEditingPlans] = useState<Set<string>>(new Set())
  const [editingValues, setEditingValues] = useState<{[key: string]: {title: string, description: string}}>({})
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto scroll when logs change
  useEffect(() => {
    scrollToBottom()
  }, [logs])

  // Initialize all plans as collapsed when they first load
  useEffect(() => {
    if (plans.length > 0) {
      const newCollapsedPlans = new Set(plans.map(plan => plan.id))
      setCollapsedPlans(newCollapsedPlans)
    }
  }, [plans.length])

  // Functions for plan UI management
  const togglePlanCollapse = (planId: string) => {
    setCollapsedPlans(prev => {
      const newSet = new Set(prev)
      if (newSet.has(planId)) {
        newSet.delete(planId)
      } else {
        newSet.add(planId)
      }
      return newSet
    })
  }

  const startEditingPlan = (plan: InstancePlan) => {
    setEditingPlans(prev => new Set(prev).add(plan.id))
    setEditingValues(prev => ({
      ...prev,
      [plan.id]: {
        title: plan.title,
        description: plan.description || ''
      }
    }))
  }

  const cancelEditingPlan = (planId: string) => {
    setEditingPlans(prev => {
      const newSet = new Set(prev)
      newSet.delete(planId)
      return newSet
    })
    setEditingValues(prev => {
      const newValues = { ...prev }
      delete newValues[planId]
      return newValues
    })
  }

  const savePlanEdit = async (planId: string) => {
    const editValues = editingValues[planId]
    if (!editValues || !activeRobotInstance) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('instance_plans')
        .update({
          title: editValues.title.trim(),
          description: editValues.description.trim() || null
        })
        .eq('id', planId)

      if (error) {
        console.error('Error updating plan:', error)
      } else {
        // Update local state
        setPlans(prevPlans => 
          prevPlans.map(plan => 
            plan.id === planId 
              ? { ...plan, title: editValues.title.trim(), description: editValues.description.trim() || undefined }
              : plan
          )
        )
        
        // Exit editing mode
        cancelEditingPlan(planId)
      }
    } catch (error) {
      console.error('Error saving plan edit:', error)
    }
  }

  const updateEditingValue = (planId: string, field: 'title' | 'description', value: string) => {
    setEditingValues(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value
      }
    }))
  }

  // Load instance logs
  const loadInstanceLogs = async () => {
    if (!activeRobotInstance?.id) {
      setLogs([])
      return
    }

    setIsLoadingLogs(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('instance_logs')
        .select('id, log_type, level, message, details, created_at, tool_name, tool_result')
        .eq('instance_id', activeRobotInstance.id)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading instance logs:', error)
        setLogs([])
      } else {
        setLogs(data || [])
      }
    } catch (error) {
      console.error('Error loading instance logs:', error)
      setLogs([])
    } finally {
      setIsLoadingLogs(false)
    }
  }

  // Load instance plans
  const loadInstancePlans = async () => {
    if (!activeRobotInstance?.id) {
      setPlans([])
      return
    }

    setIsLoadingPlans(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('instance_plans')
        .select('id, title, description, plan_type, status, instructions, expected_output, progress_percentage, steps_completed, steps_total, priority, created_at')
        .eq('instance_id', activeRobotInstance.id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading instance plans:', error)
        setPlans([])
      } else {
        setPlans(data || [])
      }
    } catch (error) {
      console.error('Error loading instance plans:', error)
      setPlans([])
    } finally {
      setIsLoadingPlans(false)
    }
  }

  // Load data when activeRobotInstance changes and setup real-time subscriptions
  useEffect(() => {
    if (activeRobotInstance?.id) {
      loadInstanceLogs()
      loadInstancePlans()

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
          (payload) => {
            console.log('Real-time log update:', payload)
            if (payload.eventType === 'INSERT') {
              setLogs(prevLogs => [...prevLogs, payload.new as InstanceLog])
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
          (payload) => {
            console.log('Real-time plan update:', payload)
            if (payload.eventType === 'INSERT') {
              setPlans(prevPlans => {
                const newPlans = [...prevPlans, payload.new as InstancePlan]
                return newPlans.sort((a, b) => {
                  if (a.priority !== b.priority) {
                    return b.priority - a.priority // Higher priority first
                  }
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })
              })
            } else if (payload.eventType === 'UPDATE') {
              setPlans(prevPlans => {
                const updatedPlans = prevPlans.map(plan => 
                  plan.id === payload.new.id ? payload.new as InstancePlan : plan
                )
                return updatedPlans.sort((a, b) => {
                  if (a.priority !== b.priority) {
                    return b.priority - a.priority // Higher priority first
                  }
                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })
              })
            } else if (payload.eventType === 'DELETE') {
              setPlans(prevPlans => 
                prevPlans.filter(plan => plan.id !== payload.old.id)
              )
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
      setPlans([])
    }
  }, [activeRobotInstance?.id])

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!activeRobotInstance?.id || !message.trim()) return

    const messageToSend = message.trim()
    setMessage('') // Clear immediately for better UX

    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/robots/instance/act', {
        instance_id: activeRobotInstance.id,
        message: messageToSend
      })

      if (!response.success) {
        console.error('Error sending message to robot:', response.error?.message)
        
        // Add error log locally for immediate feedback
        const supabase = createClient()
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
          message: `Network error sending message: ${error.message}`,
          details: { 
            error: error.message,
            original_message: messageToSend
          }
        })
    }
  }

  // Get status icon for plan
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'blocked': return <AlertCircle className="h-4 w-4 text-orange-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  // Get plan type icon
  const getPlanTypeIcon = (type: string) => {
    switch (type) {
      case 'objective': return <Target className="h-4 w-4 text-purple-500" />
      case 'task': return <ListTodo className="h-4 w-4 text-blue-500" />
      case 'verification': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'milestone': return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default: return <ListTodo className="h-4 w-4 text-gray-500" />
    }
  }

  // Show loading skeleton when loading logs or plans
  if (isLoadingLogs || isLoadingPlans) {
    return <MessagesSkeleton />
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Instance Plan Section - shown at top when available */}
      {plans.length > 0 && (
        <div className="flex-none border-b border-border">
          <div className="p-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {plans.map((plan) => {
                const isCollapsed = collapsedPlans.has(plan.id)
                const isEditing = editingPlans.has(plan.id)
                const editValues = editingValues[plan.id]
                
                return (
                  <div key={plan.id} className="bg-muted/50 rounded-lg border border-muted/30 hover:border-muted/50 transition-colors">
                    {/* Plan Header - Always Visible */}
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {/* Collapse/Expand Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={() => togglePlanCollapse(plan.id)}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                          
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {plan.plan_type} • {plan.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground font-medium">
                            {plan.progress_percentage}%
                          </div>
                          {getStatusIcon(plan.status)}
                        </div>
                      </div>

                      {/* Plan Title Section */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0" style={{ width: '36px', height: '36px' }}>
                          {getPlanTypeIcon(plan.plan_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-1">Plan Title</p>
                          {isEditing ? (
                            <Input
                              type="text"
                              value={editValues?.title || ''}
                              onChange={(e) => updateEditingValue(plan.id, 'title', e.target.value)}
                              className="h-9 text-sm font-medium"
                              placeholder="Plan title..."
                            />
                          ) : (
                            <div className="flex items-center justify-between min-w-0">
                              <h4 className="text-sm font-medium text-foreground truncate flex-1 mr-2">{plan.title}</h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-muted text-muted-foreground hover:text-foreground flex-shrink-0"
                                onClick={() => startEditingPlan(plan)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Edit Controls - when editing */}
                      {isEditing && (
                        <div className="flex justify-end gap-2 mb-3 pb-3 border-b border-muted/30">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelEditingPlan(plan.id)}
                            className="h-8"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => savePlanEdit(plan.id)}
                            className="h-8"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                        </div>
                      )}
                      
                      {/* Progress bar - always visible */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${plan.progress_percentage}%` }}
                        ></div>
                      </div>
                      
                      {/* Steps counter */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                        <span>{plan.steps_completed}/{plan.steps_total} steps completed</span>
                        <span>{plan.progress_percentage}% progress</span>
                      </div>
                    </div>
                    
                    {/* Plan Details - Collapsible */}
                    {!isCollapsed && (
                      <div className="border-t border-muted/30 p-3 space-y-4">
                        {/* Description Section */}
                        <div className="flex items-start gap-3">
                          <div className="bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0 mt-1" style={{ width: '32px', height: '32px' }}>
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <textarea
                                value={editValues?.description || ''}
                                onChange={(e) => updateEditingValue(plan.id, 'description', e.target.value)}
                                className="w-full min-h-[60px] text-sm border border-input rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Plan description..."
                                rows={2}
                              />
                            ) : (
                              <div className="text-sm text-foreground">
                                {plan.description ? (
                                  <p className="whitespace-pre-wrap">{plan.description}</p>
                                ) : (
                                  <span className="text-muted-foreground italic">No description provided</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Instructions Section */}
                        {plan.instructions && (
                          <div className="flex items-start gap-3">
                            <div className="bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0" style={{ width: '36px', height: '36px' }}>
                              <ListTodo className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-muted-foreground mb-1">Instructions</p>
                              <div className="text-sm text-foreground bg-muted/30 rounded-md p-3">
                                <p className="whitespace-pre-wrap">{plan.instructions}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
          logs.map((log, index) => (
            <div key={log.id} className="space-y-4">
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
                    className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ml-8"
                    style={{ 
                      backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                      border: 'none', 
                      boxShadow: 'none', 
                      outline: 'none',
                      filter: 'none' 
                    }}
                  >
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words word-wrap hyphens-auto" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {log.message}
                      {log.tool_name && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded">
                          <strong>Tool:</strong> {log.tool_name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // System/Agent/Instance message - styled like agent messages in chat
                <div className="flex flex-col w-full items-start group">
                  <div className="flex items-center mb-1 gap-2">
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
                  </div>
                  <div className="mr-8">
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words word-wrap hyphens-auto" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      {log.message}
                      {log.tool_name && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded">
                          <strong>Tool:</strong> {log.tool_name}
                          {log.tool_result && (
                            <div className="mt-1 text-muted-foreground">
                              <strong>Result:</strong> {JSON.stringify(log.tool_result, null, 2)}
                            </div>
                          )}
                        </div>
                      )}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 text-xs bg-muted p-2 rounded">
                          <strong>Details:</strong>
                          <pre className="mt-1 text-muted-foreground">{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input area - styled like ChatInput */}
      <div className="flex-none">
        <div className="px-4 pb-4">
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
                placeholder={activeRobotInstance ? "Send a message to the robot instance... (Enter to send, Shift+Enter for new line)" : "No active robot instance"}
                className="resize-none min-h-[135px] w-full py-5 pl-[50px] pr-[50px] rounded-2xl border border-input bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
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
              
              {/* Send button on the right */}
              <div className="absolute bottom-[15px] right-[15px]">
                <Button 
                  type="submit" 
                  size="icon"
                  variant="ghost"
                  disabled={!activeRobotInstance || !message.trim()}
                  className={`rounded-xl h-[39px] w-[39px] transition-colors ${
                    activeRobotInstance && message.trim() 
                      ? 'text-primary hover:text-primary/90 hover:bg-muted' 
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
    </div>
  )
}