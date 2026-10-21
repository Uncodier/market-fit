"use client"

import { Suspense } from "react"
import { RobotsPageSkeleton } from "@/app/components/skeletons/robots-page-skeleton"
import "@/app/styles/iframe-containment.css"
import { useRobotsController } from "./use-robots-controller"
import { useInstanceCreation } from "./use-instance-creation"
import { useInstanceActions } from "./use-instance-actions"
import { useBrowserWorkspace } from "./use-browser-workspace"
import { useBrowserPresentation } from "./use-browser-presentation"
import { useWorkspaceTabs } from "./use-workspace-tabs"
import { InstanceHeader } from "./instance-header"
import { InstanceModals } from "./instance-modals"
import { RobotsWorkspace } from "./robots-workspace"

export default function RobotsPage() {
  return <Suspense fallback={<RobotsPageSkeleton />}><RobotsPageContent /></Suspense>
}

function RobotsPageContent() {
  const controller = useRobotsController()
  const creation = useInstanceCreation(controller)
  const actions = useInstanceActions(creation)
  const browser = useBrowserWorkspace(actions)
  const presentation = useBrowserPresentation(browser)
  const workspace = useWorkspaceTabs(presentation)
  return (
    <div className={`flex flex-col h-full w-full ${workspace.isCanvasMode ? 'overflow-visible' : 'overflow-hidden'} relative`}>
      <InstanceHeader {...workspace} />
      <InstanceModals {...workspace} />
      <RobotsWorkspace {...workspace} />
    </div>
  )
}
