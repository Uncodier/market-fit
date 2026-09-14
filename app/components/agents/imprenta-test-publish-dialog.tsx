"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Mail, Phone } from "@/app/components/ui/icons"

interface Props {
  isOpen: boolean
  onClose: () => void
  destinations: string[]
  onConfirm: (testDestinations: Record<string, string>) => void
}

export function ImprentaTestPublishDialog({
  isOpen,
  onClose,
  destinations,
  onConfirm
}: Props) {
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const hasEmail = destinations.some(d => ['mail', 'newsletter', 'email'].includes(d.toLowerCase()))
  const hasPhone = destinations.some(d => ['whatsapp', 'call', 'sms', 'telegram', 'voice', 'mensaje', 'message'].includes(d.toLowerCase()))

  const handleConfirm = () => {
    const testDestinations: Record<string, string> = {}
    if (hasEmail && email.trim()) {
      testDestinations.email = email.trim()
    }
    if (hasPhone && phone.trim()) {
      testDestinations.phone = phone.trim()
    }
    onConfirm(testDestinations)
    onClose()
  }

  const isComplete = (!hasEmail || email.trim() !== "") && (!hasPhone || phone.trim() !== "")

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Test</DialogTitle>
          <DialogDescription>
            Enter a test destination to preview this content without sending it to an audience.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {hasEmail && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="test-email" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email Destination
              </Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={hasEmail}
              />
            </div>
          )}
          {hasPhone && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="test-phone" className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone / WhatsApp Destination
              </Label>
              <Input
                id="test-phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus={!hasEmail && hasPhone}
              />
            </div>
          )}
          {!hasEmail && !hasPhone && (
            <div className="text-sm text-muted-foreground">
              This node has no specific channels configured for testing. It will run normally.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!isComplete && (hasEmail || hasPhone)}>
            Send Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}