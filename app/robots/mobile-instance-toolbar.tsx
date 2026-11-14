import { Tabs } from "@/app/components/ui/tabs"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileInstanceBackButton } from "./mobile-instance-back-button"
import type { useWorkspaceTabs } from "./use-workspace-tabs"

type Props = Pick<ReturnType<typeof useWorkspaceTabs>,
  "workspaceTabs" | "activeWorkspaceTab" | "handleWorkspaceTabChange" | "isCanvasMode" | "activeRobotInstance">
  & { onBack: () => void }

export function MobileInstanceToolbar({ workspaceTabs, activeWorkspaceTab, handleWorkspaceTabChange,
  isCanvasMode, activeRobotInstance, onBack }: Props) {
  return (
    <StickyHeader className="h-[71px] md:hidden">
      <div className="flex h-full w-full min-w-0 items-center">
        <MobileInstanceBackButton onBack={onBack} />
        {!isCanvasMode ? (
          <Tabs value={activeWorkspaceTab} onValueChange={handleWorkspaceTabChange} className="flex h-full min-w-0 flex-1 items-center">
            <ResponsiveTabsList tabs={workspaceTabs} activeTab={activeWorkspaceTab} onTabChange={handleWorkspaceTabChange}
              className="w-auto rounded-full border border-border/40 bg-background/35 shadow-sm backdrop-blur-md"
              containerClassName="h-full justify-center" />
          </Tabs>
        ) : <span className="truncate text-sm font-medium">{activeRobotInstance?.requirement_title || activeRobotInstance?.name || "New Agent"}</span>}
      </div>
    </StickyHeader>
  )
}