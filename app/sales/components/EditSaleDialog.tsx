"use client"

import { useState, useEffect } from "react"
import { User, Tag } from "@/app/components/ui/icons"
import { Sale } from "@/app/types"
import { updateSale } from "@/app/sales/actions"
import { getLeads } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { SimpleSearchSelect, Option } from "@/app/components/ui/simple-search-select"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"

interface EditSaleDialogProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// Categorías predefinidas para ventas
const PRODUCT_CATEGORIES = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "service", label: "Service" },
  { value: "subscription", label: "Subscription" },
  { value: "consulting", label: "Consulting" },
  { value: "training", label: "Training" },
  { value: "support", label: "Support" },
  { value: "other", label: "Other" }
];

export function EditSaleDialog({ 
  sale, 
  open, 
  onOpenChange,
  onSuccess
}: EditSaleDialogProps) {
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [amountDue, setAmountDue] = useState("")
  const [status, setStatus] = useState<"pending" | "completed" | "cancelled" | "refunded">("pending")
  const [leadId, setLeadId] = useState<string>("")
  const [leads, setLeads] = useState<Option[]>([])
  const [segmentId, setSegmentId] = useState<string>("")
  const [segments, setSegments] = useState<Option[]>([])
  const [source, setSource] = useState<"retail" | "online">("online")
  const [productName, setProductName] = useState("")
  const [category, setCategory] = useState<string>("")
  
  // Load lead and segment data when the component mounts
  useEffect(() => {
    if (currentSite?.id && open) {
      loadLeads()
      loadSegments()
    }
  }, [currentSite?.id, open])
  
  // Set form values when sale changes
  useEffect(() => {
    if (sale) {
      setTitle(sale.title)
      setAmount(sale.amount.toString())
      setAmountDue((sale.amount_due || 0).toString())
      setStatus(sale.status)
      setLeadId(sale.leadId || "")
      setSegmentId(sale.segmentId || "")
      setSource(sale.source)
      setProductName(sale.productName || "")
      setCategory(sale.productType || "")
    }
  }, [sale])
  
  // Load leads for the combobox
  const loadLeads = async () => {
    if (!currentSite?.id) return
    
    try {
      const result = await getLeads(currentSite.id)
      
      if (result.error) {
        console.error("Error loading leads:", result.error)
        return
      }
      
      if (result.leads && result.leads.length > 0) {
        const leadOptions = result.leads.map(lead => ({
          value: lead.id,
          label: lead.name
        }))
        setLeads(leadOptions)
      }
    } catch (error) {
      console.error("Error loading leads:", error)
    }
  }

  // Load segments for the combobox
  const loadSegments = async () => {
    if (!currentSite?.id) return
    
    try {
      const result = await getSegments(currentSite.id)
      
      if (result.error) {
        console.error("Error loading segments:", result.error)
        return
      }
      
      if (result.segments && result.segments.length > 0) {
        const segmentOptions = result.segments.map(segment => ({
          value: segment.id,
          label: segment.name
        }))
        setSegments(segmentOptions)
      }
    } catch (error) {
      console.error("Error loading segments:", error)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!sale || !currentSite?.id) return
    
    setIsSubmitting(true)
    
    try {
      const numericAmount = parseFloat(amount)
      const numericAmountDue = parseFloat(amountDue)
      
      if (isNaN(numericAmount) || numericAmount <= 0) {
        toast.error("Please enter a valid amount")
        setIsSubmitting(false)
        return
      }
      
      if (isNaN(numericAmountDue) || numericAmountDue < 0) {
        toast.error("Please enter a valid amount due")
        setIsSubmitting(false)
        return
      }
      
      if (numericAmountDue > numericAmount) {
        toast.error("Amount due cannot be greater than the total amount")
        setIsSubmitting(false)
        return
      }
      
      const updatedSale: Sale = {
        ...sale,
        title,
        amount: numericAmount,
        amount_due: numericAmountDue,
        status,
        leadId: leadId || null,
        segmentId: segmentId || null,
        source,
        productName: productName || "",
        productType: category === "none" ? null : category || null
      }
      
      const result = await updateSale(currentSite.id, updatedSale)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Sale updated successfully")
        onOpenChange(false)
        onSuccess?.()
      }
    } catch (error) {
      console.error("Error updating sale:", error)
      toast.error("Error updating sale")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Sale</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="0.01"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amountDue">Amount Due</Label>
              <Input
                id="amountDue"
                type="number"
                step="0.01"
                value={amountDue}
                onChange={(e) => setAmountDue(e.target.value)}
                required
                min="0.00"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select 
                  value={source} 
                  onValueChange={(value) => setSource(value as "retail" | "online")}
                >
                  <SelectTrigger id="source" className="h-12">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={category} 
                  onValueChange={setCategory}
                >
                  <SelectTrigger id="category" className="h-12">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {PRODUCT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="leadId">Customer</Label>
              <SimpleSearchSelect
                options={leads}
                value={leadId}
                onChange={setLeadId}
                placeholder="Select a customer"
                emptyMessage="No customers found"
                icon={<User className="h-4 w-4" />}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="segmentId">Segment</Label>
              <SimpleSearchSelect
                options={segments}
                value={segmentId}
                onChange={setSegmentId}
                placeholder="Select a segment"
                emptyMessage="No segments found"
                icon={<Tag className="h-4 w-4" />}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 