"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { createSale } from "@/app/sales/actions"
import { useSite } from "@/app/context/SiteContext"

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
  status: 'pending' | 'completed' | 'cancelled' | 'refunded'
  source: 'retail' | 'online'
  saleDate: string
  paymentMethod: string
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
  const { currentSite } = useSite()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: "",
    productName: "",
    productType: "",
    amount: 0,
    status: "pending",
    source: "retail",
    saleDate: new Date().toISOString().split('T')[0],
    paymentMethod: "cash"
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentSite?.id) return

    setLoading(true)
    try {
      const result = await createSale({
        ...formData,
        amount_due: formData.amount, // Set initial amount_due equal to amount
        siteId: currentSite.id,
        campaignId: null // No campaign selected by default
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Sale created successfully")
      onOpenChange(false)
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
      <DialogContent className="sm:max-w-[425px]">
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
              <Input
                id="saleDate"
                name="saleDate"
                type="date"
                value={formData.saleDate}
                onChange={handleChange}
                className="col-span-3"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 