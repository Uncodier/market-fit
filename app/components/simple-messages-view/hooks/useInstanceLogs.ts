import { useState, useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
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
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const [hasMoreLogs, setHasMoreLogs] = useState(true)
  const [collapsedSystemMessages, setCollapsedSystemMessages] = useState<Set<string>>(new Set())
  const [collapsedToolDetails, setCollapsedToolDetails] = useState<Set<string>>(new Set())
  const [expandedToolGroups, setExpandedToolGroups] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const currentRobotInstanceIdRef = useRef<string | null>(null)
  const prevSiteIdRef = useRef<string | null>(null)
  const isResubscribingRef = useRef(false)

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
    }
  )

  const logs = logsData || []
  
  const setLogs = useCallback((updater: any) => {
    mutate((current = []) => typeof updater === 'function' ? updater(current) : updater, false)
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
        const latestLog = fetchedLogs[0] as InstanceLog
        if (latestLog.log_type !== 'user_action' && (latestLog.message?.length || 0) > 5) {
          onResponseReceived?.()
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
    setCollapsedSystemMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) newSet.delete(logId)
      else newSet.add(logId)
      return newSet
    })
  }

  const toggleAllSystemMessages = () => {
    const systemMessages = logs.filter(log => log.log_type === 'system')
    const allCollapsed = systemMessages.every(log => collapsedSystemMessages.has(log.id))
    
    if (allCollapsed) setCollapsedSystemMessages(new Set())
    else setCollapsedSystemMessages(new Set(systemMessages.map(log => log.id)))
  }

  const toggleToolDetails = (logId: string) => {
    setCollapsedToolDetails(prev => {
      const newSet = new Set(prev)
      if (newSet.has(logId)) newSet.delete(logId)
      else newSet.add(logId)
      return newSet
    })
  }

  const toggleToolGroup = (groupId: string) => {
    setExpandedToolGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) newSet.delete(groupId)
      else newSet.add(groupId)
      return newSet
    })
  }

  const toggleAllToolDetails = () => {
    const logsWithTools = logs.filter(log => 
      log.tool_name && ((log.tool_result && Object.keys(log.tool_result).length > 0) || 
                       (log.details && Object.keys(log.details).length > 0))
    )
    const allCollapsed = logsWithTools.every(log => collapsedToolDetails.has(log.id))
    
    if (allCollapsed) setCollapsedToolDetails(new Set())
    else setCollapsedToolDetails(new Set(logsWithTools.map(log => log.id)))
  }

  // Real-time subscriptions
  useEffect(() => {
    if (activeRobotInstance?.id) {
      loadInstanceLogs()

      const supabase = createClient()
      const instanceId = activeRobotInstance.id
      let currentChannel: ReturnType<typeof supabase.channel> | null = null
      let visibilityTimeout: NodeJS.Timeout | null = null

      const onRealtimePayload = (payload: any) => {
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
            if (isDuplicate) return prevLogs

            return [...prevLogs, newLog]
          })

          if (waitingForMessageId) {
            const isResponseToOurMessage = (
              (newLog.log_type === 'agent_action') ||
              (newLog.log_type === 'tool_result') ||
              (newLog.log_type === 'system' && (
                (newLog.message || '').toLowerCase().includes('processing') ||
                (newLog.message || '').toLowerCase().includes('received') ||
                (newLog.message || '').toLowerCase().includes('completed') ||
                (newLog.message || '').toLowerCase().includes('response') ||
                (newLog.message || '').toLowerCase().includes('answer')
              )) ||
              (newLog.log_type === 'system' && (newLog.message?.length || 0) > 10) ||
              (newLog.log_type !== 'user_action' && (newLog.message?.length || 0) > 5)
            )

            if (isResponseToOurMessage) {
              const timeDiff = new Date(newLog.created_at).getTime() - new Date().getTime()
              if (Math.abs(timeDiff) < 60000) onResponseReceived?.()
            }
          } else {
            if (newLog.log_type !== 'user_action' && (newLog.message?.length || 0) > 5) {
              onResponseReceived?.()
            }
          }

          if (newLog.log_type === 'system' && (newLog.message?.length || 0) > 200) {
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
          setLogs(prevLogs => prevLogs.map(log => log.id === payload.new.id ? payload.new as InstanceLog : log))
        } else if (payload.eventType === 'DELETE') {
          setLogs(prevLogs => prevLogs.filter(log => log.id !== payload.old.id))
        }
      }

      let retryCount = 0
      let retryTimeout: NodeJS.Timeout | null = null

      const subscribe = () => {
        if (currentChannel) {
          try { supabase.removeChannel(currentChannel) } catch (err) { }
        }

        currentChannel = supabase
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
            if (status === 'SUBSCRIBED') {
              retryCount = 0
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              handleRetry()
            }
          })
      }

      const handleRetry = () => {
        if (retryTimeout) clearTimeout(retryTimeout)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)
        retryCount++
        retryTimeout = setTimeout(() => { subscribe() }, delay)
      }

      subscribe()

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
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
        if (retryTimeout) clearTimeout(retryTimeout)
        if (visibilityTimeout) clearTimeout(visibilityTimeout)
        document.removeEventListener('visibilitychange', handleVisibility)
        if (currentChannel) {
          try { supabase.removeChannel(currentChannel) } catch (err) { }
        }
      }
    }
  }, [activeRobotInstance?.id, waitingForMessageId, loadInstanceLogs, onResponseReceived])

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
