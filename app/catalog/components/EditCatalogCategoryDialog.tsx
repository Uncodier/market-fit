"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { upsertCatalogCategory } from "@/app/catalog/actions"
import { CatalogCategory, AccountingAccount } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createClient } from "@/lib/supabase/client"

interface EditCatalogCategoryDialogProps {
  siteId: string
  category: CatalogCategory | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function EditCatalogCategoryDialog({ siteId, category, open, onOpenChange, onSuccess }: EditCatalogCategoryDialogProps) {
  const { t } = useLocalization()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [incomeKey, setIncomeKey] = useState<string>("default")
  const [cogsKey, setCogsKey] = useState<string>("default")
  
  const [incomeAccounts, setIncomeAccounts] = useState<AccountingAccount[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<AccountingAccount[]>([])

  useEffect(() => {
    async function loadAccounts() {
      if (!siteId || !open) return
      const supabase = createClient()
      const { data } = await supabase
        .from('accounting_accounts')
        .select('*')
        .eq('site_id', siteId)
        .eq('active', true)
        
      if (data) {
        setIncomeAccounts(data.filter(a => a.type === 'income' && a.key))
        setExpenseAccounts(data.filter(a => a.type === 'expense' && a.key))
      }
    }
    loadAccounts()
  }, [siteId, open])

  useEffect(() => {
    if (open && category) {
      setName(category.name)
      setIncomeKey(category.income_account_key || "default")
      setCogsKey(category.cogs_account_key || "default")
    }
  }, [open, category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return
    
    setLoading(true)
    try {
      const payload = {
        id: category.id,
        site_id: siteId,
        name,
        income_account_key: incomeKey === "default" ? null : incomeKey,
        cogs_account_key: cogsKey === "default" ? null : cogsKey
      }
      
      const { error } = await upsertCatalogCategory(payload)
      if (error) throw new Error(error)
      
      toast.success("Category updated successfully")
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Failed to update category")
    } finally {
      setLoading(false)
    }
  }

  if (!category) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" busy={loading}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update category name and accounting defaults.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="income_account">Income Account</Label>
              <Select value={incomeKey} onValueChange={setIncomeKey}>
                <SelectTrigger id="income_account">
                  <SelectValue placeholder="Default (Revenue)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Revenue)</SelectItem>
                  {incomeAccounts.map(a => (
                    <SelectItem key={a.key!} value={a.key!}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cogs_account">COGS Account</Label>
              <Select value={cogsKey} onValueChange={setCogsKey}>
                <SelectTrigger id="cogs_account">
                  <SelectValue placeholder="Default (Cost of Goods Sold)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Cost of Goods Sold)</SelectItem>
                  {expenseAccounts.map(a => (
                    <SelectItem key={a.key!} value={a.key!}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
              <p>Items in this category will use these accounts as defaults when syncing journal entries.</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}