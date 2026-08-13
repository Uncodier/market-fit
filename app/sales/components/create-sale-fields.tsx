"use client"

import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { BuyerUserEmailField, BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { Location } from "@/app/types"

export interface CreateSaleFormData {
  title: string
  productName: string
  productType: string
  amount: number
  amount_due: number
  status: "pending" | "completed" | "cancelled" | "refunded"
  source: "retail" | "online"
  leadValue: RelationSelectValue
  segmentValue: RelationSelectValue
  saleDate: Date
  paymentMethod: string
  locationId: string | null
}

const PRODUCT_TYPES = [
  "Physical Product",
  "Digital Product",
  "Service",
  "Subscription",
  "Course",
  "Consultation",
  "Software",
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Beauty & Health",
  "Food & Beverage",
  "Books & Media",
  "Sports & Recreation",
  "Automotive",
  "Travel & Tourism",
  "Professional Services",
  "Creative Services",
  "Technical Services",
  "Marketing Services",
  "Other",
] as const

interface CreateSaleFieldsProps {
  formData: CreateSaleFormData
  setFormData: React.Dispatch<React.SetStateAction<CreateSaleFormData>>
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDateChange: (date: Date) => void
  buyerUser: BuyerUser | null
  setBuyerUser: (user: BuyerUser | null) => void
  leads: Array<{ id: string; name: string; email: string }>
  segments: Array<{ id: string; name: string }>
  locations: Location[]
  loadingData: boolean
}

export function CreateSaleFields({
  formData,
  setFormData,
  onChange,
  onDateChange,
  buyerUser,
  setBuyerUser,
  leads,
  segments,
  locations,
  loadingData,
}: CreateSaleFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={onChange}
          required
          className="h-12"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="productName">Product</Label>
        <Input
          id="productName"
          name="productName"
          value={formData.productName}
          onChange={onChange}
          required
          className="h-12"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="productType">Type</Label>
        <Select
          value={formData.productType}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, productType: value }))
          }
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select product type" />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            value={formData.amount}
            onChange={onChange}
            required
            min={0}
            step={0.01}
            className="h-12"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="amount_due">Amount due</Label>
          <Input
            id="amount_due"
            name="amount_due"
            type="number"
            value={formData.amount_due}
            onChange={onChange}
            min={0}
            step={0.01}
            className="h-12"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value: CreateSaleFormData["status"]) =>
              setFormData((prev) => ({ ...prev, status: value }))
            }
          >
            <SelectTrigger className="h-12">
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
        <div className="grid gap-2">
          <Label htmlFor="source">Source</Label>
          <Select
            value={formData.source}
            onValueChange={(value: "retail" | "online") =>
              setFormData((prev) => ({ ...prev, source: value }))
            }
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Buyer</Label>
        <BuyerUserEmailField
          value={buyerUser}
          onChange={setBuyerUser}
          disabled={loadingData}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="leadValue">Lead</Label>
        <RelationSelect
          options={leads.map((l) => ({ id: l.id, label: l.name || l.email }))}
          value={formData.leadValue}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, leadValue: val }))
          }
          placeholder={
            loadingData
              ? "Loading leads..."
              : buyerUser
                ? "Optional: Lead will be auto-created"
                : "Select lead (optional)"
          }
          emptyMessage="No leads found"
          disabled={loadingData || !!buyerUser}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="segmentValue">Segment</Label>
        <RelationSelect
          options={segments.map((s) => ({ id: s.id, label: s.name }))}
          value={formData.segmentValue}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, segmentValue: val }))
          }
          placeholder={
            loadingData ? "Loading segments..." : "Select segment (optional)"
          }
          emptyMessage="No segments found"
          disabled={loadingData}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="paymentMethod">Payment</Label>
          <Select
            value={formData.paymentMethod}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, paymentMethod: value }))
            }
          >
            <SelectTrigger className="h-12">
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
        <div className="grid gap-2">
          <Label htmlFor="saleDate">Date</Label>
          <DatePicker
            date={formData.saleDate}
            setDate={onDateChange}
            className="h-12 w-full"
            mode="report"
          />
        </div>
      </div>
      {locations.length > 1 && (
        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Select
            value={formData.locationId || "none"}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                locationId: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  )
}
