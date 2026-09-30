"use client"

import { Button } from "@/app/components/ui/button"

import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import {
PanelRightClose,
PanelRightOpen,
Redo,
Save,
Trash2,
Undo
} from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export const MenuBar = ({ 
  editor, 
  onSave, 
  isSaving, 
  onDelete, 
  hasUnsavedChanges,
  hasRequirementStatus,
  showRightPanel,
  setShowRightPanel,
  activeView,
  canUndoWorkflow,
  canRedoWorkflow,
  onUndoWorkflow,
  onRedoWorkflow
}: { 
  editor: import("@tiptap/react").Editor | null, 
  onSave: () => void, 
  isSaving: boolean,
  onDelete: () => void,
  hasUnsavedChanges?: boolean,
  hasRequirementStatus?: boolean,
  showRightPanel: boolean,
  setShowRightPanel: (show: boolean) => void,
  activeView: "document" | "nodes",
  canUndoWorkflow: boolean,
  canRedoWorkflow: boolean,
  onUndoWorkflow: () => void,
  onRedoWorkflow: () => void
}) => {
  if (!editor) {
    return null
  }

  return (
    <div className="border-b pl-[20px] pr-4 py-2 flex flex-wrap gap-1 h-[71px] items-center justify-between">
      <div className="flex items-center gap-1">
        <Button
          variant="secondary" 
          size="default"
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className={cn(
            "h-9 flex items-center gap-2 hover:bg-primary/10 transition-all duration-200",
            !hasUnsavedChanges && "opacity-50"
          )}
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 animate-pulse bg-muted rounded" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save
            </>
          )}
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (activeView === "document" && editor.can().undo()) editor.chain().focus().undo().run();
            if (activeView === "nodes" && canUndoWorkflow) onUndoWorkflow();
          }}
          disabled={activeView === "document" ? !editor.can().undo() : !canUndoWorkflow}
          className="h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (activeView === "document" && editor.can().redo()) editor.chain().focus().redo().run();
            if (activeView === "nodes" && canRedoWorkflow) onRedoWorkflow();
          }}
          disabled={activeView === "document" ? !editor.can().redo() : !canRedoWorkflow}
          className="h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </Button>
        
        {/* Delete section divider and button */}
        <div className="w-px h-6 bg-border mx-1" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              title="Delete Requirement"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Requirement</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this requirement? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground" onClick={onDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowRightPanel(!showRightPanel)}
          className={cn(
            "h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground",
            showRightPanel && "text-foreground"
          )}
          title={showRightPanel ? "Hide panel" : "Show panel"}
        >
          {showRightPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
