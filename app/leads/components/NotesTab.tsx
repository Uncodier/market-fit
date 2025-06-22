import React from "react"
import { Bookmark } from "./custom-icons"
import { Lead } from "@/app/leads/types"

interface NotesTabProps {
  lead: Lead
  isEditing: boolean
  editForm: Omit<Lead, "id" | "created_at">
  setEditForm: React.Dispatch<React.SetStateAction<Omit<Lead, "id" | "created_at">>>
}

export function NotesTab({ 
  lead, 
  isEditing, 
  editForm, 
  setEditForm 
}: NotesTabProps) {
  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
          <Bookmark className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground mb-[5px] truncate">Notes</p>
          {isEditing ? (
            <textarea
              value={editForm.notes || ""}
              onChange={(e) => setEditForm({...editForm, notes: e.target.value || null})}
              className="h-32 text-sm w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-0"
              placeholder="Add notes about the lead"
            />
          ) : (
            <p className="text-sm font-medium whitespace-pre-wrap break-words min-w-0" title={lead.notes || "No notes added yet"}>{lead.notes || "No notes added yet"}</p>
          )}
        </div>
      </div>
    </div>
  )
} 