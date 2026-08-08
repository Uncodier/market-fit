"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { toast } from "sonner"
import { createSale } from "@/app/sales/actions"
import { useSite } from "@/app/context/SiteContext"
import { getLeads } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { listLocations } from "@/app/inventory/actions"
import { Location } from "@/app/types"

import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"
import { BuyerUserEmailField, BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"

interface CreateSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface FormData {
  title: string
  productName: string
  productType: string
  amount: number
  amount_due: number
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  source: 'retail' | 'online'
  leadValue: RelationSelectValue
  segmentValue: RelationSelectValue
  saleDate: Date
  paymentMethod: string
  locationId: string | null
}

interface Lead {
  id: string
  name: string
  email: string
  buyer_user_id?: string | null
}

interface Segment {
  id: string
  name: string
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
  const { currentSite } = useSite()
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [buyerUser, setBuyerUser] = useState<BuyerUser | null>(null)
  const [formData, setFormData] = useState<FormData>({
    title: "",
    productName: "",
    productType: "",
    amount: 0,
    amount_due: 0,
    status: "pending",
    source: "retail",
    leadValue: null,
    segmentValue: null,
    saleDate: new Date(),
    paymentMethod: "cash",
    locationId: null
  })

  // Load leads and segments when dialog opens
  useEffect(() => {
    if (open && currentSite?.id) {
      loadLeadsAndSegments()
    }
  }, [open, currentSite?.id])

  const loadLeadsAndSegments = async () => {
    if (!currentSite?.id) return

    setLoadingData(true)
    try {
      // Load leads
      const leadsResult = await getLeads(currentSite.id)
      if (leadsResult.error) {
        console.error("Error loading leads:", leadsResult.error)
      } else {
        setLeads(leadsResult.leads?.map(lead => ({
          id: lead.id,
          name: lead.name || lead.email,
          email: lead.email,
          buyer_user_id: (lead as any).buyer_user_id || null
        })) || [])
      }

      // Load segments
      const segmentsResult = await getSegments(currentSite.id)
      if (segmentsResult.error) {
        console.error("Error loading segments:", segmentsResult.error)
      } else {
        setSegments(segmentsResult.segments?.map(segment => ({
          id: segment.id,
          name: segment.name
        })) || [])
      }
      // Load locations
      const locationsResult = await listLocations(currentSite.id)
      if (locationsResult.error) {
        console.error("Error loading locations:", locationsResult.error)
      } else {
        const loadedLocations = locationsResult.data || []
        setLocations(loadedLocations)
        
        // Auto-select location if only one exists
        if (loadedLocations.length === 1) {
          setFormData(prev => ({ ...prev, locationId: loadedLocations[0].id }))
        }
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' || name === 'amount_due' ? parseFloat(value) || 0 : value
    }))
  }

  const handleDateChange = (date: Date) => {
    setFormData(prev => ({
      ...prev,
      saleDate: date
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite?.id) return

    setLoading(true)
    try {
      let finalLeadId: string | null = null
      let finalBuyerUserId: string | null = null

      if (buyerUser) {
        const res = await findOrCreateLeadForBuyer({
          siteId: currentSite.id,
          email: buyerUser.email,
          name: buyerUser.name,
          buyerUserId: buyerUser.buyerUserId
        })
        if (res.error) throw new Error(`Buyer lead error: ${res.error}`)
        finalLeadId = res.lead?.id || null
        finalBuyerUserId = res.lead?.buyer_user_id || null
      }

      if (!finalLeadId) {
        const { id: resolvedLeadId, error: leadError } = await resolveRelationId("lead", formData.leadValue, currentSite.id)
        if (leadError) throw new Error(`Lead error: ${leadError}`)
        finalLeadId = resolvedLeadId

        if (finalLeadId) {
          const matchingLead = leads.find(l => l.id === finalLeadId)
          if (matchingLead?.buyer_user_id) {
            finalBuyerUserId = matchingLead.buyer_user_id
          }
        }
      }

      const { id: resolvedSegmentId, error: segmentError } = await resolveRelationId("segment", formData.segmentValue, currentSite.id)
      if (segmentError) throw new Error(`Segment error: ${segmentError}`)

      const result = await createSale({
        ...formData,
        saleDate: formData.saleDate.toISOString(),
        leadId: finalLeadId || undefined,
        buyerUserId: finalBuyerUserId || undefined,
        segmentId: resolvedSegmentId || undefined,
        siteId: currentSite.id,
        campaignId: null // No campaign selected by default
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Sale created successfully")
      onOpenChange(false)
      
      // Reset form
      setBuyerUser(null)
      setFormData({
        title: "",
        productName: "",
        productType: "",
        amount: 0,
        amount_due: 0,
        status: "pending",
        source: "retail",
        leadValue: null,
        segmentValue: null,
        saleDate: new Date(),
        paymentMethod: "cash",
        locationId: locations.length === 1 ? locations[0].id : null
      })
      
      onSuccess?.()
    } catch (error: any) {
      console.error("Error creating sale:", error)
      toast.error(error.message || "Error creating sale")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Sale</DialogTitle>
          <DialogDescription>
            Add a new sale to your records.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="productName" className="text-right">
                Product
              </Label>
              <Input
                id="productName"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="productType" className="text-right">
                Type
              </Label>
              <Select
                name="productType"
                value={formData.productType}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    productType: value
                  }))
                }}
              >
                <SelectTrigger className="col-span-3 h-12">
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Physical Product">Physical Product</SelectItem>
                  <SelectItem value="Digital Product">Digital Product</SelectItem>
                  <SelectItem value="Service">Service</SelectItem>
                  <SelectItem value="Subscription">Subscription</SelectItem>
                  <SelectItem value="Course">Course</SelectItem>
                  <SelectItem value="Consultation">Consultation</SelectItem>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Clothing">Clothing</SelectItem>
                  <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                  <SelectItem value="Beauty & Health">Beauty & Health</SelectItem>
                  <SelectItem value="Food & Beverage">Food & Beverage</SelectItem>
                  <SelectItem value="Books & Media">Books & Media</SelectItem>
                  <SelectItem value="Sports & Recreation">Sports & Recreation</SelectItem>
                  <SelectItem value="Automotive">Automotive</SelectItem>
                  <SelectItem value="Travel & Tourism">Travel & Tourism</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Creative Services">Creative Services</SelectItem>
                  <SelectItem value="Technical Services">Technical Services</SelectItem>
                  <SelectItem value="Marketing Services">Marketing Services</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                className="col-span-3"
                required
                min={0}
                step={0.01}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount_due" className="text-right">
                Amount Due
              </Label>
              <Input
                id="amount_due"
                name="amount_due"
                type="number"
                value={formData.amount_due}
                onChange={handleChange}
                className="col-span-3"
                min={0}
                step={0.01}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                name="status"
                value={formData.status}
                onValueChange={(value: 'pending' | 'completed' | 'cancelled' | 'refunded') => {
                  setFormData(prev => ({
                    ...prev,
                    status: value
                  }))
                }}
              >
                <SelectTrigger className="col-span-3 h-12">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Buyer</Label>
              <div className="col-span-3">
                <BuyerUserEmailField 
                  value={buyerUser}
                  onChange={setBuyerUser}
                  disabled={loadingData}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="leadValue" className="text-right">
                Lead
              </Label>
              <div className="col-span-3">
                <RelationSelect
                  options={leads.map(l => ({ id: l.id, label: l.name || l.email }))}
                  value={formData.leadValue}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, leadValue: val }))}
                  placeholder={loadingData ? "Loading leads..." : (buyerUser ? "Optional: Lead will be auto-created" : "Select lead (optional)")}
                  emptyMessage="No leads found"
                  disabled={loadingData || !!buyerUser}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="segmentValue" className="text-right">
                Segment
              </Label>
              <div className="col-span-3">
                <RelationSelect
                  options={segments.map(s => ({ id: s.id, label: s.name }))}
                  value={formData.segmentValue}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, segmentValue: val }))}
                  placeholder={loadingData ? "Loading segments..." : "Select segment (optional)"}
                  emptyMessage="No segments found"
                  disabled={loadingData}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="source" className="text-right">
                Source
              </Label>
              <Select
                name="source"
                value={formData.source}
                onValueChange={(value: 'retail' | 'online') => {
                  setFormData(prev => ({
                    ...prev,
                    source: value
                  }))
                }}
              >
                <SelectTrigger className="col-span-3 h-12">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentMethod" className="text-right">
                Payment
              </Label>
              <Select
                name="paymentMethod"
                value={formData.paymentMethod}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    paymentMethod: value
                  }))
                }}
              >
                <SelectTrigger className="col-span-3 h-12">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="saleDate" className="text-right">
                Date
              </Label>
              <div className="col-span-3">
                <DatePicker
                  date={formData.saleDate}
                  setDate={handleDateChange}
                  className="h-12 w-full"
                  mode="report"
                />
              </div>
            </div>
            {locations.length > 1 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <div className="col-span-3">
                  <Select
                    name="locationId"
                    value={formData.locationId || "none"}
                    onValueChange={(value) => {
                      setFormData(prev => ({
                        ...prev,
                        locationId: value === "none" ? null : value
                      }))
                    }}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                  <span>Creating</span>
                </div>
              ) : "Create sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 