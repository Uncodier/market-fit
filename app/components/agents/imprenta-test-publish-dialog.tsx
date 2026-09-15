"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Mail, Phone, User } from "@/app/components/ui/icons"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"

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
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [leads, setLeads] = useState<Array<{ id: string; name: string, email?: string, phone?: string }>>([])
  
  const { currentSite } = useSite()

  const hasEmail = destinations.some(d => ['mail', 'newsletter', 'email'].includes(d.toLowerCase()))
  const hasPhone = destinations.some(d => ['whatsapp', 'call', 'sms', 'telegram', 'voice', 'mensaje', 'message'].includes(d.toLowerCase()))

  useEffect(() => {
    async function fetchLeads() {
      if (!currentSite?.id) return
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone')
        .eq('site_id', currentSite.id)

      if (!error && data) {
        setLeads(data)
      }
    }
    
    if (isOpen) {
      fetchLeads()
    }
  }, [currentSite?.id, isOpen])

  const handleConfirm = () => {
    const testDestinations: Record<string, string> = {}
    
    if (leadValue) {
      testDestinations.lead_id = typeof leadValue === 'string' ? leadValue : leadValue.id
    }
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
            Select a Lead to test personalized variables (like {"{{Name}}"}), or enter an email/phone manually.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Select Lead (Recommended)
            </Label>
            <RelationSelect
              options={leads.map(lead => ({ id: lead.id, label: lead.name || lead.email || lead.phone || 'Unknown' }))}
              value={leadValue}
              onValueChange={(val) => {
                setLeadValue(val)
                if (val && typeof val !== 'string' && val.id) {
                  const lead = leads.find(l => l.id === val.id)
                  if (lead) {
                    if (lead.email) setEmail(lead.email)
                    if (lead.phone) setPhone(lead.phone)
                  }
                } else if (!val) {
                  setEmail("")
                  setPhone("")
                }
              }}
              placeholder="Search leads..."
              emptyMessage="No leads found"
            />
          </div>
          
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted-foreground/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
            </div>
          </div>

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
                onChange={(e) => {
                  setEmail(e.target.value)
                  setLeadValue(null)
                }}
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
                onChange={(e) => {
                  setPhone(e.target.value)
                  setLeadValue(null)
                }}
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
