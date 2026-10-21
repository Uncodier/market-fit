import { useEffect, useCallback } from "react"

import { createClient } from "@/lib/supabase/client"

import { shouldIgnoreInstanceTabChange, sortRobotInstances } from "@/lib/navigation/robots-instance"

import type { useInstanceCreation } from "./use-instance-creation"

export function useInstanceActions(input: ReturnType<typeof useInstanceCreation>) {
  const { lastTabSelectionTimeRef, selectedInstanceId, selectedInstanceParam, tabInstances, isLoadingRobots, setLocalSelectedInstanceId, searchParams, router, getInstanceById, maxVisibleTabs, currentSite, refreshRobots, toast, allInstances, setPendingInstanceId, setShouldAutoConvertTab, tabsContainerRef, setMaxVisibleTabs, isLayoutCollapsed, setContainerWidth } = input

  // Function to handle instance tab change
  const handleTabChange = (newInstance: string) => {
    lastTabSelectionTimeRef.current[newInstance] = Date.now()
    if (
      shouldIgnoreInstanceTabChange({
        nextId: newInstance,
        currentId: selectedInstanceId,
        requestedId: selectedInstanceParam,
        instanceIds: tabInstances.map((inst) => inst.id),
        isLoading: isLoadingRobots,
      })
    ) {
      return
    }
    if (newInstance === 'new') {
      // Reset to new makina mode
      setLocalSelectedInstanceId(null)
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', 'new')
      currentParams.delete('name')
      // Clear artifact and tab state when changing instances
      currentParams.delete('artifact')
      currentParams.delete('screen')
      currentParams.delete('tab')
      router.push(`/robots?${currentParams.toString()}`)
    } else {
      // Set the selected instance
      setLocalSelectedInstanceId(newInstance)
      const currentParams = new URLSearchParams(searchParams.toString())
      currentParams.set('instance', newInstance)
      
      // Clear artifact and tab state when changing instances
      currentParams.delete('artifact')
      currentParams.delete('screen')
      currentParams.delete('tab')
      
      const instance = getInstanceById(newInstance)
      if (instance) {
        const displayName = instance.requirement_title ? instance.requirement_title : (instance.name || `ag-${instance.id.slice(-4)}`)
        currentParams.set('name', displayName)
      } else {
        currentParams.delete('name')
      }
      
      router.push(`/robots?${currentParams.toString()}`)
    }
  }

  // Function to handle tab change from overflow menu (hidden tabs)
  // Updates updated_at so the tab moves to the top, and moves last visible to top of hidden
  const handleTabChangeFromOverflow = async (newInstance: string) => {
    if (newInstance === 'new') {
      handleTabChange(newInstance)
      return
    }

    try {
      const supabase = createClient()
      const now = new Date()
      
      // Get current sorted instances to find the last visible one
      const sortedInstances = sortRobotInstances(tabInstances)
      
      const showNewMakinaTab = tabInstances.length === 0 || isLoadingRobots
      const effectiveMaxTabs = showNewMakinaTab ? Math.max(1, maxVisibleTabs - 1) : Math.max(1, maxVisibleTabs)
      const totalTabs = sortedInstances.length
      const needsOverflow = totalTabs > effectiveMaxTabs
      
      const selectedInstanceIndex = sortedInstances.findIndex(inst => inst.id === selectedInstanceId)
      
      let visibleInstances: typeof sortedInstances = []
      let hiddenInstances: typeof sortedInstances = []
      
      if (!needsOverflow) {
        visibleInstances = sortedInstances
        hiddenInstances = []
      } else {
        if (selectedInstanceIndex === -1 || selectedInstanceIndex < effectiveMaxTabs) {
          visibleInstances = sortedInstances.slice(0, effectiveMaxTabs)
          hiddenInstances = sortedInstances.slice(effectiveMaxTabs)
        } else {
          visibleInstances = [
            ...sortedInstances.slice(0, effectiveMaxTabs - 1),
            sortedInstances[selectedInstanceIndex]
          ]
          hiddenInstances = [
            ...sortedInstances.slice(effectiveMaxTabs - 1, selectedInstanceIndex),
            ...sortedInstances.slice(selectedInstanceIndex + 1)
          ]
        }
      }
      
      // 1. Update selected instance's updated_at to now (moves to first position)
      await supabase
        .from('remote_instances')
        .update({ updated_at: now.toISOString() })
        .eq('id', newInstance)
      
      // 2. If there's a last visible tab, move it to the top of hidden list
      // by setting its updated_at to just before now (but after all other hidden tabs)
      if (visibleInstances.length > 0 && hiddenInstances.length > 0) {
        const lastVisibleInstance = visibleInstances[visibleInstances.length - 1]
        
        // Get the most recent updated_at from hidden instances (excluding the one we just selected)
        const otherHiddenInstances = hiddenInstances.filter(inst => inst.id !== newInstance)
        if (otherHiddenInstances.length > 0) {
          const mostRecentHiddenTime = Math.max(
            ...otherHiddenInstances.map(inst => 
              new Date(inst.updated_at || inst.created_at || 0).getTime()
            )
          )
          
          // Set last visible to be just after the most recent hidden (but before now)
          // This puts it at the top of hidden list
          const newTimeForLastVisible = new Date(mostRecentHiddenTime + 1).toISOString()
          
          await supabase
            .from('remote_instances')
            .update({ updated_at: newTimeForLastVisible })
            .eq('id', lastVisibleInstance.id)
        } else {
          // If no other hidden instances, just set it to a time slightly before now
          const timeBeforeNow = new Date(now.getTime() - 1000).toISOString()
          await supabase
            .from('remote_instances')
            .update({ updated_at: timeBeforeNow })
            .eq('id', lastVisibleInstance.id)
        }
      }
      
      // Refresh robots to reflect the updated order
      if (currentSite?.id) {
        await refreshRobots(currentSite.id)
      }
    } catch (error) {
      console.error('Error updating instance updated_at:', error)
    }

    // Then handle the tab change normally
    handleTabChange(newInstance)
  }

  const handleArchiveInstance = async (instance: { id: string; name: string }) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("remote_instances")
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq("id", instance.id)

      if (error) throw error

      if (selectedInstanceId === instance.id) {
        const nextInstance = sortRobotInstances(
          tabInstances.filter((candidate) => candidate.id !== instance.id),
        )[0]
        handleTabChange(nextInstance?.id || "new")
      }

      await refreshRobots(currentSite?.id)
      toast({
        title: "Instance archived",
        description: `${instance.name} was moved out of the open tabs.`,
      })
    } catch (error) {
      console.error("Error archiving instance:", error)
      toast({
        title: "Could not archive instance",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleOpenFromBrowser = async (instanceId: string) => {
    const instance = allInstances.find((candidate) => candidate.id === instanceId)
    if (instance?.is_archived) {
      const supabase = createClient()
      const { error } = await supabase
        .from("remote_instances")
        .update({ is_archived: false, updated_at: new Date().toISOString() })
        .eq("id", instanceId)

      if (error) {
        toast({
          title: "Could not open instance",
          description: error.message,
          variant: "destructive",
        })
        return
      }

      await refreshRobots(currentSite?.id)
      setLocalSelectedInstanceId(instanceId)

      const params = new URLSearchParams(searchParams.toString())
      params.set("instance", instanceId)
      params.set(
        "name",
        instance.requirement_title || instance.name || `ag-${instance.id.slice(-4)}`,
      )
      params.delete("artifact")
      params.delete("screen")
      params.delete("tab")
      router.push(`/robots?${params.toString()}`)
      return
    }

    await handleTabChangeFromOverflow(instanceId)
  }

  // Function to enable auto-conversion when a new instance is created
  const handleNewInstanceCreated = useCallback((instanceId: string) => {
    // Immediately update local state and URL to reflect the new instance
    setLocalSelectedInstanceId(instanceId)
    // Update URL to reflect the new instance selection
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('instance', instanceId)
    // We don't have the full instance object here easily, but the title effect will catch it
    // Still, try to clear the old name
    currentParams.delete('name')
    currentParams.delete('artifact')
    currentParams.delete('screen')
    currentParams.delete('tab')
    router.replace(`/robots?${currentParams.toString()}`)
    // Keep Realtime enabled so INSERT/UPDATE events can populate the new instance
    setPendingInstanceId(instanceId)
    setShouldAutoConvertTab(true)
  }, [searchParams, router, setLocalSelectedInstanceId, setPendingInstanceId, setShouldAutoConvertTab])

  // Calculate how many tabs can fit based on available width
  // Always calculates - no early returns, uses defaults if measurements aren't ready
  const calculateMaxVisibleTabs = useCallback(() => {
    // If container ref is available, its width is much more reliable
    const containerWidth = tabsContainerRef.current?.clientWidth || 0
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    
    if (windowWidth === 0) {
      setMaxVisibleTabs(Infinity)
      return
    }
    
    // Calculate sidebar width based on collapsed state
    const sidebarWidth = isLayoutCollapsed ? 64 : 256 // w-16 = 64px, w-64 = 256px
    
    // Calculate available width: window width minus sidebar, margins (px-4 = 16px, px-8 = 32px)
    // Mobile: px-4 (16px * 2 = 32px)
    // Desktop: px-16 (64px * 2 = 128px) -> now px-8 (32px * 2 = 64px)
    const horizontalMargins = windowWidth >= 1024 ? 64 : 32
    
    const gapBetweenElements = 8 // gap-2 = 8px
    const plusButtonWidth = 44 // Approximate width of Plus button (h-9 with padding and shrink-0)
    const moreButtonWidth = 80 // Approximate width of "..." button (needs to fit icon + up to 3 digits)
    
    // Fixed estimated width to prevent oscillation loops during resize
    // We use a conservative average width for robot tabs
    // Note: tab max-w is 120px + 24px padding = 144px. So we use 150px to be safe.
    const estimatedTabWidth = 150
    
    // Calculate available width: 
    // Prefer actual container width if available (> 0), otherwise fallback to window width calculation
    const baseAvailableWidth = containerWidth > 0 
      ? containerWidth 
      : (windowWidth - sidebarWidth - horizontalMargins)
      
    const availableWidth = baseAvailableWidth - gapBetweenElements - plusButtonWidth - gapBetweenElements - moreButtonWidth - 16 // 16px extra buffer
    
    // Calculate how many tabs can fit (we already subtracted moreButtonWidth above)
    // We force at least 1 tab to be visible.
    const calculatedTabs = Math.floor(availableWidth / estimatedTabWidth)
    // Reduce max tabs by 1 to make sure we always have enough space and don't overflow
    const maxTabs = calculatedTabs > 0 ? calculatedTabs : 1
    
    // Always show at least 1 tab if there are instances
    const finalMaxTabs = maxTabs
    
    // Only update if value changed to prevent render loops
    setMaxVisibleTabs(prev => prev !== finalMaxTabs ? finalMaxTabs : prev)
    setContainerWidth(prev => prev !== windowWidth ? windowWidth : prev)
  }, [isLayoutCollapsed, tabsContainerRef, setMaxVisibleTabs, setContainerWidth])

  // Use ResizeObserver to track container width changes
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let timeoutId: NodeJS.Timeout | undefined;
    let resizeTimeout: NodeJS.Timeout | undefined;
    
    const observe = () => {
      if (!tabsContainerRef.current) {
        timeoutId = setTimeout(observe, 100);
        return;
      }

      // Initial calculation
      calculateMaxVisibleTabs();

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          calculateMaxVisibleTabs();
        }, 150);
      });

      resizeObserver.observe(tabsContainerRef.current);
    };
    
    observe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [calculateMaxVisibleTabs, tabInstances.length, isLayoutCollapsed, selectedInstanceId, tabsContainerRef]);
  return { ...input, handleTabChange, handleTabChangeFromOverflow, handleArchiveInstance, handleOpenFromBrowser, handleNewInstanceCreated, calculateMaxVisibleTabs }
}
