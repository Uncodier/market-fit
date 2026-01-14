import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Key, Copy, CheckCircle2, AlertCircle, PlusCircle } from "@/app/components/ui/icons"
import { createApiKey, CreateApiKeyParams } from "@/lib/api-keys"
import { useSite } from "@/app/context/SiteContext"
import { Switch } from "@/app/components/ui/switch"
import { cn } from "@/lib/utils"
import { Separator } from "@/app/components/ui/separator"
import { useAuth } from "@/app/hooks/use-auth"

interface CreateKeyDialogProps {
  onSuccess: () => void;
}

export function CreateKeyDialog({ onSuccess }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [newApiKey, setNewApiKey] = useState("")
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [keyCreated, setKeyCreated] = useState(false)
  const [name, setName] = useState("")
  const [prefix, setPrefix] = useState("")
  const [expirationDays, setExpirationDays] = useState("90")
  const [scopes, setScopes] = useState<string[]>([])
  const [requestsPerMinute, setRequestsPerMinute] = useState("60")
  const [concurrentRequests, setConcurrentRequests] = useState("5")
  const [allowedIps, setAllowedIps] = useState("")
  const { currentSite } = useSite()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentSite) {
      toast.error("Please select a site first")
      return
    }

    if (!user) {
      toast.error("You must be logged in to create an API key")
      return
    }

    if (!name) {
      toast.error("Please enter a name for your API key")
      return
    }

    if (scopes.length === 0) {
      toast.error("Please select at least one permission scope")
      return
    }

    try {
      setIsSubmitting(true)
      const params: CreateApiKeyParams = {
        name,
        scopes,
        site_id: currentSite.id,
        user_id: user.id,
        expirationDays: parseInt(expirationDays),
        ...(prefix && { prefix }),
        metadata: {
          rate_limits: {
            requests_per_minute: parseInt(requestsPerMinute),
            concurrent_requests: parseInt(concurrentRequests)
          },
          ...(allowedIps && {
            allowed_ips: allowedIps.split(',').map(ip => ip.trim()).filter(Boolean)
          })
        }
      }

      const result = await createApiKey(params)
      
      // The API client returns data property, so result is already the inner data object
      if (!result.apiKey) {
        console.error('Invalid API response:', result)
        throw new Error('API key not found in response')
      }
      
      setNewApiKey(result.apiKey)
      setShowResult(true)
      setKeyCreated(true)
      // Don't call onSuccess() here - wait until user closes the modal
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newApiKey)
      setCopied(true)
      toast.success("API key copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy API key")
    }
  }

  const handleClose = () => {
    if (showResult && keyCreated) {
      // Call onSuccess only when closing after successfully creating a key
      onSuccess()
    }
    
    // Reset everything
    setShowResult(false)
    setNewApiKey("")
    setName("")
    setPrefix("")
    setExpirationDays("90")
    setScopes([])
    setRequestsPerMinute("60")
    setConcurrentRequests("5")
    setAllowedIps("")
    setCopied(false)
    setKeyCreated(false)
    setOpen(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setOpen(true)
    } else {
      handleClose()
    }
  }

  const toggleScope = (scope: string) => {
    setScopes(current => 
      current.includes(scope)
        ? current.filter(s => s !== scope)
        : [...current, scope]
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {showResult ? "Your API Key" : "Create API Key"}
          </DialogTitle>
        </DialogHeader>
        
        {showResult ? (
          <div className="space-y-6 pt-4">
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Save this API key now
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    For security reasons, you won't be able to see this key again after closing this dialog.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="relative">
                <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all pr-12">
                  {newApiKey}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">Quick Start</h4>
              <p className="text-xs text-muted-foreground">
                Use this API key in your requests by including it in the Authorization header:
              </p>
              <code className="block text-xs bg-background px-3 py-2 rounded border">
                Authorization: Bearer {newApiKey.substring(0, 20)}...
              </code>
            </div>

            <div className="flex justify-end gap-3">
              <Button onClick={handleClose}>
                I've Saved My Key
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API Key"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                  <div className="space-y-0.5">
                    <Label htmlFor="read" className="text-sm font-medium">
                      Read
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      View sites and commands
                    </p>
                  </div>
                  <Switch
                    id="read"
                    checked={scopes.includes('read')}
                    onCheckedChange={() => toggleScope('read')}
                    disabled={isSubmitting}
                    className="safari-switch"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                  <div className="space-y-0.5">
                    <Label htmlFor="write" className="text-sm font-medium">
                      Write
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Create and manage commands
                    </p>
                  </div>
                  <Switch
                    id="write"
                    checked={scopes.includes('write')}
                    onCheckedChange={() => toggleScope('write')}
                    disabled={isSubmitting}
                    className="safari-switch"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/5 transition-colors duration-200">
                  <div className="space-y-0.5">
                    <Label htmlFor="delete" className="text-sm font-medium">
                      Delete
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Remove sites and commands
                    </p>
                  </div>
                  <Switch
                    id="delete"
                    checked={scopes.includes('delete')}
                    onCheckedChange={() => toggleScope('delete')}
                    disabled={isSubmitting}
                    className="safari-switch"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <Label>Rate Limits</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requestsPerMinute" className="text-sm text-muted-foreground">
                    Requests per minute
                  </Label>
                  <Input
                    id="requestsPerMinute"
                    type="number"
                    min="1"
                    value={requestsPerMinute}
                    onChange={(e) => setRequestsPerMinute(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="concurrentRequests" className="text-sm text-muted-foreground">
                    Concurrent requests
                  </Label>
                  <Input
                    id="concurrentRequests"
                    type="number"
                    min="1"
                    value={concurrentRequests}
                    onChange={(e) => setConcurrentRequests(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedIps">Allowed IPs (Optional)</Label>
              <Input
                id="allowedIps"
                value={allowedIps}
                onChange={(e) => setAllowedIps(e.target.value)}
                placeholder="192.168.1.1, 10.0.0.1"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of IP addresses that can use this key. Leave empty to allow all IPs.
              </p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration (days)</Label>
                <Input
                  id="expiration"
                  type="number"
                  min="1"
                  max="365"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prefix">Key Prefix (Optional)</Label>
                <Input
                  id="prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="prod"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                    <span>Creating</span>
                  </div>
                ) : "Create Key"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
} 