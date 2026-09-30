"use client"

import React, { useEffect, useRef, useState } from "react"
import type { AccountingAccount, AccountType } from "@/app/types"
import { addAccountingAccount, updateAccountLabel } from "../chart"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { toast } from "sonner"

const TYPES: Record<AccountType, string> = { asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", expense: "Expense" }

export function AccountingAccountDialog({ siteId, account, accounts, onClose, onSaved }: {
  siteId: string; account: AccountingAccount | null; accounts: AccountingAccount[]; onClose: () => void; onSaved: () => void
}) {
  const [label, setLabel] = useState(account?.label || "")
  const [code, setCode] = useState(account?.code || "")
  const [key, setKey] = useState(account?.key || "")
  const [type, setType] = useState<AccountType>(account?.type || "expense")
  const [saving, setSaving] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const valid = label.trim() && (account || (code.trim() && key.trim()))

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!siteId || saving || !valid) return
    if (!account && accounts.some((item) => item.code === code.trim() || item.key === key.trim())) {
      toast.error("The account code and key must be unique.")
      return
    }
    setSaving(true)
    try {
      const result = account
        ? await updateAccountLabel(siteId, account.id, label.trim())
        : await addAccountingAccount(siteId, label.trim(), key.trim(), code.trim(), type)
      if (!mounted.current) return
      if (!result) throw new Error("Failed to save account")
      toast.success(account ? "Account updated" : "Account added")
      onClose()
      onSaved()
    } catch (error) {
      if (mounted.current) toast.error(error instanceof Error ? error.message : "Failed to save account")
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DialogContent size="md" busy={saving}>
        <DialogForm onSubmit={save}>
          <DialogHeader>
            <DialogTitle>{account ? "Edit Account" : "Add Accounting Account"}</DialogTitle>
            <DialogDescription>{account ? "Update the display name. The account code and type cannot be changed." : "Create an asset, liability, equity, income, or expense account."}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="space-y-2"><label htmlFor="account-name" className="text-sm font-medium">Name</label><Input id="account-name" required value={label} disabled={saving} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Business Savings" /></div>
            <div className="space-y-2"><label htmlFor="account-code" className="text-sm font-medium">Code</label><Input id="account-code" required value={code} disabled={Boolean(account) || saving} onChange={(event) => setCode(event.target.value)} className="font-mono" placeholder="e.g. 1020" /></div>
            {!account ? <div className="space-y-2"><label htmlFor="account-key" className="text-sm font-medium">Unique Key</label><Input id="account-key" required value={key} disabled={saving} onChange={(event) => setKey(event.target.value)} className="font-mono" placeholder="e.g. BUSINESS_SAVINGS" /></div> : null}
            <div className="space-y-2">
              <label htmlFor="account-type" className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={(value) => setType(value as AccountType)} disabled={Boolean(account) || saving}>
                <SelectTrigger type="button" id="account-type"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPES).map(([value, name]) => <SelectItem key={value} value={value}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !valid}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}