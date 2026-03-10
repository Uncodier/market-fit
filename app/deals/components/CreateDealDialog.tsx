"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { 
  PlusCircle, 
  Briefcase, 
  DollarSign, 
  Globe,
  Calendar,
  FileText,
  User
} from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/app/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Combobox } from "@/app/components/ui/combobox"
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
  const [companyId, setCompanyId] = useState("")
  const [leadId, setLeadId] = useState("")
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

  const handleSubmit = async () => {
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
      const result = await onCreateDeal({ 
        name, 
        amount: amount ? Number(amount) : undefined,
        currency,
        stage,
        company: companyId || undefined,
        expected_close_date: expectedCloseDate ? format(expectedCloseDate, 'yyyy-MM-dd') : undefined,
        notes: notes || undefined,
        site_id: currentSite.id,
        lead_id: leadId || undefined
      } as any)
      
      if (result.error) {
        setError(result.error)
        return
      }
      
      // Limpiar el formulario
      setName("")
      setAmount("")
      setCurrency("USD")
      setStage("prospecting")
      setCompanyId("")
      setLeadId("")
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
    setCompanyId("")
    setLeadId("")
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
      <DialogContent 
        className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" 
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Add a new deal to your pipeline. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label htmlFor="name" className="text-sm font-medium">
                Deal Name <span className="text-red-500">*</span>
              </label>
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
            
            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Amount
              </label>
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
            
            <div className="space-y-2">
              <label htmlFor="currency" className="text-sm font-medium">
                Currency
              </label>
              <div className="relative">
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
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="stage" className="text-sm font-medium">
                Stage
              </label>
              <div className="relative">
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
            </div>

            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium">
                Company
              </label>
              <Combobox
                options={companiesList}
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Search company..."
                emptyMessage="No companies found"
                icon={<Globe className="h-4 w-4 text-muted-foreground" />}
                className="h-12 w-full"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="lead" className="text-sm font-medium">
                Primary Contact (Lead)
              </label>
              <Combobox
                options={leadsList}
                value={leadId}
                onValueChange={setLeadId}
                placeholder="Search lead..."
                emptyMessage="No leads found"
                icon={<User className="h-4 w-4 text-muted-foreground" />}
                className="h-12 w-full"
              />
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <label htmlFor="expectedCloseDate" className="text-sm font-medium">
                Expected Close Date
              </label>
              <DatePicker
                date={expectedCloseDate as Date}
                setDate={setExpectedCloseDate as any}
                className="w-full h-12"
                placeholder="Select close date"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
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
        </div>
        
        <DialogFooter className="flex justify-between border-t pt-4">
          <Button 
            variant="outline" 
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !name}
          >
            {isLoading ? (
              <>
                <LoadingSkeleton variant="button" size="sm" className="text-white" />
                Creating...
              </>
            ) : (
              'Create Deal'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
