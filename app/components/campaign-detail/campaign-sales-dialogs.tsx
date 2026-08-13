"use client"

import React from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"

type SaleForm = {
  title: string
  amount: string
  status: string
  productName?: string
  saleDate: string
  paymentMethod: string
  source: string
  notes?: string
}

function SaleFields({
  values,
  onChange,
  idPrefix,
}: {
  values: SaleForm
  onChange: (name: string, value: string) => void
  idPrefix: string
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title*</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title || ""}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Sale title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-amount`}>Amount ($)*</Label>
        <Input
          id={`${idPrefix}-amount`}
          type="number"
          placeholder="0"
          value={values.amount || ""}
          onChange={(e) => onChange("amount", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-saleDate`}>Sale Date*</Label>
        <Input
          id={`${idPrefix}-saleDate`}
          type="date"
          value={values.saleDate || ""}
          onChange={(e) => onChange("saleDate", e.target.value)}
          max={new Date().toISOString().split("T")[0]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <Select value={values.status} onValueChange={(value) => onChange("status", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-productName`}>Product Name</Label>
        <Input
          id={`${idPrefix}-productName`}
          placeholder="Product or service name"
          value={values.productName || ""}
          onChange={(e) => onChange("productName", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-paymentMethod`}>Payment Method</Label>
        <Select value={values.paymentMethod} onValueChange={(value) => onChange("paymentMethod", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="credit_card">Credit Card</SelectItem>
            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-source`}>Source</Label>
        <Select value={values.source} onValueChange={(value) => onChange("source", value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="retail">Retail</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {"notes" in values && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
          <Input
            id={`${idPrefix}-notes`}
            placeholder="Any additional notes"
            value={values.notes || ""}
            onChange={(e) => onChange("notes", e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

export function CreateSaleDialog({
  open,
  onOpenChange,
  values,
  onChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  values: SaleForm
  onChange: (name: string, value: string) => void
  onSubmit: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Add New Sale</AlertDialogTitle>
          <AlertDialogDescription>
            Enter the details of the new sale for this campaign.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <SaleFields values={values} onChange={onChange} idPrefix="create" />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit}>Create Sale</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function EditSaleDialog({
  open,
  onOpenChange,
  values,
  onChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  values: SaleForm | null
  onChange: (name: string, value: string) => void
  onSubmit: () => void
}) {
  if (!values) return null
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Sale</AlertDialogTitle>
          <AlertDialogDescription>Update the sale details below.</AlertDialogDescription>
        </AlertDialogHeader>
        <SaleFields values={values} onChange={onChange} idPrefix="edit" />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit}>Update Sale</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function DeleteSaleDialog({
  open,
  onOpenChange,
  onCancel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
        onOpenChange(next)
      }}
      title="Delete sale"
      description="Are you sure you want to delete this sale? This action cannot be undone."
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={onConfirm}
    />
  )
}
