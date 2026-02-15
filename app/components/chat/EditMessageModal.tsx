"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { ChatMessage } from "@/app/types/chat"
import { toast } from "sonner"
import * as Icons from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"

interface EditMessageModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  message: ChatMessage | null
  onSave: (messageId: string, newText: string) => Promise<void>
}

export function EditMessageModal({ isOpen, onOpenChange, message, onSave }: EditMessageModalProps) {
  const [editText, setEditText] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Initialize edit text when modal opens
  useEffect(() => {
    if (message) {
      setEditText(message.text)
    }
  }, [message])

  // Calculate estimated send time (in user's local timezone)
  const getEstimatedSendTime = () => {
    if (!message?.metadata?.delay_timer) return null
    
    const delayTimer = message.metadata.delay_timer
    const endTime = typeof delayTimer === 'string' ? new Date(delayTimer).getTime() : delayTimer
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    
    return new Date(endTime).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: localTimeZone
    })
  }

  const handleSave = async () => {
    if (!message || !message.id || !editText.trim()) return

    setIsSaving(true)
    try {
      await onSave(message.id, editText.trim())
      toast.success("Message updated successfully")
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating message:", error)
      toast.error("Failed to update message")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditText(message?.text || "")
    onOpenChange(false)
  }

  const estimatedSendTime = getEstimatedSendTime()

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icons.Pencil className="h-5 w-5" />
            Edit Message
          </DialogTitle>
          {estimatedSendTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icons.Clock className="h-4 w-4" />
              <span>Estimated send time: {estimatedSendTime}</span>
            </div>
          )}
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="message-text" className="text-sm font-medium">
              Message Content
            </label>
            <Textarea
              id="message-text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Enter your message..."
              className="min-h-[120px] mt-2"
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !editText.trim()}
          >
            {isSaving ? (
              <>
                <LoadingSkeleton variant="button" size="sm" />
                Saving...
              </>
            ) : (
              <>
                <Icons.Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 