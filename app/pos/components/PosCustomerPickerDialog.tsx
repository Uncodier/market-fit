"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createLead } from "@/app/leads/actions"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Check, PlusCircle, Search, User } from "@/app/components/ui/icons"

type Lead = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
}

interface PosCustomerPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leads: Lead[]
  value: RelationSelectValue | string
  onSelect: (value: RelationSelectValue) => void
  siteId?: string
  onLeadUpdated?: (lead: {
    id: string
    name: string
    email: string
    phone?: string | null
  }) => void
  label: (key: string, fallback: string) => string
}

function selectedLeadId(value: RelationSelectValue | string): string | null {
  if (typeof value === "string") return value
  return value?.mode === "existing" ? value.id : null
}

export function PosCustomerPickerDialog({
  open,
  onOpenChange,
  leads,
  value,
  onSelect,
  siteId,
  onLeadUpdated,
  label,
}: PosCustomerPickerDialogProps) {
  const [tab, setTab] = useState("search")
  const [query, setQuery] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentLeadId = selectedLeadId(value)

  useEffect(() => {
    if (!open) return
    setTab("search")
    setQuery("")
    setName("")
    setEmail("")
    setPhone("")
    setError(null)
  }, [open])

  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return leads.slice(0, 30)
    return leads
      .filter((lead) =>
        [lead.name, lead.email, lead.phone]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(normalized)),
      )
      .slice(0, 30)
  }, [leads, query])

  const selectLead = (lead: Lead) => {
    onSelect({
      mode: "existing",
      id: lead.id,
      label: lead.name || lead.email || lead.phone || lead.id,
    })
    onOpenChange(false)
  }

  const handleCreate = async () => {
    if (!siteId || saving) return
    if (!name.trim()) {
      setError(label("pos.leadDetails.nameRequired", "Name is required"))
      return
    }
    if (!email.trim() && !phone.trim()) {
      setError(
        label(
          "pos.leadDetails.emailOrPhoneRequired",
          "Email or phone is required",
        ),
      )
      return
    }

    setSaving(true)
    setError(null)
    try {
      const result = await createLead({
        site_id: siteId,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        status: "new",
      })
      if (result.error || !result.lead) {
        setError(result.error || "Failed to create customer")
        return
      }

      const lead = {
        id: result.lead.id,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      }
      onLeadUpdated?.(lead)
      onSelect({ mode: "existing", id: lead.id, label: lead.name })
      toast.success(label("pos.leadDetails.created", "Customer created"))
      onOpenChange(false)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : label("pos.leadDetails.saveError", "Failed to create customer"),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent size="sm" busy={saving}>
        <DialogHeader>
          <DialogTitle>
            {label("pos.cart.selectCustomer", "Select Customer")}
          </DialogTitle>
          <DialogDescription>
            {label(
              "pos.customerPicker.description",
              "Find an existing customer or create one without leaving the sale.",
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="search">
                <Search className="mr-2 h-4 w-4" />
                {label("common.search", "Search")}
              </TabsTrigger>
              <TabsTrigger value="create" disabled={!siteId}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {label("common.create", "Create")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "search" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={label(
                    "pos.cart.searchCustomer",
                    "Search by name, email, or phone...",
                  )}
                  className="pl-9"
                />
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {filteredLeads.length ? (
                  filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => selectLead(lead)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {lead.name || lead.email || lead.phone}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[lead.email, lead.phone].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {currentLeadId === lead.id ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {label("pos.cart.noCustomers", "No customers found")}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <Input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={label("pos.leadDetails.name", "Name")}
                disabled={saving}
              />
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={label("pos.leadDetails.email", "Email")}
                disabled={saving}
              />
              <Input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={label("pos.leadDetails.phone", "Phone")}
                disabled={saving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreate()
                }}
              />
            </div>
          )}
        </DialogBody>

        {tab === "create" ? (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {label("common.cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
              {saving
                ? label("pos.leadDetails.saving", "Saving...")
                : label("pos.customerPicker.create", "Create Customer")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
