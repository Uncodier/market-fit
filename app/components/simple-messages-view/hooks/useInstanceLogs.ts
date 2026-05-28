import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InstanceLog } from '../types'

interface UseInstanceLogsProps {
  activeRobotInstance?: any
  waitingForMessageId?: string | null
  onScrollToBottom?: () => void
  onScrollToBottomImmediate?: () => void
  onResponseReceived?: () => void
  currentSiteId?: string | null
}

export const useInstanceLogs = ({
  activeRobotInstance,
  waitingForMessageId,
  onScrollToBottom,
  onScrollToBottomImmediate,
  onResponseReceived,
  currentSiteId
}: UseInstanceLogsProps) => {
  const [logs, setLogs] = useState<InstanceLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [hasMoreLogs, setHasMoreLogs] = useState(true)
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<string>>(new Set())
  const [collapsedToolDetails, setCollapsedToolDetails] = useState<Set<string>>(new Set())
  const [expandedToolGroups, setExpandedToolGroups] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const currentRobotInstanceIdRef = useRef<string | null>(null)
  const prevSiteIdRef = useRef<string | null>(null)

  // Clear logs when site changes
  useEffect(() => {
    if (currentSiteId && currentSiteId !== prevSiteIdRef.current) {
      setLogs([])
      setHasMoreLogs(true)
      setIsLoadingMore(false)
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
      setExpandedToolGroups(new Set())
      setDebugInfo(null)
      prevSiteIdRef.current = currentSiteId
    }
  }, [currentSiteId])

  // Load instance logs
  const loadInstanceLogs = async () => {
    if (!activeRobotInstance?.id) {
      setLogs([])
      return
    }

    // Always clear logs when switching instances to avoid showing old instance's logs
    if (activeRobotInstance.id !== currentRobotInstanceIdRef.current) {
      setLogs([])
      setHasMoreLogs(true)
      setIsLoadingMore(false)
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
      setExpandedToolGroups(new Set())
      setDebugInfo(null)
      currentRobotInstanceIdRef.current = activeRobotInstance.id
    }

    const instanceId = activeRobotInstance.id

    // For uninstantiated instances, still try to load logs to see if they have any
    if (activeRobotInstance.status === 'uninstantiated') {
    }

    setIsLoadingLogs(true)
    
    const maxRetries = 3
    let attempt = 0
    let success = false
    
    while (attempt < maxRetries && !success) {
      try {
        const supabase = createClient()
        
        // Load latest messages first (descending order) and limit to 100 for performance
        const { data, error } = await supabase
          .from('instance_logs')
          .select('*')
          .eq('instance_id', instanceId)
          .order('created_at', { ascending: false })
          .limit(100)

        if (error) {
          console.error(`Error loading instance logs (attempt ${attempt + 1}/${maxRetries}):`, error)
          attempt++
          if (attempt >= maxRetries) {
            setLogs([])
          } else {
            // Esperar antes de reintentar (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
          }
        } else {
          success = true
          // Reverse the array to maintain chronological order (oldest first, newest last)
          // since we loaded them in descending order (newest first)
          const fetchedLogs = (data || []).reverse()
          setLogs(fetchedLogs)
          setHasMoreLogs(fetchedLogs.length === 100)
          
          // Scroll to bottom after React renders the new logs
          // setTimeout gives React time to commit the state update and the browser to lay out
          setTimeout(() => {
            if (onScrollToBottomImmediate) {
              onScrollToBottomImmediate()
            } else {
              onScrollToBottom?.()
            }
          }, 100)
          
          // Auto-collapse long system messages (>200 characters)
          const longSystemMessages = fetchedLogs
            .filter((log: InstanceLog) => log.log_type === 'system' && log.message.length > 200)
            .map((log: InstanceLog) => log.id)
          
          if (longSystemMessages.length > 0) {
            setCollapsedSystemMessages(new Set(longSystemMessages))
          }

          // Auto-collapse ALL tool calls by default (any log with tool_name or toolName)
          const logsWithToolDetails = fetchedLogs
            .filter((log: InstanceLog) => {
              const hasToolName = log.tool_name || log.toolName
              const isToolCall = log.log_type === 'tool_call' || log.log_type === 'tool_result'
              const hasToolResult = log.tool_result && Object.keys(log.tool_result).length > 0
              const hasDetails = log.details && Object.keys(log.details).length > 0
              const hasScreenshot = log.screenshot_base64
              
              return (hasToolName || isToolCall) && (hasToolResult || hasDetails || hasScreenshot)
            })
            .map((log: InstanceLog) => log.id)
          
          if (logsWithToolDetails.length > 0) {
            setCollapsedToolDetails(new Set(logsWithToolDetails))
          }
          
          // If no logs found, let's check if there are any logs in the table at all
          if (!data || data.length === 0) {
            try {
              const { data: allLogs, error: allLogsError } = await supabase
                .from('instance_logs')
                .select('instance_id, log_type, level, created_at')
                .limit(5)
              
              
              setDebugInfo({
                instanceId: activeRobotInstance.id,
                logsFound: data?.length || 0,
                totalLogsInTable: 0, // We no longer count all logs for performance
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
        console.error(`Error loading instance logs (attempt ${attempt + 1}/${maxRetries}):`, error)
        attempt++
        if (attempt >= maxRetries) {
          setLogs([])
        } else {
          // Esperar antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
        }
      }
    }
    
    setIsLoadingLogs(false)
  }

  // Load older logs on demand
  const loadMoreLogs = useCallback(async () => {
    if (!activeRobotInstance?.id || isLoadingMoreRef.current || !hasMoreLogs || logs.length === 0) {
      return
    }

    setIsLoadingMore(true)
    isLoadingMoreRef.current = true
    const instanceId = activeRobotInstance.id
    // The oldest log we currently have
    const oldestLogTime = logs[0].created_at

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('instance_logs')
        .select('*')
        .eq('instance_id', instanceId)
        .lt('created_at', oldestLogTime) // strictly older
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error loading more logs:', error)
      } else {
        const fetchedLogs = (data || []).reverse()
        setHasMoreLogs(fetchedLogs.length === 100)
        
        if (fetchedLogs.length > 0) {
          setLogs(prevLogs => [...fetchedLogs, ...prevLogs])
          
          // Auto-collapse logic for newly fetched logs
          const longSystemMessages = fetchedLogs
            .filter((log: InstanceLog) => log.log_type === 'system' && log.message.length > 200)
            .map((log: InstanceLog) => log.id)
          
          if (longSystemMessages.length > 0) {
            setCollapsedSystemMessages(prev => new Set([...Array.from(prev), ...longSystemMessages]))
          }

          const logsWithToolDetails = fetchedLogs
            .filter((log: InstanceLog) => {
              const hasToolName = log.tool_name || log.toolName
              const isToolCall = log.log_type === 'tool_call' || log.log_type === 'tool_result'
              const hasToolResult = log.tool_result && Object.keys(log.tool_result).length > 0
              const hasDetails = log.details && Object.keys(log.details).length > 0
              const hasScreenshot = log.screenshot_base64
              
              return (hasToolName || isToolCall) && (hasToolResult || hasDetails || hasScreenshot)
            })
            .map((log: InstanceLog) => log.id)
          
          if (logsWithToolDetails.length > 0) {
            setCollapsedToolDetails(prev => new Set([...Array.from(prev), ...logsWithToolDetails]))
          }
        }
      }
    } catch (error) {
      console.error('Error in loadMoreLogs:', error)
    } finally {
      setIsLoadingMore(false)
      isLoadingMoreRef.current = false
    }
  }, [activeRobotInstance?.id, hasMoreLogs, logs])

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

  // Toggle tool group expand/collapse
  const toggleToolGroup = (groupId: string) => {
    setExpandedToolGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
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
        currentRobotInstanceIdRef.current = newInstanceId
        
        // Clear existing state when switching to a new robot instance
        setLogs([])
        setCollapsedSystemMessages(new Set())
        setCollapsedToolDetails(new Set())
        setExpandedToolGroups(new Set())
      }
      
      // Always load logs when there's an active instance
      loadInstanceLogs()

      const supabase = createClient()
      const instanceId = activeRobotInstance.id
      let currentChannel: ReturnType<typeof supabase.channel> | null = null
      let visibilityTimeout: NodeJS.Timeout | null = null

      const onRealtimePayload = (payload: any) => {
        console.log(`[useInstanceLogs] Realtime payload received for instance ${instanceId}:`, payload.eventType)
        if (payload.eventType === 'INSERT') {
          const newLog = payload.new as InstanceLog

          setLogs(prevLogs => {
            if (newLog.log_type === 'user_action') {
              const tempMessageIndex = prevLogs.findIndex(log =>
                log.details?.temp_message &&
                log.message === newLog.message &&
                log.log_type === 'user_action'
              )

              if (tempMessageIndex !== -1) {
                const updatedLogs = [...prevLogs]
                updatedLogs[tempMessageIndex] = newLog
                return updatedLogs
              }
            }

            const isDuplicate = prevLogs.some(log => log.id === newLog.id)
            if (isDuplicate) {
              return prevLogs
            }

            return [...prevLogs, newLog]
          })

          if (waitingForMessageId) {
            const isResponseToOurMessage = (
              (newLog.log_type === 'agent_action') ||
              (newLog.log_type === 'tool_result') ||
              (newLog.log_type === 'system' && (
                newLog.message.toLowerCase().includes('processing') ||
                newLog.message.toLowerCase().includes('received') ||
                newLog.message.toLowerCase().includes('completed') ||
                newLog.message.toLowerCase().includes('response') ||
                newLog.message.toLowerCase().includes('answer')
              )) ||
              (newLog.log_type === 'system' && newLog.message.length > 10) ||
              (newLog.log_type !== 'user_action' && newLog.message.length > 5)
            )

            if (isResponseToOurMessage) {
              const timeDiff = new Date(newLog.created_at).getTime() - new Date().getTime()
              if (Math.abs(timeDiff) < 60000) {
                onResponseReceived?.()
              }
            }
          } else {
            if (newLog.log_type !== 'user_action' && newLog.message.length > 5) {
              onResponseReceived?.()
            }
          }

          if (newLog.log_type === 'system' && newLog.message.length > 200) {
            setCollapsedSystemMessages(prev => new Set(prev).add(newLog.id))
          }

          const hasToolName = newLog.tool_name || newLog.toolName
          const isToolCall = newLog.log_type === 'tool_call' || newLog.log_type === 'tool_result'
          const hasToolResult = newLog.tool_result && Object.keys(newLog.tool_result).length > 0
          const hasDetails = newLog.details && Object.keys(newLog.details).length > 0
          const hasScreenshot = newLog.screenshot_base64

          if ((hasToolName || isToolCall) && (hasToolResult || hasDetails || hasScreenshot)) {
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

      let retryCount = 0
      let retryTimeout: NodeJS.Timeout | null = null

      const subscribe = () => {
        console.log(`[useInstanceLogs] Subscribing to instance_logs for instance ${instanceId}...`)
        if (currentChannel) {
          try { 
            console.log(`[useInstanceLogs] Removing old channel for instance ${instanceId}`)
            supabase.removeChannel(currentChannel) 
          } catch (err) { 
            console.warn(`[useInstanceLogs] Error removing channel:`, err)
          }
        }

        const channel = supabase
          .channel(`instance_logs_${instanceId}_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'instance_logs',
              filter: `instance_id=eq.${instanceId}`
            },
            onRealtimePayload
          )
          .subscribe((status: string, err?: any) => {
            console.log(`[useInstanceLogs] Subscription status for ${instanceId}:`, status, err || '')
            if (status === 'SUBSCRIBED') {
              retryCount = 0
            } else if (status === 'CHANNEL_ERROR') {
              console.warn('[useInstanceLogs] Channel error', err || '')
              handleRetry()
            } else if (status === 'TIMED_OUT') {
              console.warn('[useInstanceLogs] Channel timed out')
              handleRetry()
            } else if (status === 'CLOSED') {
              console.warn('[useInstanceLogs] Channel closed')
              handleRetry()
            }
          })

        currentChannel = channel
      }

      const handleRetry = () => {
        if (retryTimeout) clearTimeout(retryTimeout)
        
        // Max delay of 30 seconds
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        retryCount++
        
        console.log(`[useInstanceLogs] Retrying subscription for ${instanceId} in ${delay}ms... (Attempt ${retryCount})`)
        
        retryTimeout = setTimeout(() => {
          subscribe()
        }, delay)
      }

      subscribe()

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          console.log(`[useInstanceLogs] Visibility changed to visible, refreshing subscription for ${instanceId}`)
          if (visibilityTimeout) clearTimeout(visibilityTimeout)
          visibilityTimeout = setTimeout(() => {
            loadInstanceLogs()
            retryCount = 0
            subscribe()
          }, 1000)
        }
      }

      document.addEventListener('visibilitychange', handleVisibility)

      return () => {
        console.log(`[useInstanceLogs] Cleaning up effect for instance ${instanceId}`)
        if (retryTimeout) clearTimeout(retryTimeout)
        if (visibilityTimeout) clearTimeout(visibilityTimeout)
        document.removeEventListener('visibilitychange', handleVisibility)
        if (currentChannel) {
          try { 
            console.log(`[useInstanceLogs] Removing channel during cleanup for ${instanceId}`)
            supabase.removeChannel(currentChannel) 
          } catch (err) { 
            console.warn(`[useInstanceLogs] Error removing channel during cleanup:`, err)
          }
        }
      }
    } else {
      // Clear logs when no active instance
      setLogs([])
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
      setExpandedToolGroups(new Set())
    }
  }, [activeRobotInstance?.id, waitingForMessageId])

  return {
    logs,
    isLoadingLogs,
    isLoadingMore,
    hasMoreLogs,
    collapsedSystemMessages,
    collapsedToolDetails,
    expandedToolGroups,
    debugInfo,
    loadInstanceLogs,
    loadMoreLogs,
    addOptimisticUserMessage,
    toggleSystemMessageCollapse,
    toggleAllSystemMessages,
    toggleToolDetails,
    toggleToolGroup,
    toggleAllToolDetails
  }
}
