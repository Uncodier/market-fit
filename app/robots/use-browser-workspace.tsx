import { useState, useEffect, useMemo, useCallback, type SetStateAction } from "react"

import { useRequirementStatus } from "@/app/components/simple-messages-view/hooks/useRequirementStatus"
import { useInstanceArtifacts } from "@/app/components/simple-messages-view/hooks/useInstanceArtifacts"

import { loadInstanceWorkspaceState, saveInstanceWorkspaceState, type BrowserTab, type WorkspaceLayout } from "./instance-workspace-state"
import { browserWorkspaceReducer, createBrowserWorkspaceState, reconcileBrowserWorkspace, sameBrowserObservation } from "./browser-workspace-reducer"

import type { useInstanceActions } from "./use-instance-actions"

export function useBrowserWorkspace(input: ReturnType<typeof useInstanceActions>) {
  const { activeRobotInstance, searchParams, currentSite } = input

  const scopedInstance = currentSite?.id && activeRobotInstance?.site_id === currentSite.id
    ? activeRobotInstance : null
  const instanceId = scopedInstance?.id ?? null
  const siteId = currentSite?.id ?? null
  const scopeKey = JSON.stringify([siteId, instanceId])
  const { requirementStatuses: readStatuses, isLoading: isRequirementStatusesLoading, isValidating: isRequirementStatusesValidating } = useRequirementStatus(scopedInstance)
  const requirementStatuses = useMemo(() => readStatuses.filter((status: { instance_id?: string; site_id?: string }) =>
    status.instance_id === instanceId && status.site_id === siteId
  ), [readStatuses, instanceId, siteId])

  const {
    artifacts: readArtifacts,
    isLoading: isArtifactsLoading,
    refetchArtifacts,
    removeArtifactLocally,
  } = useInstanceArtifacts({ instanceId: instanceId ?? undefined })
  const artifacts = useMemo(() => readArtifacts.filter(artifact =>
    artifact.instance_id === instanceId && artifact.site_id === siteId
  ), [readArtifacts, instanceId, siteId])
  
  const artifactScreens = useMemo(() => {
    const screensMap = new Map<string, typeof artifacts[0]>()
    // Since artifacts are newest-first, we only keep the first one we see per screen
    artifacts.forEach(a => {
      if (!screensMap.has(a.screen)) {
        screensMap.set(a.screen, a)
      }
    })
    return Array.from(screensMap.values())
  }, [artifacts])

  const latestPreviewUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;
    
    // Find the most recent requirement_status that has a preview
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.preview_url) {
        return status.preview_url;
      }
      // Fallback: If no preview_url but repo_url points to a zip file in Supabase
      if (!status.preview_url && status.repo_url && (status.repo_url.endsWith('.zip') || status.repo_url.includes('.zip?'))) {
        return status.repo_url;
      }
      // Fallback: Check source_code if it points to a zip
      if (!status.preview_url && status.source_code && (status.source_code.endsWith('.zip') || status.source_code.includes('.zip?'))) {
        return status.source_code;
      }
    }
    
    return null;
  }, [requirementStatuses]);

  const latestSourceCodeUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;
    
    // Find the most recent requirement_status that has source_code
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.source_code) {
        return status.source_code;
      }
      if (!status.source_code && status.repo_url && (status.repo_url.endsWith('.zip') || status.repo_url.includes('.zip?'))) {
        return status.repo_url;
      }
      if (!status.source_code && status.preview_url && (status.preview_url.endsWith('.zip') || status.preview_url.includes('.zip?'))) {
        return status.preview_url;
      }
    }
    
    // If no source_code found in requirement_status, try to find an artifact named "code" or "source_code"
    const codeArtifact = artifacts.find(a => a.screen === 'code' || a.screen === 'source_code')
    if (codeArtifact) {
      return codeArtifact.url
    }
    
    return null;
  }, [requirementStatuses, artifacts]);

  const hasRequirementPreview = !!latestPreviewUrl || !!latestSourceCodeUrl;

  // Track if we have ever confirmed the requirement preview status for the current instance
  const isRequirementPreviewStatusKnown = !isRequirementStatusesLoading && 
    (
      requirementStatuses.length > 0 ||
      (readStatuses.length === 0 && !isRequirementStatusesValidating)
    );

  const restore = () => createBrowserWorkspaceState(scopeKey,
    instanceId && typeof window !== "undefined" ? loadInstanceWorkspaceState(instanceId) : null,
    searchParams,
  )
  const [state, setState] = useState(restore)
  const observation = { artifacts, isArtifactsLoading, hasRequirementPreview, isRequirementPreviewStatusKnown }
  // Guarded render adjustment resets only this hook's state, before children or
  // persistence can observe a previous instance's workspace. No effect cascade.
  let workspace = state
  if (state.scopeKey !== scopeKey || !sameBrowserObservation(state.observation, observation)) {
    workspace = reconcileBrowserWorkspace(state.scopeKey === scopeKey ? state : restore(), observation)
    setState(workspace)
  }
  const { activeBrowserTab, workspaceLayout, mobileWorkspaceTab, artifactReloadCounter } = workspace
  const setActiveBrowserTab = useCallback((value: SetStateAction<BrowserTab>) =>
    setState(previous => browserWorkspaceReducer(previous, { type: "browser-tab", value, scopeKey })), [scopeKey])
  const setWorkspaceLayout = useCallback((value: SetStateAction<WorkspaceLayout>) =>
    setState(previous => browserWorkspaceReducer(previous, { type: "layout", value, scopeKey })), [scopeKey])
  const setMobileWorkspaceTab = useCallback((value: SetStateAction<string>) =>
    setState(previous => browserWorkspaceReducer(previous, { type: "mobile-tab", value, scopeKey })), [scopeKey])
  const setArtifactReloadCounter = useCallback((value: SetStateAction<number>) =>
    setState(previous => browserWorkspaceReducer(previous, { type: "reload", value, scopeKey })), [scopeKey])

  useEffect(() => {
    if (instanceId) saveInstanceWorkspaceState(instanceId, { activeBrowserTab, layout: workspaceLayout })
  }, [instanceId, activeBrowserTab, workspaceLayout])

  return { ...input, requirementStatuses, isRequirementStatusesLoading, isRequirementStatusesValidating, activeBrowserTab, setActiveBrowserTab, workspaceLayout, setWorkspaceLayout, mobileWorkspaceTab, setMobileWorkspaceTab, artifactReloadCounter, setArtifactReloadCounter, artifacts, isArtifactsLoading, refetchArtifacts, removeArtifactLocally, artifactScreens, latestPreviewUrl, latestSourceCodeUrl, hasRequirementPreview, isRequirementPreviewStatusKnown }
}
