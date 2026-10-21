import { useState, useEffect, useCallback, useMemo } from "react"

import { useIframeUrl } from "@/app/hooks/use-iframe-url"

import { type BrowserTab } from "./instance-workspace-state"
import { deleteInstanceArtifacts } from "./delete-instance-artifacts"
import { pinArtifactToNavigation } from "./artifact-navigation-shortcut"

import { getScreenMetadata } from "./screen-metadata"
import { useTenantLookup } from "./use-tenant-lookup"
import type { useBrowserWorkspace } from "./use-browser-workspace"

export function useBrowserPresentation(input: ReturnType<typeof useBrowserWorkspace>) {
  const { requirementStatuses, activeRobotInstance, setActiveBrowserTab, setMobileWorkspaceTab, currentSite, hasRequirementPreview, artifacts, pendingInstanceId, isCanvasMode, workspaceLayout, mobileWorkspaceTab, activeBrowserTab, theme, latestSourceCodeUrl, latestPreviewUrl, iframeRef, removeArtifactLocally, refetchArtifacts, toast, t, containerRef, viewportSize, setScale } = input

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  const { url: databaseArtifactUrl } = useTenantLookup({
    siteId: currentSite?.id,
    instanceId: activeRobotInstance?.id,
    requirementIds: requirementStatuses.map((status: { requirement_id?: string | null }) => status.requirement_id),
    instanceSiteId: activeRobotInstance?.site_id,
  })
  useEffect(() => {
    const handleToggle = () => {
      const nextTab: BrowserTab = activeBrowserTab.kind === 'source' ? { kind: 'preview' } : { kind: 'source' }
      setActiveBrowserTab(nextTab)
      setMobileWorkspaceTab(nextTab.kind)
    }
    window.addEventListener('robot:toggle-source-code', handleToggle)
    return () => window.removeEventListener('robot:toggle-source-code', handleToggle)
  }, [activeBrowserTab.kind, setActiveBrowserTab, setMobileWorkspaceTab])

  // So the iframe remounts when the preview row is updated in DB, even if the URL string is unchanged
  const requirementPreviewFrameKey = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return "none"
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const s = requirementStatuses[i]
      const hasPreview =
        s.preview_url ||
        (s.repo_url &&
          (s.repo_url.endsWith(".zip") || s.repo_url.includes(".zip?"))) ||
        (s.source_code &&
          (s.source_code.endsWith(".zip") || s.source_code.includes(".zip?")))
      if (hasPreview) {
        return `${(s as { id?: string }).id ?? "row"}-${(s as { updated_at?: string; created_at?: string }).updated_at ?? (s as { created_at?: string }).created_at ?? i}`
      }
    }
    return "none"
  }, [requirementStatuses])

  const hasBrowserContent = Boolean(
    (hasRequirementPreview || artifacts.length > 0) &&
    !pendingInstanceId &&
    !isCanvasMode
  )
  const isPreviewHidden = workspaceLayout === 'chat'
  const isChatHidden = workspaceLayout === 'preview'
  const isBrowserVisible = hasBrowserContent && !isPreviewHidden
  const isMobileBrowserVisible = hasBrowserContent && mobileWorkspaceTab !== 'agent'

  const rawActiveUrlToDisplay = (() => {
    if (activeBrowserTab.kind === 'artifact') {
      if (activeBrowserTab.screen === 'database') {
        return databaseArtifactUrl
      }
      
      const artifact = artifacts.find(a => a.screen === activeBrowserTab.screen)
      if (artifact?.url) {
        try {
          const url = new URL(artifact.url, window.location.origin)
          url.searchParams.set('theme', theme === 'dark' ? 'dark' : 'light')
          url.searchParams.set('artifact', 'true')
          if (currentSite?.id) {
            url.searchParams.set('siteId', currentSite.id)
          }
          // If the original URL was relative, we should keep it relative but with the search params
          if (!artifact.url.startsWith('http')) {
            return url.pathname + url.search
          }
          return url.toString()
        } catch {
          return artifact.url
        }
      }
      return "about:blank"
    }
    return activeBrowserTab.kind === 'source'
      ? (latestSourceCodeUrl || latestPreviewUrl || "about:blank")
      : (latestPreviewUrl || latestSourceCodeUrl || "about:blank")
  })()
  
  const isZipUrl = activeBrowserTab.kind === 'source' || (typeof rawActiveUrlToDisplay === 'string' && (
    rawActiveUrlToDisplay.endsWith('.zip') || 
    rawActiveUrlToDisplay.includes('.zip?') ||
    rawActiveUrlToDisplay.endsWith('.tar.gz') ||
    rawActiveUrlToDisplay.includes('.tar.gz?')
  )) || (activeBrowserTab.kind === 'artifact' && (activeBrowserTab.screen === 'code' || activeBrowserTab.screen === 'source_code'))

  const activeUrlToDisplay = useMemo(() => {
    return rawActiveUrlToDisplay;
  }, [rawActiveUrlToDisplay]);

  const { displayUrl: displayedIframeUrl, iframeSrc, handleIframeLoad } = useIframeUrl(iframeRef, activeUrlToDisplay)

  const closeArtifact = useCallback(async (screen: string) => {
    const artifactIds = artifacts
      .filter((artifact) => artifact.screen === screen)
      .map((artifact) => artifact.id)

    if (artifactIds.length === 0) return

    removeArtifactLocally(screen)
    if (activeBrowserTab.kind === 'artifact' && activeBrowserTab.screen === screen) {
      setActiveBrowserTab({ kind: 'preview' })
    }

    try {
      await deleteInstanceArtifacts(artifactIds)
    } catch (error) {
      console.error("Error deleting artifact:", error)
      await refetchArtifacts()
      toast({
        title: "Could not close artifact",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [
    activeBrowserTab,
    artifacts,
    refetchArtifacts,
    removeArtifactLocally,
    setActiveBrowserTab,
    toast,
  ])

  const pinArtifact = useCallback(async (screen: string) => {
    const artifact = artifacts.find((candidate) => candidate.screen === screen)
    if (!artifact) return

    try {
      pinArtifactToNavigation({
        artifactUrl: artifact.url,
        title: getScreenMetadata(screen, t).label,
      })
      await closeArtifact(screen)
    } catch (error) {
      console.error("Error pinning artifact:", error)
      toast({
        title: "Could not pin artifact",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }, [artifacts, closeArtifact, t, toast])

  const calculateScale = useCallback(() => {
    if (!containerRef.current) return

    const availableWidth = containerRef.current.clientWidth
    if (availableWidth === 0) return

    const effectiveViewport = isZipUrl ? 'macbook' : viewportSize
    const targetWidth = {
      imac: 1920,
      macbook: 1440,
      ipad: 810,
      iphone: 390,
    }[effectiveViewport]

    setScale(targetWidth > availableWidth ? availableWidth / targetWidth : 1)
  }, [viewportSize, isZipUrl, containerRef, setScale])

  useEffect(() => {
    calculateScale()
    if (!containerRef.current) return

    const observer = new ResizeObserver(calculateScale)
    observer.observe(containerRef.current)
    const timeoutId = window.setTimeout(calculateScale, 100)

    return () => {
      observer.disconnect()
      window.clearTimeout(timeoutId)
    }
  }, [calculateScale, hasBrowserContent, containerRef])
  return { ...input, selectedFilePath, setSelectedFilePath, databaseArtifactUrl, requirementPreviewFrameKey, hasBrowserContent, isPreviewHidden, isChatHidden, isBrowserVisible, isMobileBrowserVisible, rawActiveUrlToDisplay, isZipUrl, activeUrlToDisplay, displayedIframeUrl, iframeSrc, handleIframeLoad, closeArtifact, pinArtifact, calculateScale }
}
