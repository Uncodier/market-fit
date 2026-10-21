import { useLayoutEffect, useCallback, useMemo } from "react"

import { Globe, X, Plus, Folder, MessageSquare } from "@/app/components/ui/icons"

import { type TabItem } from "@/app/components/ui/responsive-tabs-list"

import { getScreenMetadata } from "./screen-metadata"
import type { useBrowserPresentation } from "./use-browser-presentation"

export function useWorkspaceTabs(input: ReturnType<typeof useBrowserPresentation>) {
  const { hasRequirementPreview, activeBrowserTab, t, artifactScreens, pinArtifact, closeArtifact, mobileWorkspaceTab, setMobileWorkspaceTab, setActiveBrowserTab, desktopToolbarRef, desktopDeviceControlsRef, desktopLayoutToggleRef, desktopTabsPreferredWidth, setDesktopTabsWidth, isZipUrl } = input

  const allArtifactItems = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'preview' | 'source' | 'artifact';
      screen?: string;
      label: string;
      icon: ReturnType<typeof getScreenMetadata>["icon"];
      isActive: boolean;
    }> = [];
    
    if (hasRequirementPreview) {
      items.push({
        id: 'preview',
        kind: 'preview',
        label: 'Preview',
        icon: Globe,
        isActive: activeBrowserTab.kind === 'preview'
      });
      items.push({
        id: 'source',
        kind: 'source',
        label: 'Source',
        icon: Folder,
        isActive: activeBrowserTab.kind === 'source'
      });
      const databaseMeta = getScreenMetadata('database', t)
      items.push({
        id: 'database',
        kind: 'artifact',
        screen: 'database',
        label: databaseMeta.label,
        icon: databaseMeta.icon,
        isActive: activeBrowserTab.kind === 'artifact' && activeBrowserTab.screen === 'database'
      });
    }
    
    artifactScreens.forEach(a => {
      if (hasRequirementPreview && a.screen === 'database') return;
      const isActive = activeBrowserTab.kind === 'artifact' && activeBrowserTab.screen === a.screen;
      const metadata = getScreenMetadata(a.screen, t);
      items.push({
        id: `artifact-${a.screen}`,
        kind: 'artifact',
        screen: a.screen,
        label: metadata.label,
        icon: metadata.icon,
        isActive
      });
    });
    
    return items;
  }, [hasRequirementPreview, activeBrowserTab, artifactScreens, t]);

  const workspaceTabs = useMemo<TabItem[]>(() => [
    {
      value: 'agent',
      label: 'Agent',
      icon: <MessageSquare className="h-3.5 w-3.5" />,
    },
    ...allArtifactItems.map((item) => {
      const Icon = item.icon
      const canManageArtifact =
        item.kind === 'artifact' && item.screen && item.screen !== 'database'

      return {
        value: item.id,
        label: item.label,
        icon: Icon ? <Icon className="h-3.5 w-3.5" /> : undefined,
        leadingAction: canManageArtifact
          ? {
              label: `Pin ${item.label} to navigation`,
              icon: <Plus className="h-2.5 w-2.5" />,
              onSelect: () => void pinArtifact(item.screen!),
            }
          : undefined,
        trailingAction: canManageArtifact
          ? {
              label: `Close ${item.label} artifact`,
              icon: <X className="h-2.5 w-2.5" />,
              onSelect: () => void closeArtifact(item.screen!),
            }
          : undefined,
      }
    }),
  ], [allArtifactItems, closeArtifact, pinArtifact])
  const desktopWorkspaceTabs = useMemo(() => workspaceTabs.slice(1), [workspaceTabs])

  const activeWorkspaceTab = workspaceTabs.some((tab) => tab.value === mobileWorkspaceTab)
    ? mobileWorkspaceTab
    : 'agent'

  const handleWorkspaceTabChange = useCallback((value: string) => {
    if (value === 'agent') {
      setMobileWorkspaceTab('agent')
      return
    }

    const item = allArtifactItems.find((candidate) => candidate.id === value)
    if (!item) return

    if (item.kind === 'artifact' && item.screen) {
      setActiveBrowserTab({ kind: 'artifact', screen: item.screen })
    } else if (item.kind === 'preview' || item.kind === 'source') {
      setActiveBrowserTab({ kind: item.kind })
    }
    setMobileWorkspaceTab(value)
  }, [allArtifactItems, setActiveBrowserTab, setMobileWorkspaceTab])

  useLayoutEffect(() => {
    const toolbar = desktopToolbarRef.current
    if (!toolbar) return

    const calculateTabsWidth = () => {
      const styles = window.getComputedStyle(toolbar)
      const horizontalPadding =
        Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
      const contentWidth = Math.max(0, toolbar.clientWidth - horizontalPadding)
      const fixedControlsWidth =
        (desktopDeviceControlsRef.current?.getBoundingClientRect().width ?? 0) +
        (desktopLayoutToggleRef.current?.getBoundingClientRect().width ?? 0)
      const columnGap = Number.parseFloat(styles.columnGap) || 0
      const minimumAddressWidth = contentWidth * 0.33
      const maximumTabsWidth = Math.max(
        65,
        contentWidth - minimumAddressWidth - fixedControlsWidth - columnGap * 3,
      )
      const preferredTabsWidth = desktopTabsPreferredWidth || maximumTabsWidth
      const nextWidth = Math.round(Math.min(preferredTabsWidth, maximumTabsWidth))

      setDesktopTabsWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth
      )
    }

    calculateTabsWidth()
    const observer = new ResizeObserver(calculateTabsWidth)
    observer.observe(toolbar)
    if (desktopDeviceControlsRef.current) {
      observer.observe(desktopDeviceControlsRef.current)
    }
    if (desktopLayoutToggleRef.current) {
      observer.observe(desktopLayoutToggleRef.current)
    }

    return () => observer.disconnect()
  }, [
    activeBrowserTab.kind,
    desktopTabsPreferredWidth,
    hasRequirementPreview,
    isZipUrl,
    desktopToolbarRef,
    desktopDeviceControlsRef,
    desktopLayoutToggleRef,
    setDesktopTabsWidth,
  ])
  return { ...input, allArtifactItems, workspaceTabs, desktopWorkspaceTabs, activeWorkspaceTab, handleWorkspaceTabChange }
}
