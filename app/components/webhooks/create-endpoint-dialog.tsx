"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Plus } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Card, CardContent } from "@/app/components/ui/card"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { createWebhookEndpoint, upsertSubscription, type WebhookEventType } from "@/lib/webhooks"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Checkbox } from "@/app/components/ui/checkbox"

const EVENT_OPTIONS = [
  { id: "task.created", label: "Task created" },
  { id: "task.updated", label: "Task updated" },
  { id: "task.deleted", label: "Task deleted" },
  { id: "message.created", label: "Message created" },
  { id: "message.updated", label: "Message updated" },
  { id: "message.deleted", label: "Message deleted" },
  { id: "lead.created", label: "Lead created" },
  { id: "lead.updated", label: "Lead updated" },
  { id: "lead.deleted", label: "Lead deleted" },
]

export function CreateEndpointDialog({ onSuccess, triggerLabel = "Create endpoint" }: { onSuccess: () => void, triggerLabel?: string }) {
  const { currentSite } = useSite()
  const { user } = useAuth()

  const [name, setName] = useState("")
  const [targetUrl, setTargetUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  const reset = () => {
    setName("")
    setTargetUrl("")
    setSecret("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite || !user) {
      toast.error("Select a site and sign in")
      return
    }
    if (!name || !targetUrl) {
      toast.error("Name and URL are required")
      return
    }
    try {
      setIsSubmitting(true)
      const ep = await createWebhookEndpoint({
        site_id: currentSite.id,
        created_by: user.id,
        name,
        target_url: targetUrl,
        secret: secret || undefined
      })
      // Subscribe initial events
      if (selectedEvents.length > 0) {
        await Promise.all(
          selectedEvents.map(evt => upsertSubscription(currentSite.id, ep.id, evt as WebhookEventType, true))
        )
      }
      toast.success("Endpoint created")
      reset()
      setOpen(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e?.message || "Failed to create endpoint")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Webhook Endpoint</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CRM endpoint" />
          </div>

          <div className="space-y-1">
            <Label>Target URL</Label>
            <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://example.com/webhook" />
          </div>

          <div className="space-y-1">
            <Label>Secret (optional)</Label>
            <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Shared secret" />
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {EVENT_OPTIONS.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedEvents.includes(opt.id)}
                    onCheckedChange={(checked: boolean) => {
                      setSelectedEvents(prev => checked ? [...prev, opt.id] : prev.filter(id => id !== opt.id))
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Select which events this endpoint will listen to (Tasks CUD, Messages CUD, Leads CUD).</p>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => { reset(); setOpen(false) }}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create endpoint"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}


