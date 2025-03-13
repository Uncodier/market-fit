import React, { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Globe } from "@/app/components/ui/icons"

interface SegmentUrlModalProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  urlInput: string
  setUrlInput: (url: string) => void
  onSave: () => Promise<void>
}

export function SegmentUrlModal({ 
  isOpen, 
  setIsOpen, 
  urlInput, 
  setUrlInput, 
  onSave 
}: SegmentUrlModalProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveError(null)
      await onSave()
    } catch (error) {
      console.error("Error in URL modal:", error)
      setSaveError("Error saving URL")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure Segment URL</DialogTitle>
          <DialogDescription>
            Enter the URL where this segment's content can be previewed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <div className="relative">
              <Globe className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                id="url"
                placeholder="https://example.com/segment-preview"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full h-12 pl-10"
                disabled={isSaving}
              />
            </div>
            {saveError && (
              <p className="text-sm text-red-500 mt-2">{saveError}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-r-foreground" />
                Saving...
              </>
            ) : (
              'Save URL'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 