"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Mail, MessageSquare, Phone } from "@/app/components/ui/icons"
import { Lead } from "@/app/leads/types"
import { LeadActionsMenu } from "./LeadActionsMenu"
import { LeadAssigneePicker } from "./LeadAssigneePicker"
import { useLeadDetailActions } from "./use-lead-detail-actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

export function LeadIdentityHeader({
  lead,
  onUpdateLead,
  onDeleteLead,
  onRevealFields,
}: {
  lead: Lead
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
  onDeleteLead?: (id: string) => Promise<void>
  onRevealFields: () => void
}) {
  const actions = useLeadDetailActions(lead)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(lead.name)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const companyName = lead.company?.name || lead.companies?.name
  const subtitle = [lead.position, companyName || "No company"].filter(Boolean).join(" · ")
  const createdLabel = `Created ${new Date(lead.created_at).toLocaleDateString()}`
  const lastContactLabel = lead.last_contact
    ? `Last contact ${formatDistanceToNow(new Date(lead.last_contact), { addSuffix: true })}`
    : "Last contact never"
  const originLabel = lead.origin || "Unknown origin"

  const saveName = async () => {
    const next = nameDraft.trim()
    if (!next || next === lead.name) {
      setEditingName(false)
      setNameDraft(lead.name)
      return
    }
    await onUpdateLead(lead.id, { name: next })
    setEditingName(false)
  }

  const handleDelete = async () => {
    if (!onDeleteLead) return
    setIsDeleting(true)
    try {
      await onDeleteLead(lead.id)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <EntityAvatar name={lead.name} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            {editingName ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveName()
                  if (event.key === "Escape") {
                    setNameDraft(lead.name)
                    setEditingName(false)
                  }
                }}
                className="h-8 text-xl font-semibold max-w-sm"
              />
            ) : (
              <h1
                className="text-xl font-semibold leading-tight truncate cursor-text rounded-md px-1 -mx-1 hover:bg-muted/50"
                onClick={() => {
                  setNameDraft(lead.name)
                  setEditingName(true)
                }}
                title={lead.name}
              >
                {lead.name}
              </h1>
            )}
            <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
            <p className="text-xs text-muted-foreground/80 truncate mt-1">
              {originLabel} · {createdLabel} · {lastContactLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={!lead.email}
            onClick={() => window.open(`mailto:${lead.email}`, "_blank")}
          >
            <Mail className="h-3.5 w-3.5 mr-1.5" />
            Email
          </Button>
          {lead.phone && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => window.open(`tel:${lead.phone}`)}>
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Call
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={actions.loading === "newConversation"}
            onClick={() => void actions.handleNewConversation()}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Conversation
          </Button>
          <LeadAssigneePicker
            lead={lead}
            onAssigned={(assigneeId) => onUpdateLead(lead.id, { assignee_id: assigneeId })}
          />
          <LeadActionsMenu
            loading={actions.loading}
            onResearch={() => void actions.handleLeadResearch()}
            onFollowUp={() => void actions.handleLeadFollowUp()}
            onInvalidate={() => void actions.handleLeadInvalidation()}
            onEdit={onRevealFields}
            onConversation={() => void actions.handleNewConversation()}
            onDelete={onDeleteLead ? () => setShowDeleteDialog(true) : undefined}
          />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
