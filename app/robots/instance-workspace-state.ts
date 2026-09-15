export type BrowserTab =
  | { kind: "preview" }
  | { kind: "source" }
  | { kind: "artifact"; screen: string }

export type WorkspaceLayout = "split" | "chat" | "preview"

export interface InstanceWorkspaceState {
  activeBrowserTab: BrowserTab
  layout: WorkspaceLayout
}

const STORAGE_KEY_PREFIX = "robots:instance-workspace:v1:"

export const DEFAULT_INSTANCE_WORKSPACE_STATE: InstanceWorkspaceState = {
  activeBrowserTab: { kind: "preview" },
  layout: "split",
}

export function instanceWorkspaceStorageKey(instanceId: string): string {
  return `${STORAGE_KEY_PREFIX}${instanceId}`
}

function isBrowserTab(value: unknown): value is BrowserTab {
  if (!value || typeof value !== "object") return false

  const candidate = value as Partial<BrowserTab>
  if (candidate.kind === "preview" || candidate.kind === "source") return true

  return (
    candidate.kind === "artifact" &&
    typeof candidate.screen === "string" &&
    candidate.screen.trim().length > 0
  )
}

function isWorkspaceLayout(value: unknown): value is WorkspaceLayout {
  return value === "split" || value === "chat" || value === "preview"
}

export function parseInstanceWorkspaceState(value: string | null): InstanceWorkspaceState | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<InstanceWorkspaceState>
    if (!isBrowserTab(parsed.activeBrowserTab) || !isWorkspaceLayout(parsed.layout)) {
      return null
    }

    return {
      activeBrowserTab: parsed.activeBrowserTab,
      layout: parsed.layout,
    }
  } catch {
    return null
  }
}

export function loadInstanceWorkspaceState(
  instanceId: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): InstanceWorkspaceState | null {
  try {
    return parseInstanceWorkspaceState(storage.getItem(instanceWorkspaceStorageKey(instanceId)))
  } catch {
    return null
  }
}

export function saveInstanceWorkspaceState(
  instanceId: string,
  state: InstanceWorkspaceState,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): void {
  try {
    storage.setItem(instanceWorkspaceStorageKey(instanceId), JSON.stringify(state))
  } catch {
    // A storage failure should not interrupt the workspace.
  }
}

interface ResolveBrowserTabOptions {
  requestedTab: BrowserTab
  hasRequirementPreview: boolean
  artifactScreens: string[]
}

export function resolveAvailableBrowserTab({
  requestedTab,
  hasRequirementPreview,
  artifactScreens,
}: ResolveBrowserTabOptions): BrowserTab {
  const availableScreens = new Set(artifactScreens)
  const isRequestedArtifactAvailable =
    requestedTab.kind === "artifact" &&
    (availableScreens.has(requestedTab.screen) ||
      (requestedTab.screen === "database" && hasRequirementPreview))

  if (
    (requestedTab.kind === "preview" && hasRequirementPreview) ||
    (requestedTab.kind === "source" && hasRequirementPreview) ||
    isRequestedArtifactAvailable
  ) {
    return requestedTab
  }

  if (hasRequirementPreview) return { kind: "preview" }

  const firstArtifactScreen = artifactScreens[0]
  return firstArtifactScreen
    ? { kind: "artifact", screen: firstArtifactScreen }
    : { kind: "preview" }
}
