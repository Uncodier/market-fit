"use client"

import { Bookmark } from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { PropertyRow, hasPropertyValue } from "./PropertyRow"

interface NotesTabProps {
  lead: Lead
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
}

export function NotesTab({ lead, onUpdateLead }: NotesTabProps) {
  return (
    <div className="grid min-w-0">
      <PropertyRow
        icon={<Bookmark size={14} />}
        label="Notes"
        value={lead.notes}
        empty={!hasPropertyValue(lead.notes)}
        showEmpty
        multiline
        editValue={lead.notes || ""}
        saveOnEnter={false}
        onCommit={(value) => onUpdateLead(lead.id, { notes: value || null })}
        renderEditor={(draft, setDraft) => (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-32 text-sm w-full rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-w-0"
            placeholder="Add notes about the lead"
          />
        )}
      />
    </div>
  )
}
