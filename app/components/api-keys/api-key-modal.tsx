import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Copy, Check } from "@/app/components/ui/icons"
import { useState } from "react"
import { toast } from "sonner"

interface ApiKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: string
}

export function ApiKeyModal({ open, onOpenChange, apiKey }: ApiKeyModalProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      toast.success("API key copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy API key")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Your API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Please copy your API key now. For security reasons, you won't be able to see it again.
            </p>
            <div className="relative">
              <div className="p-4 bg-accent rounded-md font-mono text-sm break-all">
                {apiKey}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-900 rounded-md p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Make sure to store this API key in a secure location. You will need it to authenticate your API requests.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              I've Saved My API Key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 