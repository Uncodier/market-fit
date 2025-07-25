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
  leadId: string
  segmentId: string
  saleDate: Date
  paymentMethod: string
}

interface Lead {
  id: string
  name: string
  email: string
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
  const [loadingData, setLoadingData] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: "",
    productName: "",
    productType: "",
    amount: 0,
    amount_due: 0,
    status: "pending",
    source: "retail",
    leadId: "none",
    segmentId: "none",
    saleDate: new Date(),
    paymentMethod: "cash"
  })

  // Load leads and segments when dialog opens
  useEffect(() => {
    if (open && currentSite?.id) {
      loadLeadsAndSegments()
    }
  }, [open, currentSite?.id])

  // Remove the automatic amount_due manipulation - let user control it completely
  // useEffect(() => {
  //   if (formData.status === "pending") {
  //     setFormData(prev => ({
  //       ...prev,
  //       amount_due: 0
  //     }))
  //   } else {
  //     // For other statuses, set amount_due to the full amount if it's currently 0
  //     if (formData.amount_due === 0) {
  //       setFormData(prev => ({
  //         ...prev,
  //         amount_due: prev.amount
  //       }))
  //     }
  //   }
  // }, [formData.status, formData.amount])

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
          name: lead.name,
          email: lead.email
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
      const result = await createSale({
        ...formData,
        saleDate: formData.saleDate.toISOString(),
        leadId: formData.leadId === "none" ? undefined : formData.leadId,
        segmentId: formData.segmentId === "none" ? undefined : formData.segmentId,
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
      setFormData({
        title: "",
        productName: "",
        productType: "",
        amount: 0,
        amount_due: 0,
        status: "pending",
        source: "retail",
        leadId: "none",
        segmentId: "none",
        saleDate: new Date(),
        paymentMethod: "cash"
      })
      
      onSuccess?.()
    } catch (error) {
      console.error("Error creating sale:", error)
      toast.error("Error creating sale")
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
                <SelectTrigger className="col-span-3">
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
                <SelectTrigger className="col-span-3">
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
              <Label htmlFor="leadId" className="text-right">
                Lead
              </Label>
              <Select
                name="leadId"
                value={formData.leadId}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    leadId: value
                  }))
                }}
                disabled={loadingData}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={loadingData ? "Loading leads..." : "Select lead (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Lead</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} ({lead.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="segmentId" className="text-right">
                Segment
              </Label>
              <Select
                name="segmentId"
                value={formData.segmentId}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    segmentId: value
                  }))
                }}
                disabled={loadingData}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={loadingData ? "Loading segments..." : "Select segment (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Segment</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <SelectTrigger className="col-span-3">
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
                <SelectTrigger className="col-span-3">
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
                  className="w-full"
                  mode="report"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? "Creating..." : "Create sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 