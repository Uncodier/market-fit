"use client"

import { Button } from "@/app/components/ui/button"
import React,{ Suspense } from "react"
import { RequirementStatusList } from "./components/RequirementStatusList"
import { RequirementViewSwitcher } from "./components/RequirementViewSwitcher"

import {
ChevronLeft,
X
} from "@/app/components/ui/icons"
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/app/components/ui/tabs"
import { EditorContent } from '@tiptap/react'
import '../styles/editor.css'

import { RequirementDetailsPanel } from "./RequirementDetailsPanel"
import { MenuBar } from "./RequirementMenuBar"
import { RequirementSkeleton } from "./RequirementSkeleton"
import { RequirementWorkflowCanvas } from "./RequirementWorkflowCanvas"
import { useRequirementController } from "./use-requirement-controller"
// First, wrap the component with Suspense
export default function RequirementDetailPage(props: { params: Promise<{ id: string }> }) {
  React.use(props.params); // Unwrap to prevent Next.js 15 warning
  return (
    <Suspense fallback={<RequirementSkeleton />}>
      <RequirementDetailContent />
    </Suspense>
  );
}


function RequirementDetailContent() {
  const controller = useRequirementController()
  const { params, router, requirement, isLoading, isSaving, error, hasRequirementStatus, showRightPanel, setShowRightPanel, activeView, setActiveView, workflowHistory, unsavedChanges, editor, handleUndoWorkflow, handleRedoWorkflow, handleSaveChanges, handleDeleteRequirement } = controller
  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <RequirementSkeleton />
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-[calc(100dvh-var(--topbar-height,64px))] items-center justify-center flex-col gap-4">
        <div className="text-destructive">
          <X className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center">Error Loading Requirement</h2>
          <p className="text-muted-foreground text-center mt-2">{error}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/requirements")}
          className="mt-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Requirements
        </Button>
      </div>
    )
  }

  // Show error if no requirement data
  if (!requirement) {
    return (
      <div className="flex h-[calc(100dvh-var(--topbar-height,64px))] items-center justify-center flex-col gap-4">
        <div className="text-destructive">
          <X className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-center">Requirement Not Found</h2>
          <p className="text-muted-foreground text-center mt-2">
            The requirement you are looking for could not be found.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push("/requirements")}
          className="mt-4"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to Requirements
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height,64px))]">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-none z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <MenuBar 
            editor={editor} 
            onSave={handleSaveChanges} 
            isSaving={isSaving} 
            onDelete={handleDeleteRequirement}
            hasUnsavedChanges={unsavedChanges}
            hasRequirementStatus={hasRequirementStatus}
            showRightPanel={showRightPanel}
            setShowRightPanel={setShowRightPanel}
            activeView={activeView}
            canUndoWorkflow={workflowHistory.past.length > 1}
            canRedoWorkflow={workflowHistory.future.length > 0}
            onUndoWorkflow={handleUndoWorkflow}
            onRedoWorkflow={handleRedoWorkflow}
          />
        </div>
        <RequirementViewSwitcher
          activeView={activeView}
          onViewChange={setActiveView}
          documentView={(
            <div className="max-w-4xl mx-auto w-full min-h-full">
              <EditorContent
                editor={editor}
                className="prose prose-sm dark:prose-invert max-w-none [&>.tiptap]:outline-none [&>.tiptap]:px-4 [&>.tiptap]:lg:px-8 [&>.tiptap]:py-8 [&>.tiptap]:min-h-full"
              />
            </div>
          )}
        >
          <RequirementWorkflowCanvas controller={controller} />
        </RequirementViewSwitcher>
      </div>

      {/* Right Panel */}
      {showRightPanel && (
        <div className="w-80 border-l bg-muted/30 flex flex-col h-full shrink-0 overflow-hidden relative">
          <Tabs defaultValue="info" className="flex flex-col h-full">
            <div className="flex-none h-[71px] border-b flex items-center justify-center px-4 z-10 bg-muted/95 backdrop-blur-sm">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="info">Details</TabsTrigger>
                <TabsTrigger value="outsource">Agents</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              <TabsContent value="info" className="mt-0 flex flex-col h-full data-[state=active]:flex data-[state=inactive]:hidden">
              <RequirementDetailsPanel controller={controller} />
              </TabsContent>
              
              <TabsContent value="outsource" className="mt-0 flex flex-col h-full data-[state=active]:flex data-[state=inactive]:hidden">
                <div className="flex-1 overflow-hidden">
                  {requirement?.id && (
                    <RequirementStatusList requirementId={requirement.id} hasContent={!!editor?.getText()} />
                  )}
            </div>
              </TabsContent>
            </div>
          </Tabs>
          </div>
        )}
    </div>
  )
}
