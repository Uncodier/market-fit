import { z } from "zod"

export const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "wire_transfer", label: "Wire Transfer" },
] as const

export interface LeadOpenInvoice {
  id: string
  title: string
  invoiceNumber: string | null
  amountDue: number
  currency: string
  saleDate: string
  createdAt: string
  updatedAt: string
  status: string
}

export interface LeadPaymentAllocation {
  invoiceId: string
  amount: number
  amountDue: number
}

export interface LeadInvoicePayment {
  requestId: string
  amount: number
  currency: string
  allocations: (LeadPaymentAllocation & { previousStatus: string; status: string })[]
}

export const leadPaymentScopeSchema = z.object({
  siteId: z.string().uuid(),
  leadId: z.string().uuid(),
})

export const leadInvoicePaymentSchema = leadPaymentScopeSchema.extend({
  requestId: z.string().uuid(),
  version: z.string().regex(/^[a-f0-9]{32}$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  mode: z.enum(["full", "partial"]),
  amount: z.number().finite().positive().max(999999999999).optional(),
  method: z.string().refine(value => PAYMENT_METHODS.some(method => method.value === value)),
  notes: z.string().trim().max(2000).default(""),
}).superRefine((value, context) => {
  if (value.mode === "partial" && (value.amount === undefined || Math.abs(value.amount * 100 - Math.round(value.amount * 100)) > 0.0001)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a positive amount with at most two decimals", path: ["amount"] })
  }
})

export type LeadInvoicePaymentInput = z.input<typeof leadInvoicePaymentSchema>

export function invoiceTotal(invoices: LeadOpenInvoice[], currency: string): number {
  return invoices.filter(invoice => invoice.currency === currency)
    .reduce((total, invoice) => total + Math.round(invoice.amountDue * 100), 0) / 100
}

/** Preview only: PostgreSQL recalculates the allocation from locked balances. */
export function allocateLeadPayment(invoices: LeadOpenInvoice[], amount: number, currency: string): LeadPaymentAllocation[] {
  let remaining = Math.round(amount * 100)
  if (!Number.isFinite(amount) || remaining <= 0 || amount > invoiceTotal(invoices, currency)) return []
  const ordered = invoices.filter(invoice => invoice.currency === currency && invoice.amountDue > 0)
    .sort((a, b) => b.saleDate.localeCompare(a.saleDate) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  const allocations: LeadPaymentAllocation[] = []
  for (const invoice of ordered) {
    if (!remaining) break
    const due = Math.round(invoice.amountDue * 100)
    const paid = Math.min(due, remaining)
    allocations.push({ invoiceId: invoice.id, amount: paid / 100, amountDue: (due - paid) / 100 })
    remaining -= paid
  }
  return allocations
}