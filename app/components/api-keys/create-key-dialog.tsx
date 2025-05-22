import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Key } from "@/app/components/ui/icons"
import { createApiKey, CreateApiKeyParams } from "@/lib/api-keys"
import { useSite } from "@/app/context/SiteContext"
import { Switch } from "@/app/components/ui/switch"
import { cn } from "@/lib/utils"
import { Separator } from "@/app/components/ui/separator"
import { useAuth } from "@/app/hooks/use-auth"
import { ApiKeyModal } from "./api-key-modal"

interface CreateKeyDialogProps {
  onSuccess: () => void;
}

export function CreateKeyDialog({ onSuccess }: CreateKeyDialogProps) {
  const [open, setOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [newApiKey, setNewApiKey] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
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
      
      // Show the API key in the modal
      setNewApiKey(result.apiKey)
      setShowApiKey(true)
      onSuccess()
      
      // Reset form
      setName("")
      setPrefix("")
      setExpirationDays("90")
      setScopes([])
      setRequestsPerMinute("60")
      setConcurrentRequests("5")
      setAllowedIps("")
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key")
    } finally {
      setIsSubmitting(false)
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
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Key className="mr-2 h-4 w-4" />
            Generate New API Key
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
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

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Key"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ApiKeyModal
        open={showApiKey}
        onOpenChange={setShowApiKey}
        apiKey={newApiKey}
      />
    </>
  )
} 