export type WorkspaceSidebarMode = "hidden" | "compact" | "expanded"

export const WORKSPACE_SIDEBAR_MODE_KEY = "workspaceSidebarMode"

export const WORKSPACE_SIDEBAR_WIDTH: Record<WorkspaceSidebarMode, number> = {
  hidden: 0,
  compact: 64,
  expanded: 256,
}

export function readWorkspaceSidebarMode(value: string | null): WorkspaceSidebarMode {
  return value === "compact" || value === "expanded" ? value : "hidden"
}

export function nextWorkspaceSidebarMode(mode: WorkspaceSidebarMode): WorkspaceSidebarMode {
  return mode === "hidden" ? "compact" : mode === "compact" ? "expanded" : "hidden"
}

export const WORKSPACE_SIDEBAR_ACTION: Record<WorkspaceSidebarMode, string> = {
  hidden: "Pin compact sidebar",
  compact: "Expand sidebar",
  expanded: "Auto-hide sidebar",
}