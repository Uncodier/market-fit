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
import { RelationSelect, RelationSelectValue, RelationSelectOption } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { listLocations } from "@/app/inventory/actions"
import { Location } from "@/app/types"
import { useSite } from "@/app/context/SiteContext"

interface EditSaleDialogProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// Categorías predefinidas para ventas
const PRODUCT_CATEGORIES = [
  { value: "Physical Product", label: "Physical Product" },
  { value: "Digital Product", label: "Digital Product" },
  { value: "Service", label: "Service" },
  { value: "Subscription", label: "Subscription" },
  { value: "Course", label: "Course" },
  { value: "Consultation", label: "Consultation" },
  { value: "Software", label: "Software" },
  { value: "Electronics", label: "Electronics" },
  { value: "Clothing", label: "Clothing" },
  { value: "Home & Garden", label: "Home & Garden" },
  { value: "Beauty & Health", label: "Beauty & Health" },
  { value: "Food & Beverage", label: "Food & Beverage" },
  { value: "Books & Media", label: "Books & Media" },
  { value: "Sports & Recreation", label: "Sports & Recreation" },
  { value: "Automotive", label: "Automotive" },
  { value: "Travel & Tourism", label: "Travel & Tourism" },
  { value: "Professional Services", label: "Professional Services" },
  { value: "Creative Services", label: "Creative Services" },
  { value: "Technical Services", label: "Technical Services" },
  { value: "Marketing Services", label: "Marketing Services" },
  { value: "Other", label: "Other" }
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
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [leads, setLeads] = useState<RelationSelectOption[]>([])
  const [segmentValue, setSegmentValue] = useState<RelationSelectValue>(null)
  const [segments, setSegments] = useState<RelationSelectOption[]>([])
  const [source, setSource] = useState<"retail" | "online" | "quote" | "marketplace">("online")
  const [productName, setProductName] = useState("")
  const [category, setCategory] = useState<string>("")
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState<string | null>(null)
  
  // Load lead and segment data when the component mounts
  useEffect(() => {
    if (currentSite?.id && open) {
      loadLeads()
      loadSegments()
      loadLocations()
    }
  }, [currentSite?.id, open])
  
  // Set form values when sale changes
  useEffect(() => {
    if (sale) {
      setTitle(sale.title)
      setAmount(sale.amount.toString())
      setAmountDue((sale.amount_due || 0).toString())
      setStatus(sale.status)
      setSource(sale.source)
      setProductName(sale.productName || "")
      setCategory(sale.productType || "")
      setLocationId(sale.locationId || null)

      if (sale.leadId) {
        setLeadValue({ mode: "existing", id: sale.leadId, label: sale.leadName || "Unknown" })
      } else {
        setLeadValue(null)
      }

      if (sale.segmentId) {
        setSegmentValue({ mode: "existing", id: sale.segmentId, label: "Unknown" })
      } else {
        setSegmentValue(null)
      }
    }
  }, [sale])
  
  // Sync labels when options load
  useEffect(() => {
    if (leadValue?.mode === "existing" && leadValue.label === "Unknown") {
      const match = leads.find(l => l.id === leadValue.id)
      if (match) setLeadValue({ ...leadValue, label: match.label })
    }
  }, [leads, leadValue])

  useEffect(() => {
    if (segmentValue?.mode === "existing" && segmentValue.label === "Unknown") {
      const match = segments.find(s => s.id === segmentValue.id)
      if (match) setSegmentValue({ ...segmentValue, label: match.label })
    }
  }, [segments, segmentValue])

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
          id: lead.id,
          label: lead.name || lead.email
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
          id: segment.id,
          label: segment.name
        }))
        setSegments(segmentOptions)
      }
    } catch (error) {
      console.error("Error loading segments:", error)
    }
  }
  
  // Load locations
  const loadLocations = async () => {
    if (!currentSite?.id) return
    
    try {
      const result = await listLocations(currentSite.id)
      
      if (result.error) {
        console.error("Error loading locations:", result.error)
        return
      }
      
      if (result.data) {
        setLocations(result.data)
      }
    } catch (error) {
      console.error("Error loading locations:", error)
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
      
      const { id: resolvedLeadId, error: leadError } = await resolveRelationId("lead", leadValue, currentSite.id)
      if (leadError) throw new Error(`Lead error: ${leadError}`)

      const { id: resolvedSegmentId, error: segmentError } = await resolveRelationId("segment", segmentValue, currentSite.id)
      if (segmentError) throw new Error(`Segment error: ${segmentError}`)

      const updatedSale: Sale = {
        ...sale,
        title,
        amount: numericAmount,
        amount_due: numericAmountDue,
        status,
        leadId: resolvedLeadId || null,
        segmentId: resolvedSegmentId || null,
        source,
        locationId,
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
              <Label htmlFor="leadValue">Customer</Label>
              <RelationSelect
                options={leads}
                value={leadValue}
                onValueChange={setLeadValue}
                placeholder="Select a customer"
                emptyMessage="No customers found"
                icon={<User className="h-4 w-4" />}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="segmentValue">Segment</Label>
              <RelationSelect
                options={segments}
                value={segmentValue}
                onValueChange={setSegmentValue}
                placeholder="Select a segment"
                emptyMessage="No segments found"
                icon={<Tag className="h-4 w-4" />}
              />
            </div>
            
            {locations.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select 
                  value={locationId || "none"} 
                  onValueChange={(value) => setLocationId(value === "none" ? null : value)}
                >
                  <SelectTrigger id="location" className="h-12">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
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