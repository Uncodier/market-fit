"use client"

import { useId } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Loader } from "@/app/components/ui/icons"
import { invoiceTotal, PAYMENT_METHODS } from "@/app/leads/payment-allocation"
import { useLeadPayment } from "./use-lead-payment"

export interface LeadPaymentDialogProps {
  leadId: string
  leadName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function LeadPaymentDialog(props: LeadPaymentDialogProps) {
  const { currentSite } = useSite()
  const permissions = useOptionalPermissions()
  const siteId = currentSite?.id || ""
  const canUpdate = !siteId.startsWith("demo-") && (permissions?.can("update") ?? true)
  // A site/lead change cancels the old session and cannot reuse its snapshot.
  return <PaymentSession key={`${siteId}:${props.leadId}`} {...props} siteId={siteId} canUpdate={canUpdate} />
}

function PaymentSession(props: LeadPaymentDialogProps & { siteId: string; canUpdate: boolean }) {
  const { leadName, open, onOpenChange, siteId, canUpdate } = props
  const payment = useLeadPayment(props)
  const id = useId()
  const locked = payment.saving || payment.uncertain || payment.reloadRequired
  const ready = siteId && canUpdate && !payment.loading && payment.snapshot && payment.invoices.length > 0

  return (
    <Dialog open={open} onOpenChange={next => { if (!payment.saving && !payment.uncertain) onOpenChange(next) }}>
      <DialogContent size="lg" busy={payment.saving || payment.uncertain} showClose={!payment.saving && !payment.uncertain}
        onClick={event => event.stopPropagation()}>
        <DialogForm onSubmit={event => { event.preventDefault(); void payment.submit() }}>
          <DialogHeader>
            <DialogTitle>Settle balance / Add payment</DialogTitle>
            <DialogDescription>
              Record a payment for {leadName}. Records a payment already received; does not charge a card.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            {!siteId ? <p role="alert">Select a site to record a payment.</p>
              : !canUpdate ? <p role="alert">You do not have permission to record invoice payments for this site.</p>
                : payment.loading ? <p role="status" className="flex items-center gap-2"><Loader className="h-4 w-4 animate-spin" />Loading open invoices…</p>
                  : payment.snapshot && payment.invoices.length === 0 ? (
                    <div className="rounded-md border p-4 space-y-2">
                      <p className="font-medium">No open invoice balance</p>
                      <p className="text-sm text-muted-foreground">There are no accessible open invoices with an amount due for this lead.</p>
                      <Button type="button" variant="outline" onClick={payment.refresh}>Reload invoices</Button>
                    </div>
                  ) : null}
            {payment.error && siteId && canUpdate && (
              <div className="rounded-md border border-destructive/30 p-3 space-y-2">
                <p role="alert" className="text-sm text-destructive">{payment.error}</p>
                {!payment.uncertain && <Button type="button" variant="outline" onClick={payment.refresh} disabled={payment.saving}>
                  {payment.snapshot ? "Reload invoices" : "Retry loading invoices"}
                </Button>}
              </div>
            )}
            {ready && (
              <>
                <div className="rounded-md bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium">Open balances by currency</p>
                  {payment.currencies.map(currency => (
                    <div key={currency} className="flex justify-between text-sm">
                      <span>{currency}</span><span>{money(invoiceTotal(payment.invoices, currency), currency)}</span>
                    </div>
                  ))}
                </div>
                <fieldset disabled={locked} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-currency`}>Payment currency</Label>
                    <Select value={payment.currency} onValueChange={payment.setCurrency} disabled={locked}>
                      <SelectTrigger id={`${id}-currency`}><SelectValue /></SelectTrigger>
                      <SelectContent>{payment.currencies.map(currency => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
                    </Select>
                    {payment.currencies.length > 1 && <p className="text-xs text-muted-foreground">Only invoices in the selected currency will be paid. Other currency balances remain unchanged.</p>}
                  </div>
                  <RadioGroup aria-label="Payment type" value={payment.mode} disabled={locked}
                    onValueChange={value => payment.setMode(value as "full" | "partial")}>
                    <div className="flex items-center gap-2"><RadioGroupItem id={`${id}-full`} value="full" /><Label htmlFor={`${id}-full`}>Settle full balance ({payment.currency})</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem id={`${id}-partial`} value="partial" /><Label htmlFor={`${id}-partial`}>Add partial payment</Label></div>
                  </RadioGroup>
                  {payment.mode === "partial" && <div className="space-y-2">
                    <Label htmlFor={`${id}-amount`}>Payment amount ({payment.currency})</Label>
                    <Input id={`${id}-amount`} type="number" inputMode="decimal" min="0.01" step="0.01" max={payment.total}
                      value={payment.amount} onChange={event => payment.setAmount(event.target.value)} required
                      aria-invalid={!!payment.amountError} aria-describedby={payment.amountError ? `${id}-amount-error` : undefined} />
                    {payment.amountError && <p id={`${id}-amount-error`} role="alert" className="text-sm text-destructive">{payment.amountError}</p>}
                  </div>}
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-method`}>Payment method</Label>
                    <Select value={payment.method} onValueChange={payment.setMethod} disabled={locked}>
                      <SelectTrigger id={`${id}-method`}><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-notes`}>Notes (optional)</Label>
                    <Textarea id={`${id}-notes`} value={payment.notes} onChange={event => payment.setNotes(event.target.value)} maxLength={2000} placeholder="Payment reference or notes" />
                  </div>
                </fieldset>
                <section className="space-y-2" aria-label="Payment allocation preview">
                  <h3 className="text-sm font-medium">Allocation preview</h3>
                  <p className="text-xs text-muted-foreground">Newest invoices are paid first, by sale date, then creation date. Balances are checked again when recording.</p>
                  {payment.valid ? <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead className="text-right">Payment</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader>
                        <TableBody>{payment.allocations.map(allocation => {
                          const invoice = payment.invoices.find(item => item.id === allocation.invoiceId)!
                          return <TableRow key={invoice.id}>
                            <TableCell><p className="font-medium">{invoice.title}</p><p className="text-xs text-muted-foreground">{invoice.invoiceNumber || invoice.id} · {invoice.saleDate.slice(0, 10)}</p></TableCell>
                            <TableCell className="text-right whitespace-nowrap">{money(allocation.amount, payment.currency)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{money(allocation.amountDue, payment.currency)}</TableCell>
                          </TableRow>
                        })}</TableBody>
                      </Table>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
                      <p className="flex justify-between"><span>Payment to record</span><strong>{money(payment.paymentAmount, payment.currency)}</strong></p>
                      <p className="flex justify-between"><span>Remaining balance ({payment.currency})</span><span>{money(Math.max(0, Math.round((payment.total - payment.paymentAmount) * 100) / 100), payment.currency)}</span></p>
                    </div>
                  </> : <p className="text-sm text-muted-foreground">Enter a valid amount to preview the invoice allocation.</p>}
                </section>
                {payment.uncertain && <p role="status" className="text-sm">Payment details are locked until confirmation. Retry uses the same request ID to prevent duplicate recording. Do not navigate away or switch sites before resolving this payment.</p>}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={payment.saving || payment.uncertain}>Cancel</Button>
            <Button type="submit" disabled={!ready || !payment.valid || payment.saving || payment.reloadRequired}>
              {payment.saving ? "Recording…" : payment.uncertain ? "Retry same payment" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}