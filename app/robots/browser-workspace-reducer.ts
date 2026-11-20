import type { InstanceArtifact } from "@/app/components/simple-messages-view/types"
import {
  DEFAULT_INSTANCE_WORKSPACE_STATE,
  resolveAvailableBrowserTab,
  type BrowserTab,
  type InstanceWorkspaceState,
  type WorkspaceLayout,
} from "./instance-workspace-state"

export interface BrowserObservation {
  artifacts: InstanceArtifact[]
  isArtifactsLoading: boolean
  isRequirementPreviewStatusKnown: boolean
  hasRequirementPreview: boolean
}

export interface BrowserWorkspaceState {
  scopeKey: string
  activeBrowserTab: BrowserTab
  workspaceLayout: WorkspaceLayout
  mobileWorkspaceTab: string
  artifactReloadCounter: number
  initialPreselectDone: boolean
  hasObservedArtifacts: boolean
  settledArtifacts: InstanceArtifact[]
  observation: BrowserObservation | null
}

type Update<T> = T | ((previous: T) => T)
export type BrowserWorkspaceAction =
  | { type: "browser-tab"; value: Update<BrowserTab>; scopeKey: string }
  | { type: "layout"; value: Update<WorkspaceLayout>; scopeKey: string }
  | { type: "mobile-tab"; value: Update<string>; scopeKey: string }
  | { type: "reload"; value: Update<number>; scopeKey: string }

export function createBrowserWorkspaceState(
  scopeKey: string,
  saved: InstanceWorkspaceState | null,
  params: Pick<URLSearchParams, "get">,
): BrowserWorkspaceState {
  let activeBrowserTab = saved?.activeBrowserTab ?? DEFAULT_INSTANCE_WORKSPACE_STATE.activeBrowserTab
  let workspaceLayout = saved?.layout ?? DEFAULT_INSTANCE_WORKSPACE_STATE.layout
  let mobileWorkspaceTab = "agent"
  const screen = params.get("screen")
  const tab = params.get("tab")
  if (params.get("artifact") === "true" && screen) {
    activeBrowserTab = ["code", "source_code", "source"].includes(screen)
      ? { kind: "source" }
      : { kind: "artifact", screen }
    mobileWorkspaceTab = activeBrowserTab.kind === "artifact" ? `artifact-${screen}` : "source"
    workspaceLayout = "split"
  } else if (tab === "source" || tab === "preview") {
    activeBrowserTab = { kind: tab }
    mobileWorkspaceTab = tab
    workspaceLayout = "split"
  }
  return {
    scopeKey, activeBrowserTab, workspaceLayout, mobileWorkspaceTab,
    artifactReloadCounter: 0, initialPreselectDone: false,
    hasObservedArtifacts: false, settledArtifacts: [], observation: null,
  }
}

export function sameBrowserObservation(a: BrowserObservation | null, b: BrowserObservation): boolean {
  return (a?.artifacts === b.artifacts || (a?.artifacts.length === 0 && b.artifacts.length === 0)) &&
    a.isArtifactsLoading === b.isArtifactsLoading &&
    a.isRequirementPreviewStatusKnown === b.isRequirementPreviewStatusKnown &&
    a.hasRequirementPreview === b.hasRequirementPreview
}

function sameTab(a: BrowserTab, b: BrowserTab): boolean {
  return a.kind === b.kind && (a.kind !== "artifact" || (b.kind === "artifact" && a.screen === b.screen))
}

// Reload hints belong to newly published rows, not to read snapshots. Compare
// settled reads so a row received during a refetch is not consumed prematurely.
export function reconcileBrowserWorkspace(
  state: BrowserWorkspaceState,
  observation: BrowserObservation,
): BrowserWorkspaceState {
  const { artifacts, isArtifactsLoading, isRequirementPreviewStatusKnown, hasRequirementPreview } = observation
  const previous = state.settledArtifacts
  const screens = [...new Set(artifacts.map(artifact => artifact.screen))]
  let activeBrowserTab = state.activeBrowserTab
  let mobileWorkspaceTab = state.mobileWorkspaceTab
  let initialPreselectDone = state.initialPreselectDone
  let reload = false
  const hasObservedArtifacts = state.hasObservedArtifacts || isArtifactsLoading || artifacts.length > 0

  // The read hook initially exposes an empty array before its first fetch starts.
  // Do not discard a saved tab in that gap; wait for data or a completed load.
  if (!isArtifactsLoading && isRequirementPreviewStatusKnown && hasObservedArtifacts) {
    const resolved = resolveAvailableBrowserTab({ requestedTab: activeBrowserTab, hasRequirementPreview, artifactScreens: screens })
    if (!sameTab(activeBrowserTab, resolved)) activeBrowserTab = resolved
  }

  if (!isArtifactsLoading && isRequirementPreviewStatusKnown && artifacts.length === 0) {
    initialPreselectDone = true
  }
  const newest = artifacts[0]
  if (!isArtifactsLoading && newest) {
    const initialLoad = previous.length === 0
    const newlyPublished = !previous.some(artifact => artifact.id === newest.id) &&
      (initialLoad || Date.parse(newest.created_at) >= Date.parse(previous[0].created_at))
    if (!initialPreselectDone && isRequirementPreviewStatusKnown) {
      initialPreselectDone = true
      // Initial selection honors saved/URL choices, including source and database.
    } else if (newlyPublished && (!initialLoad || (
      initialPreselectDone && !hasRequirementPreview &&
      (state.activeBrowserTab.kind !== "artifact" || !screens.includes(state.activeBrowserTab.screen))
    ))) {
      activeBrowserTab = { kind: "artifact", screen: newest.screen }
      mobileWorkspaceTab = `artifact-${newest.screen}`
      reload = newest.should_reload
    }
  }
  return {
    ...state, activeBrowserTab, mobileWorkspaceTab, initialPreselectDone,
    hasObservedArtifacts, observation, settledArtifacts: isArtifactsLoading ? previous : artifacts,
    artifactReloadCounter: state.artifactReloadCounter + (reload ? 1 : 0),
  }
}

function applyUpdate<T>(value: Update<T>, previous: T): T {
  return typeof value === "function" ? (value as (previous: T) => T)(previous) : value
}

export function browserWorkspaceReducer(state: BrowserWorkspaceState, action: BrowserWorkspaceAction): BrowserWorkspaceState {
  if (action.scopeKey !== state.scopeKey) return state
  switch (action.type) {
    case "browser-tab": return { ...state, activeBrowserTab: applyUpdate(action.value, state.activeBrowserTab) }
    case "layout": return { ...state, workspaceLayout: applyUpdate(action.value, state.workspaceLayout) }
    case "mobile-tab": return { ...state, mobileWorkspaceTab: applyUpdate(action.value, state.mobileWorkspaceTab) }
    case "reload": return { ...state, artifactReloadCounter: applyUpdate(action.value, state.artifactReloadCounter) }
  }
}