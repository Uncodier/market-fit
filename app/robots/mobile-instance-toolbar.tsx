import { Tabs } from "@/app/components/ui/tabs"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import type { useWorkspaceTabs } from "./use-workspace-tabs"

type Props = Pick<ReturnType<typeof useWorkspaceTabs>,
  "workspaceTabs" | "activeWorkspaceTab" | "handleWorkspaceTabChange" | "isCanvasMode" | "activeRobotInstance">

export function MobileInstanceToolbar({ workspaceTabs, activeWorkspaceTab, handleWorkspaceTabChange,
  isCanvasMode, activeRobotInstance }: Props) {
  if (!isCanvasMode && workspaceTabs.length <= 1) return null

  return (
    <header data-toolbar-font className="flex min-w-0 shrink-0 items-center px-4 py-2 md:hidden">
      {!isCanvasMode ? (
        <Tabs value={activeWorkspaceTab} onValueChange={handleWorkspaceTabChange} className="flex min-w-0 flex-1 items-center">
          <ResponsiveTabsList tabs={workspaceTabs} activeTab={activeWorkspaceTab} onTabChange={handleWorkspaceTabChange}
            className="w-auto rounded-full border border-border/40 bg-background/35 shadow-sm backdrop-blur-md"
            containerClassName="justify-center" />
        </Tabs>
      ) : <span className="truncate text-sm font-medium">{activeRobotInstance?.requirement_title || activeRobotInstance?.name || "New Agent"}</span>}
    </header>
  )
}