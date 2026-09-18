"use client"

import { EditorContent } from "@tiptap/react"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { ContentAssetsGrid } from "./ContentAssetsGrid"
import { ContentEditorToolbar } from "./ContentEditorToolbar"
import type { ContentActiveTab } from "../content-item-types"

type Props = {
  content: any
  editor: any
  instructionsEditor: any
  activeTab: ContentActiveTab
  setActiveTab: (tab: ContentActiveTab) => void
  isSaving: boolean
  hasChanges: boolean
  isEditorFocused: boolean
  assetsRefreshTrigger: number
  onSave: () => void
  onDelete: () => void
  onTeleprompter: () => void
  onUploadAsset: () => void
}

export function ContentEditorPane({
  content,
  editor,
  instructionsEditor,
  activeTab,
  setActiveTab,
  isSaving,
  hasChanges,
  isEditorFocused,
  assetsRefreshTrigger,
  onSave,
  onDelete,
  onTeleprompter,
  onUploadAsset,
}: Props) {
  const editorTab = activeTab === "ai" ? "copy" : activeTab

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ContentEditorToolbar
        editor={editor}
        instructionsEditor={instructionsEditor}
        onSave={onSave}
        isSaving={isSaving}
        onDelete={onDelete}
        activeTab={editorTab}
        hasChanges={hasChanges}
        contentType={content?.type}
        onTeleprompter={onTeleprompter}
        onUploadAsset={onUploadAsset}
        isEditorFocused={isEditorFocused}
      />
      <div className="flex-1 overflow-auto">
        <div className="flex h-full flex-col p-4">
          <div className="mb-6 flex justify-center">
            <div className="rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <Tabs value={editorTab} onValueChange={(value) => setActiveTab(value as ContentActiveTab)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="copy">Copy</TabsTrigger>
                  <TabsTrigger value="instructions">Instructions</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="flex flex-1 flex-col">
            {editorTab === "copy" ? (
              <>
                <EditorContent
                  editor={editor}
                  className="prose prose-sm dark:prose-invert max-w-none flex-1 min-h-full overflow-auto"
                  style={{ minHeight: "calc(100vh - 280px)" }}
                />
                {content?.id && (
                  <ContentAssetsGrid
                    contentId={content.id}
                    refreshTrigger={assetsRefreshTrigger}
                    onOpenUpload={onUploadAsset}
                  />
                )}
              </>
            ) : (
              <EditorContent
                editor={instructionsEditor}
                className="prose prose-sm dark:prose-invert max-w-none flex-1 min-h-full overflow-auto"
                style={{ minHeight: "calc(100vh - 280px)" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
