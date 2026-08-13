"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { 
  PlusCircle, 
  Briefcase, 
  DollarSign, 
  FileText,
} from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogForm,
} from "@/app/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { format } from "date-fns"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { DEAL_STAGES } from "../types"
import { createClient } from "@/lib/supabase/client"

interface CreateDealDialogProps {
  onCreateDeal: (data: { 
    name: string
    amount?: number
    currency?: string
    stage?: string
    company?: string
    expected_close_date?: string
    notes?: string
    site_id: string
  }) => Promise<{ error?: string; deal?: any }>
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CreateDealDialog({ onCreateDeal, trigger, open, onOpenChange }: CreateDealDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [stage, setStage] = useState<string>("prospecting")
  const [companyValue, setCompanyValue] = useState<RelationSelectValue>(null)
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [expectedCloseDate, setExpectedCloseDate] = useState<Date | undefined>(undefined)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  
  const [companiesList, setCompaniesList] = useState<{ value: string; label: string }[]>([])
  const [leadsList, setLeadsList] = useState<{ value: string; label: string }[]>([])

  const { currentSite } = useSite()

  const isOpen = open !== undefined ? open : internalOpen
  
  useEffect(() => {
    async function fetchData() {
      if (isOpen && currentSite?.id) {
        const supabase = createClient()
        
        // Fetch companies
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, name')
          .order('name')
          
        if (companiesData) {
          setCompaniesList(companiesData.map((c: any) => ({ value: c.id, label: c.name })))
        }

        // Fetch leads
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, name, email')
          .eq('site_id', currentSite.id)
          .order('name')
          
        if (leadsData) {
          setLeadsList(leadsData.map((l: any) => ({ 
            value: l.id, 
            label: l.name + (l.email ? ` (${l.email})` : '') 
          })))
        }
      }
    }
    
    fetchData()
  }, [isOpen, currentSite?.id])

  const handleOpenChange = (newOpen: boolean) => {
    if (isLoading) return
    if (onOpenChange) onOpenChange(newOpen)
    setInternalOpen(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite?.id) {
      setError("Please select a site first")
      return
    }

    if (!name) {
      setError("Deal name is required")
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      let resolvedCompanyId = null;
      if (companyValue) {
        const { id, error } = await resolveRelationId("company", companyValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedCompanyId = id;
      }

      let resolvedLeadId = null;
      if (leadValue) {
        const { id, error } = await resolveRelationId("lead", leadValue, currentSite.id);
        if (error) throw new Error(error);
        resolvedLeadId = id;
      }

      const result = await onCreateDeal({ 
        name, 
        amount: amount ? Number(amount) : undefined,
        currency,
        stage,
        company: resolvedCompanyId || undefined,
        expected_close_date: expectedCloseDate ? format(expectedCloseDate, 'yyyy-MM-dd') : undefined,
        notes: notes || undefined,
        site_id: currentSite.id,
        lead_id: resolvedLeadId || undefined
      } as any)
      
      if (result.error) {
        setError(result.error)
        return
      }
      
      // Reset the form
      setName("")
      setAmount("")
      setCurrency("USD")
      setStage("prospecting")
      setCompanyValue(null)
      setLeadValue(null)
      setExpectedCloseDate(undefined)
      setNotes("")
      setError(null)
      handleOpenChange(false)
      
      toast.success("Deal created successfully")
    } catch (err) {
      console.error("Error creating deal:", err)
      setError(err instanceof Error ? err.message : "Error creating deal")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (isLoading) return
    setName("")
    setAmount("")
    setCurrency("USD")
    setStage("prospecting")
    setCompanyValue(null)
    setLeadValue(null)
    setExpectedCloseDate(undefined)
    setNotes("")
    setError(null)
    handleOpenChange(false)
  }

  return (
    <Dialog 
      open={isOpen}
      modal={true}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Deal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="md" busy={isLoading}>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <DialogDescription>
              Add a new deal to your pipeline. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">
                Deal name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="e.g. Acme Corp Enterprise License"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 pl-9"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 pl-9"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="MXN">MXN ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="stage">Stage</Label>
                <Select value={stage} onValueChange={setStage}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company">Company</Label>
                <RelationSelect
                  options={companiesList.map(c => ({ id: c.value, label: c.label }))}
                  value={companyValue}
                  onValueChange={setCompanyValue}
                  placeholder="Search company..."
                  emptyMessage="No companies found"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lead">Primary contact</Label>
                <RelationSelect
                  options={leadsList.map(l => ({ id: l.value, label: l.label }))}
                  value={leadValue}
                  onValueChange={setLeadValue}
                  placeholder="Search lead..."
                  emptyMessage="No leads found"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expectedCloseDate">Expected close date</Label>
                <DatePicker
                  date={expectedCloseDate as Date}
                  setDate={setExpectedCloseDate as any}
                  className="w-full h-12"
                  placeholder="Select close date"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this deal"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px] pl-9 pt-2"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {isLoading ? "Creating..." : "Create deal"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}
