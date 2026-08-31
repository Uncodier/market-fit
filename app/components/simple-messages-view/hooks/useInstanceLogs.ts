import { useState, useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { InstanceLog } from '../types'
import { collapseDuplicateUserActions } from './send-message-reliability'
import { subscribeInstanceLogsRealtime } from './subscribeInstanceLogsRealtime'

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
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [hasMoreLogs, setHasMoreLogs] = useState(true)
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<string>>(new Set())
  const [collapsedToolDetails, setCollapsedToolDetails] = useState<Set<string>>(new Set())
  const [expandedToolGroups, setExpandedToolGroups] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const currentRobotInstanceIdRef = useRef<string | null>(activeRobotInstance?.id || null)
  const prevSiteIdRef = useRef<string | null>(null)
  const waitingForMessageIdRef = useRef<string | null | undefined>(waitingForMessageId)
  const onResponseReceivedRef = useRef(onResponseReceived)
  const loadInstanceLogsRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    waitingForMessageIdRef.current = waitingForMessageId
  }, [waitingForMessageId])

  useEffect(() => {
    onResponseReceivedRef.current = onResponseReceived
  }, [onResponseReceived])

  // SWR for logs
  const { data: logsData, isLoading: isLoadingLogs, mutate } = useSWR(
    activeRobotInstance?.id ? ['instance_logs', activeRobotInstance.id] : null,
    async ([_, instanceId]) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('instance_logs')
        .select('*')
        .eq('instance_id', instanceId)
        .order('created_at', { ascending: false })
        .limit(100)
        
      if (error) throw error
      
      const fetchedLogs = (data || []).reverse()
      const seenIds = new Set()
      return fetchedLogs.filter((log: InstanceLog) => {
        if (seenIds.has(log.id)) return false
        seenIds.add(log.id)
        return true
      })
    },
    { revalidateOnFocus: false }
  )

  const logs = collapseDuplicateUserActions(
    (logsData || []).filter((log: InstanceLog) => !log.instance_id || log.instance_id === activeRobotInstance?.id)
  )
  
  const setLogs = useCallback((updater: any) => {
    mutate((current = []) => {
      const newLogs = typeof updater === 'function' ? updater(current) : updater;
      const currentId = currentRobotInstanceIdRef.current;
      if (!currentId) return newLogs;
      return newLogs.filter((log: any) => !log.instance_id || log.instance_id === currentId);
    }, false)
  }, [mutate])

  // Clear states when site changes
  useEffect(() => {
    if (currentSiteId && currentSiteId !== prevSiteIdRef.current) {
      setHasMoreLogs(true)
      setIsLoadingMore(false)
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
      setExpandedToolGroups(new Set())
      setDebugInfo(null)
      prevSiteIdRef.current = currentSiteId
    }
  }, [currentSiteId])

  // Load instance logs and handle collapsing
  const loadInstanceLogs = useCallback(async () => {
    if (!activeRobotInstance?.id) return

    if (activeRobotInstance.id !== currentRobotInstanceIdRef.current) {
      setHasMoreLogs(true)
      setIsLoadingMore(false)
      setCollapsedSystemMessages(new Set())
      setCollapsedToolDetails(new Set())
      setExpandedToolGroups(new Set())
      setDebugInfo(null)
      currentRobotInstanceIdRef.current = activeRobotInstance.id
    }

    try {
      const fetchedLogs = await mutate()
      if (!fetchedLogs) return

      // If we just fetched logs and the latest one is a response, clear thinking state
      if (fetchedLogs.length > 0) {
        const latestLog = fetchedLogs[fetchedLogs.length - 1] as InstanceLog
        if (latestLog.log_type !== 'user_action' && (latestLog.message?.length || 0) > 5) {
          onResponseReceivedRef.current?.()
        }
      }

      setHasMoreLogs(fetchedLogs.length === 100)

      setTimeout(() => {
        if (onScrollToBottomImmediate) {
          onScrollToBottomImmediate()
        } else {
          onScrollToBottom?.()
        }
      }, 100)

      const longSystemMessages = fetchedLogs
        .filter((log: InstanceLog) => log.log_type === 'system' && (log.message?.length || 0) > 200)
        .map((log: InstanceLog) => log.id)
      
      if (longSystemMessages.length > 0) {
        setCollapsedSystemMessages(new Set(longSystemMessages))
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
        setCollapsedToolDetails(new Set(logsWithToolDetails))
      }
      
      if (fetchedLogs.length === 0) {
        const supabase = createClient()
        const { data: allLogs, error: allLogsError } = await supabase
          .from('instance_logs')
          .select('instance_id, log_type, level, created_at')
          .limit(5)
        
        setDebugInfo({
          instanceId: activeRobotInstance.id,
          logsFound: 0,
          totalLogsInTable: 0,
          sampleInstanceIds: allLogs?.map((l: any) => l.instance_id) || [],
          sampleLogs: allLogs || [],
          lastChecked: new Date().toISOString(),
          queryError: allLogsError?.message || null
        })
      } else {
        setDebugInfo(null)
      }
    } catch (error) {
      console.error('Error in loadInstanceLogs:', error)
    }
  }, [activeRobotInstance?.id, mutate, onScrollToBottomImmediate, onScrollToBottom])

  useEffect(() => {
    loadInstanceLogsRef.current = loadInstanceLogs
  }, [loadInstanceLogs])

  // Load older logs on demand
  const loadMoreLogs = useCallback(async () => {
    if (!activeRobotInstance?.id || isLoadingMoreRef.current || !hasMoreLogs || logs.length === 0) {
      return
    }

    setIsLoadingMore(true)
    isLoadingMoreRef.current = true
    const instanceId = activeRobotInstance.id
    const oldestLogTime = logs[0].created_at

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('instance_logs')
        .select('*')
        .eq('instance_id', instanceId)
        .lt('created_at', oldestLogTime)
        .order('created_at', { ascending: false })
        .limit(100)

      if (instanceId !== currentRobotInstanceIdRef.current) return;

      if (error) {
        console.error('Error loading more logs:', error)
      } else {
        const fetchedLogs = (data || []).reverse()
        setHasMoreLogs(fetchedLogs.length === 100)
        
        if (fetchedLogs.length > 0) {
          setLogs(prevLogs => {
            const prevIds = new Set(prevLogs.map((l: InstanceLog) => l.id))
            const newLogs = fetchedLogs.filter((l: InstanceLog) => !prevIds.has(l.id))
            return [...newLogs, ...prevLogs]
          })
          
          const longSystemMessages = fetchedLogs
            .filter((log: InstanceLog) => log.log_type === 'system' && (log.message?.length || 0) > 200)
            .map((log: InstanceLog) => log.id)
          
          if (longSystemMessages.length > 0) {
            setCollapsedSystemMessages((prev: Set<string>) => new Set([...Array.from(prev), ...longSystemMessages]))
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
            setCollapsedToolDetails((prev: Set<string>) => new Set([...Array.from(prev), ...logsWithToolDetails]))
          }
        }
      }
    } catch (error) {
      console.error('Error in loadMoreLogs:', error)
    } finally {
      setIsLoadingMore(false)
      isLoadingMoreRef.current = false
    }
  }, [activeRobotInstance?.id, hasMoreLogs, logs, setLogs])

  const addOptimisticUserMessage = useCallback((message: string) => {
    if (!activeRobotInstance?.id) return

    const newMessage: InstanceLog = {
      id: `optimistic-${Date.now()}`,
      instance_id: activeRobotInstance.id,
      log_type: 'user_action',
      message: message,
      level: 'info',
      created_at: new Date().toISOString(),
      details: { temp_message: true }
    }

    setLogs(prev => [...prev, newMessage])
  }, [activeRobotInstance?.id, setLogs])

  // Collapsing toggles
  const toggleSystemMessageCollapse = (logId: string) => {
    setCollapsedSystemMessages((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) newSet.delete(logId)
      else newSet.add(logId)
      return newSet
    })
  }

  const toggleAllSystemMessages = () => {
    const systemMessages = logs.filter((log: InstanceLog) => log.log_type === 'system')
    const allCollapsed = systemMessages.every((log: InstanceLog) => collapsedSystemMessages.has(log.id))
    
    if (allCollapsed) setCollapsedSystemMessages(new Set())
    else setCollapsedSystemMessages(new Set(systemMessages.map((log: InstanceLog) => log.id)))
  }

  const toggleToolDetails = (logId: string) => {
    setCollapsedToolDetails((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) newSet.delete(logId)
      else newSet.add(logId)
      return newSet
    })
  }

  const toggleToolGroup = (groupId: string) => {
    setExpandedToolGroups((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) newSet.delete(groupId)
      else newSet.add(groupId)
      return newSet
    })
  }

  const toggleAllToolDetails = () => {
    const logsWithTools = logs.filter((log: InstanceLog) => 
      log.tool_name && ((log.tool_result && Object.keys(log.tool_result).length > 0) || 
                       (log.details && Object.keys(log.details).length > 0))
    )
    const allCollapsed = logsWithTools.every((log: InstanceLog) => collapsedToolDetails.has(log.id))
    
    if (allCollapsed) setCollapsedToolDetails(new Set())
    else setCollapsedToolDetails(new Set(logsWithTools.map((log: InstanceLog) => log.id)))
  }

  // Real-time subscriptions — keyed only by instance id to avoid resubscribe churn
  useEffect(() => {
    if (!activeRobotInstance?.id) return

    loadInstanceLogsRef.current()
    return subscribeInstanceLogsRealtime({
      instanceId: activeRobotInstance.id,
      currentRobotInstanceIdRef,
      waitingForMessageIdRef,
      onResponseReceivedRef,
      loadInstanceLogsRef,
      setLogs,
      setCollapsedSystemMessages,
      setCollapsedToolDetails,
    })
  }, [activeRobotInstance?.id, setLogs])

  // Reconcile logs while waiting for a response (covers missed Realtime events)
  useEffect(() => {
    if (!activeRobotInstance?.id || !waitingForMessageId) return

    const instanceStatus = (activeRobotInstance as any)?.status
    const shouldReconcile =
      Boolean(waitingForMessageId) ||
      ['starting', 'pending', 'initializing', 'running', 'active'].includes(instanceStatus)

    if (!shouldReconcile) return

    const interval = setInterval(() => {
      // Solo hacer mutate si seguimos en la misma instancia
      if (activeRobotInstance?.id === currentRobotInstanceIdRef.current) {
        mutate()
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [activeRobotInstance?.id, activeRobotInstance?.status, waitingForMessageId, mutate])

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
