import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InstanceLog } from '../types'

interface UseInstanceLogsProps {
  activeRobotInstance?: any
  waitingForMessageId?: string | null
  onScrollToBottom?: () => void
  onResponseReceived?: () => void
  currentSiteId?: string | null
}

export const useInstanceLogs = ({
  activeRobotInstance,
  waitingForMessageId,
  onScrollToBottom,
  onResponseReceived,
  currentSiteId
}: UseInstanceLogsProps) => {
  const [logs, setLogs] = useState<InstanceLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<string>>(new Set())
  const [collapsedToolDetails, setCollapsedToolDetails] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const currentRobotInstanceIdRef = useRef<string | null>(null)
  const prevSiteIdRef = useRef<string | null>(null)

  // Clear logs when site changes
  useEffect(() => {
    if (currentSiteId && currentSiteId !== prevSiteIdRef.current) {
      console.log('🔄 [useInstanceLogs] Site changed, clearing logs for new site:', currentSiteId)
      setLogs([])
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
      setDebugInfo(null)
      prevSiteIdRef.current = currentSiteId
    }
  }, [currentSiteId])

  // Load instance logs
  const loadInstanceLogs = async () => {
    if (!activeRobotInstance?.id) {
      console.log('❌ No active robot instance ID, clearing logs')
      setLogs([])
      return
    }

    const instanceId = activeRobotInstance.id
    console.log('🚀 Loading logs for instance:', {
      instanceId: instanceId,
      instanceName: activeRobotInstance.name,
      instanceStatus: activeRobotInstance.status
    })

    // For uninstantiated instances, still try to load logs to see if they have any
    if (activeRobotInstance.status === 'uninstantiated') {
      console.log('⚠️ Instance is uninstantiated, but checking for existing logs')
    }

    setIsLoadingLogs(true)
    try {
      const supabase = createClient()
      
      console.log('🔍 Building Supabase query for instance_logs with instanceId:', instanceId)
      
      const { data, error, count } = await supabase
        .from('instance_logs')
        .select('*', { count: 'exact' })
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading instance logs:', error)
        setLogs([])
      } else {
        console.log(`Loaded ${data?.length || 0} logs for instance ${activeRobotInstance.id}. Total count: ${count}`)
        console.log('🔍 Raw logs data:', data)
        const logs = data || []
        setLogs(logs)
        
        // Special debug for uninstantiated instances
        if (activeRobotInstance.status === 'uninstantiated') {
          console.log('🔍 Uninstantiated instance logs debug:', {
            instanceId: activeRobotInstance.id,
            logsCount: logs.length,
            logs: logs.map((log: any) => ({ id: log.id, log_type: log.log_type, message: log.message?.substring(0, 50) + '...' }))
          })
        }
        // Scroll to bottom after logs are loaded
        setTimeout(() => onScrollToBottom?.(), 200)
        
        // Auto-collapse long system messages (>200 characters)
        const longSystemMessages = logs
          .filter((log: InstanceLog) => log.log_type === 'system' && log.message.length > 200)
          .map((log: InstanceLog) => log.id)
        
        if (longSystemMessages.length > 0) {
          setCollapsedSystemMessages(new Set(longSystemMessages))
        }

        // Auto-collapse ALL tool calls by default (any log with tool_name or toolName)
        const logsWithToolDetails = logs
          .filter((log: InstanceLog) => {
            const hasToolName = log.tool_name || log.toolName
            const isToolCall = log.log_type === 'tool_call' || log.log_type === 'tool_result'
            const hasToolResult = log.tool_result && Object.keys(log.tool_result).length > 0
            const hasDetails = log.details && Object.keys(log.details).length > 0
            const hasScreenshot = log.screenshot_base64
            
            return (hasToolName || isToolCall) && (hasToolResult || hasDetails || hasScreenshot)
          })
          .map((log: InstanceLog) => log.id)
        
        console.log('🔧 Auto-collapsing tool details for logs:', logsWithToolDetails)
        console.log('🔧 Logs with tool details:', logs.filter((log: any) => {
          const hasToolResult = log.tool_result && Object.keys(log.tool_result).length > 0
          const hasDetails = log.details && Object.keys(log.details).length > 0
          const hasScreenshot = log.screenshot_base64
          const hasToolName = log.tool_name || log.toolName
          return hasToolResult || hasDetails || hasScreenshot || hasToolName
        }))
        
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

  // Add optimistic user message to logs
  const addOptimisticUserMessage = useCallback((message: string) => {
    const tempLog: InstanceLog = {
      id: `temp-${Date.now()}`,
      log_type: 'user_action',
      level: 'info',
      message: message,
      created_at: new Date().toISOString(),
      details: { temp_message: true }
    }
    
    console.log('📝 Adding optimistic user message:', tempLog.id)
    setLogs(prevLogs => [...prevLogs, tempLog])
  }, [activeRobotInstance?.id])

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

  // Load data when activeRobotInstance changes and setup real-time subscriptions
  useEffect(() => {
    if (activeRobotInstance?.id) {
      const newInstanceId = activeRobotInstance.id
      
      // Always load logs when there's an active instance, even if it's the same instance
      // This ensures logs are loaded when switching back from New Makina
      if (currentRobotInstanceIdRef.current !== newInstanceId) {
        console.log('🔄 Robot instance changed, reloading data:', { 
          from: currentRobotInstanceIdRef.current, 
          to: newInstanceId 
        })
        currentRobotInstanceIdRef.current = newInstanceId
        
        // Clear existing state when switching to a new robot instance
        setLogs([])
        setCollapsedSystemMessages(new Set())
        setCollapsedToolDetails(new Set())
      } else {
        console.log('🔄 Same robot instance, ensuring logs are loaded:', newInstanceId)
      }
      
      // Always load logs when there's an active instance
      loadInstanceLogs()
      // Scroll to bottom when switching to instance
      setTimeout(() => onScrollToBottom?.(), 300)

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
              
              setLogs(prevLogs => {
                // If this is a user_action message, replace any temporary message with the same content
                if (newLog.log_type === 'user_action') {
                  const tempMessageIndex = prevLogs.findIndex(log => 
                    log.details?.temp_message && 
                    log.message === newLog.message &&
                    log.log_type === 'user_action'
                  )
                  
                  if (tempMessageIndex !== -1) {
                    console.log('🔄 Replacing temporary user message with real one')
                    // Remove the temp message ID from tracking
                    const tempId = prevLogs[tempMessageIndex].id
                    // Note: Recent user message IDs tracking removed to avoid circular dependencies
                    
                    // Replace the temporary message with the real one
                    const updatedLogs = [...prevLogs]
                    updatedLogs[tempMessageIndex] = newLog
                    return updatedLogs
                  }
                }
                
                // Double-check for duplicates by ID
                const isDuplicate = prevLogs.some(log => log.id === newLog.id)
                if (isDuplicate) {
                  console.log('🚫 Preventing duplicate log entry:', newLog.id)
                  return prevLogs
                }
                
                return [...prevLogs, newLog]
              })
              
              // Stop loading animation when we get any response after sending a message
              if (waitingForMessageId) {
                // Check for various indicators that this is a response to our sent message
                const isResponseToOurMessage = (
                  // Agent action that might be responding to our message
                  (newLog.log_type === 'agent_action') ||
                  // Tool result that indicates processing
                  (newLog.log_type === 'tool_result') ||
                  // System message that indicates processing
                  (newLog.log_type === 'system' && (
                    newLog.message.toLowerCase().includes('processing') ||
                    newLog.message.toLowerCase().includes('received') ||
                    newLog.message.toLowerCase().includes('completed') ||
                    newLog.message.toLowerCase().includes('response') ||
                    newLog.message.toLowerCase().includes('answer')
                  )) ||
                  // Any log that indicates the system is responding
                  (newLog.log_type === 'system' && newLog.message.length > 10) ||
                  // Any log that's not a user action (indicating system response)
                  (newLog.log_type !== 'user_action' && newLog.message.length > 5)
                )
                
                if (isResponseToOurMessage) {
                  // Additional check: make sure this log is recent (within 1 minute of sending)
                  const timeDiff = new Date(newLog.created_at).getTime() - new Date().getTime()
                  if (Math.abs(timeDiff) < 60000) { // Within 1 minute
                    console.log('🔄 Received response to our message, clearing thinking state')
                    // Clear thinking state by calling the callback
                    onResponseReceived?.()
                  }
                }
              } else {
                // If we're not waiting for a specific message but we're in thinking state,
                // clear it when we get any new log that's not a user action
                if (newLog.log_type !== 'user_action' && newLog.message.length > 5) {
                  console.log('🔄 Received new log, clearing thinking state')
                  onResponseReceived?.()
                }
              }
              
              // Auto-collapse if it's a long system message
              if (newLog.log_type === 'system' && newLog.message.length > 200) {
                setCollapsedSystemMessages(prev => new Set(prev).add(newLog.id))
              }
              
              // Auto-collapse tool calls that have details by default
              const hasToolName = newLog.tool_name || newLog.toolName
              const isToolCall = newLog.log_type === 'tool_call' || newLog.log_type === 'tool_result'
              const hasToolResult = newLog.tool_result && Object.keys(newLog.tool_result).length > 0
              const hasDetails = newLog.details && Object.keys(newLog.details).length > 0
              const hasScreenshot = newLog.screenshot_base64
              
              if ((hasToolName || isToolCall) && (hasToolResult || hasDetails || hasScreenshot)) {
                console.log('🔧 Auto-collapsing new tool log:', newLog.id, { hasToolName, isToolCall, hasToolResult, hasDetails, hasScreenshot, logType: newLog.log_type })
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

      return () => {
        logsSubscription.unsubscribe()
      }
    } else {
      // Clear logs when no active instance
      setLogs([])
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
    }
  }, [activeRobotInstance?.id, waitingForMessageId])

  return {
    logs,
    isLoadingLogs,
    collapsedSystemMessages,
    collapsedToolDetails,
    debugInfo,
    loadInstanceLogs,
    addOptimisticUserMessage,
    toggleSystemMessageCollapse,
    toggleAllSystemMessages,
    toggleToolDetails,
    toggleAllToolDetails
  }
}
