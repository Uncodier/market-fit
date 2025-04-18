"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { createClient } from "@/lib/supabase/client"

interface RenameConversationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  currentTitle: string
  onRename: () => Promise<void>
  onDirectUpdate?: (conversationId: string, newTitle: string) => void
}

export function RenameConversationModal({
  open,
  onOpenChange,
  conversationId,
  currentTitle,
  onRename,
  onDirectUpdate
}: RenameConversationModalProps) {
  const [newTitle, setNewTitle] = useState(currentTitle)
  const [isLoading, setIsLoading] = useState(false)

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle.trim() === currentTitle) {
      onOpenChange(false)
      return
    }

    setIsLoading(true)
    
    try {
      console.log(`🔍 DEBUG: Renaming conversation ${conversationId} from "${currentTitle}" to "${newTitle.trim()}"`);
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('conversations')
        .update({ title: newTitle.trim() })
        .eq('id', conversationId)
        .select()
        
      if (error) {
        console.error("Error renaming conversation:", error)
        return
      }
      
      console.log(`🔍 DEBUG: Rename success, DB returned:`, data);
      
      if (onDirectUpdate) {
        console.log(`🔍 DEBUG: Using direct state update for conversation rename`);
        onDirectUpdate(conversationId, newTitle.trim());
      } else {
        console.log(`🔍 DEBUG: Will now call onRename to refresh conversation list`);
        await onRename();
      }
      
      onOpenChange(false)
    } catch (error) {
      console.error("Error renaming conversation:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Enter a new name"
            className="w-full"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleRename()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleRename}
            disabled={isLoading || !newTitle.trim() || newTitle.trim() === currentTitle}
          >
            {isLoading ? "Renaming..." : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 