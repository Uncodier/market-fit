import { useEffect, useCallback, useRef } from "react"

import { createClient } from "@/lib/supabase/client"

import type { useRobotsController } from "./use-robots-controller"

export function useInstanceCreation(input: ReturnType<typeof useRobotsController>) {
  const { allInstances, instanceAvatars, setInstanceAvatars, isSiteContextReady, refreshCount, lastAutoCreationAttempt, isLoadingRobots, currentSite, getAllInstances, shouldAutoConvertTab, pendingInstanceId, isAutoCreatingInstance, setIsAutoCreatingInstance, setLastAutoCreationAttempt, refreshRobots, setLocalSelectedInstanceId, setPendingInstanceId, setShouldAutoConvertTab, searchParams, router, activeRobotInstance, setIsResuming } = input
  const siteId = currentSite?.id
  const lifecycleRef = useRef<AbortController | null>(null)
  const lifecycleSiteRef = useRef<string | undefined>(undefined)
  const autoCreationRef = useRef<AbortController | null>(null)
  const autoEligibilityRef = useRef<(requestedSiteId: string) => boolean>(() => false)

  // Site lifetime is separate from eligibility: the flow's own loading updates
  // must not cancel its authentication/insert, but leaving the site must.
  useEffect(() => {
    const lifecycle = new AbortController()
    lifecycleRef.current = lifecycle
    lifecycleSiteRef.current = siteId
    return () => { lifecycle.abort() }
  }, [siteId])

  useEffect(() => {
    autoEligibilityRef.current = requestedSiteId =>
      siteId === requestedSiteId && isSiteContextReady && !isLoadingRobots &&
      getAllInstances().length === 0 && !shouldAutoConvertTab && !pendingInstanceId && refreshCount > 0
  }, [siteId, isSiteContextReady, isLoadingRobots, getAllInstances, shouldAutoConvertTab, pendingInstanceId, refreshCount])

  const createPlaceholderInstance = useCallback(async (
    checkCurrent?: () => boolean,
    checkBeforeInsert?: () => boolean,
  ) => {
    const lifecycle = lifecycleRef.current
    const isCurrent = checkCurrent ?? (() => !!lifecycle && !lifecycle.signal.aborted)
    if (!siteId || lifecycleSiteRef.current !== siteId || !isCurrent()) return null
    try {
      const supabase = createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!isCurrent() || (checkBeforeInsert && !checkBeforeInsert())) return null
      if (userError || !user) {
        console.error('Cannot get current user:', userError)
        return null
      }
      const { data, error } = await supabase
        .from('remote_instances')
        .insert([{
          site_id: siteId, user_id: user.id, created_by: user.id,
          name: 'Assistant Session', status: 'pending', instance_type: 'ubuntu',
        }])
        .select()
        .single()
      if (!isCurrent()) return null
      if (error) {
        console.error('Supabase error creating placeholder instance:', error)
        return null
      }
      return data
    } catch (error) {
      if (isCurrent()) console.error('Exception creating placeholder instance:', error)
      return null
    }
  }, [siteId])

  // Fetch latest image asset for each instance to use as avatar
  // Cache avatars incrementally to avoid repeated requests.
  useEffect(() => {
    if (!allInstances || allInstances.length === 0) return;

    let cancelled = false
    const fetchMissingAvatars = async () => {
      const missingIds = allInstances
        .map(i => i.id)
        .filter(id => instanceAvatars[id] === undefined); // Only instances not yet fetched.
        
      if (missingIds.length === 0) return;

      const supabase = createClient();
      const avatarsMap: Record<string, string> = {};
      
      const chunkSize = 20;
      for (let i = 0; i < missingIds.length; i += chunkSize) {
        if (cancelled) return
        const chunk = missingIds.slice(i, i + chunkSize);
        
        const promises = chunk.map(async (id) => {
          const { data } = await supabase
            .from('assets')
            .select('file_path')
            .eq('instance_id', id)
            .like('file_type', 'image/%')
            .order('created_at', { ascending: false })
            .limit(1);
            
          if (data && data.length > 0 && data[0].file_path) {
            let fileUrl = data[0].file_path;
            if (!fileUrl.startsWith('http')) {
              const { data: publicData } = supabase.storage.from('assets').getPublicUrl(fileUrl);
              fileUrl = publicData?.publicUrl || "";
            }
            return { id, url: fileUrl };
          }
          return { id, url: null };
        });
        
        const results = await Promise.all(promises);
        results.forEach(res => {
          avatarsMap[res.id] = res.url ?? '';
        });
      }

      if (!cancelled && Object.keys(avatarsMap).length > 0) {
        setInstanceAvatars(prev => ({ ...prev, ...avatarsMap }));
      }
    };

    fetchMissingAvatars();
    return () => { cancelled = true }
  }, [allInstances, instanceAvatars, setInstanceAvatars, siteId]);
  // Function to check if instances exist in database (bypassing state)
  const checkInstancesExistInDB = useCallback(async (siteId: string): Promise<boolean> => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('remote_instances')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('is_archived', false)
        .limit(1)
      
      if (error) {
        console.error('Error checking instances in DB:', error)
        return true // Assume instances exist on error to prevent false creation
      }
      
      return Boolean(data && data.length > 0)
    } catch (error) {
      console.error('Error in checkInstancesExistInDB:', error)
      return true // Assume instances exist on error
    }
  }, [])

  // Auto-create instance when no instances exist after successful load
  useEffect(() => {
    // 🆕 Only proceed if site context is ready
    if (!isSiteContextReady) {
      return
    }
    
    // Only run this logic if:
    // 1. We're not loading robots anymore
    // 2. We have a current site
    // 3. There are no instances
    // 4. We're not already in the process of creating an instance
    // 5. We're not in the middle of auto-converting a tab
    // 6. We're not already auto-creating an instance
    // 7. We have successfully loaded robots at least once (not just initial loading)
    // 8. We haven't attempted auto-creation recently (debouncing)
    const hasSuccessfullyLoaded = refreshCount > 0
    const timeSinceLastAttempt = Date.now() - lastAutoCreationAttempt
    const debounceDelay = 5000 // 5 seconds debounce
    
    if (!isLoadingRobots && 
        siteId &&
        getAllInstances().length === 0 && 
        !shouldAutoConvertTab && 
        !pendingInstanceId && 
        !isAutoCreatingInstance &&
        hasSuccessfullyLoaded &&
        timeSinceLastAttempt > debounceDelay) {
      
      
      const lifecycle = lifecycleRef.current
      if (!lifecycle || lifecycle.signal.aborted || autoCreationRef.current === lifecycle) return
      autoCreationRef.current = lifecycle
      const isCurrent = () => !lifecycle.signal.aborted
      const isEligible = () => isCurrent() && autoEligibilityRef.current(siteId)
      const autoCreate = async () => {
        let creating = false
        try {
          // This real database read precedes UI updates; no deferred setter shim.
          const instancesExist = await checkInstancesExistInDB(siteId)
          if (instancesExist || !isEligible()) return
          creating = true
          setIsAutoCreatingInstance(true)
          setLastAutoCreationAttempt(Date.now())
          const newInstance = await createPlaceholderInstance(isCurrent, isEligible)
          if (!newInstance || !isCurrent()) return
          await refreshRobots(siteId)
          if (!isCurrent()) return
          setLocalSelectedInstanceId(newInstance.id)
          setPendingInstanceId(newInstance.id)
          setShouldAutoConvertTab(true)
          const params = new URLSearchParams(searchParams.toString())
          params.set('instance', newInstance.id)
          params.set('name', newInstance.requirement_title || newInstance.name || `ag-${newInstance.id.slice(-4)}`)
          params.delete('artifact')
          params.delete('screen')
          params.delete('tab')
          router.replace(`/robots?${params.toString()}`)
        } catch (error) {
          if (isCurrent()) console.error('Error auto-creating instance:', error)
        } finally {
          if (autoCreationRef.current === lifecycle) autoCreationRef.current = null
          if (creating && isCurrent()) setIsAutoCreatingInstance(false)
        }
      }
      void autoCreate()
    }
  }, [isLoadingRobots, siteId, getAllInstances, shouldAutoConvertTab, pendingInstanceId, isAutoCreatingInstance, refreshRobots, searchParams, router, refreshCount, isSiteContextReady, checkInstancesExistInDB, createPlaceholderInstance, lastAutoCreationAttempt, setIsAutoCreatingInstance, setLastAutoCreationAttempt, setLocalSelectedInstanceId, setPendingInstanceId, setShouldAutoConvertTab])

  // No campaigns effect

  // Detect when pending instance becomes available and convert the tab
  useEffect(() => {
    if (pendingInstanceId && shouldAutoConvertTab && allInstances.length > 0) {
      // Check if the pending instance is now available
      const instanceExists = allInstances.some(inst => inst.id === pendingInstanceId)
      
      if (instanceExists) {
        
        // Transform the "new" tab into the new instance tab
        setLocalSelectedInstanceId(pendingInstanceId)
        setPendingInstanceId(null)
        setShouldAutoConvertTab(false)
        
        // Don't update URL immediately - let the local state handle the selection
        // The URL will be updated when the user manually navigates or when the component unmounts
      }
    }
  }, [pendingInstanceId, shouldAutoConvertTab, allInstances, setLocalSelectedInstanceId, setPendingInstanceId, setShouldAutoConvertTab])

  // Derive instance status flags
  const isInstanceStarting = !!(activeRobotInstance && ['starting','pending','initializing'].includes(activeRobotInstance.status))
  const isInstanceRunning = !!(activeRobotInstance && ['running','active'].includes(activeRobotInstance.status))
  const isInstancePausedOrUninstantiated = !!(activeRobotInstance && ['paused','pending'].includes(activeRobotInstance.status))

  // Listen for resume events to immediately show loading on the left explorer
  const activeInstanceId = activeRobotInstance?.id
  useEffect(() => {
    const handleResumeStart = (e: Event) => {
      if (!activeInstanceId || (e as CustomEvent<{ instanceId?: string }>)?.detail?.instanceId === activeInstanceId) {
        setIsResuming(true)
      }
    }
    const handleResumeFailed = (e: Event) => {
      if (!activeInstanceId || (e as CustomEvent<{ instanceId?: string }>)?.detail?.instanceId === activeInstanceId) {
        setIsResuming(false)
      }
    }

    window.addEventListener('robot:resume-start', handleResumeStart)
    window.addEventListener('robot:resume-failed', handleResumeFailed)
    return () => {
      window.removeEventListener('robot:resume-start', handleResumeStart)
      window.removeEventListener('robot:resume-failed', handleResumeFailed)
    }
  }, [activeInstanceId, setIsResuming])

  // Clear forced resume loading once instance transitions to starting/running
  useEffect(() => {
    if (isInstanceStarting || isInstanceRunning) {
      setIsResuming(false)
    }
  }, [isInstanceStarting, isInstanceRunning, setIsResuming])

  // Note: Real-time monitoring is now handled by RobotsContext
  // This ensures efficient data sharing across all components

  // Function to handle creating new instance (button click)
  const handleCreateNewInstance = async () => {
    const lifecycle = lifecycleRef.current
    if (!lifecycle || !siteId || lifecycleSiteRef.current !== siteId) return
    const isCurrent = () => !lifecycle.signal.aborted
    const newInstance = await createPlaceholderInstance(isCurrent)
    if (newInstance) {
      // Refresh robots to get the new instance
      await refreshRobots(siteId)
      if (!isCurrent()) return
      // Select the new instance
      setLocalSelectedInstanceId(newInstance.id)
      // Update URL to reflect the new instance selection
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', newInstance.id)
      const displayName = newInstance.requirement_title ? newInstance.requirement_title : (newInstance.name || `ag-${newInstance.id.slice(-4)}`)
      currentParams.set('name', displayName)
      router.replace(`/robots?${currentParams.toString()}`)
    }
  }
  return { ...input, checkInstancesExistInDB, isInstanceStarting, isInstanceRunning, isInstancePausedOrUninstantiated, createPlaceholderInstance, handleCreateNewInstance }
}
