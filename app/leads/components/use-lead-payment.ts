"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { getLeadOpenInvoices, registerLeadInvoicePayment } from "@/app/leads/payment-actions"
import { allocateLeadPayment, invoiceTotal, PAYMENT_METHODS, type LeadOpenInvoice } from "@/app/leads/payment-allocation"

type PaymentInput = Parameters<typeof registerLeadInvoicePayment>[0]
type Snapshot = { invoices: LeadOpenInvoice[]; version: string }

export function useLeadPayment({
  siteId, leadId, open, canUpdate, onOpenChange, onSuccess,
}: {
  siteId: string
  leadId: string
  open: boolean
  canUpdate: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [uncertain, setUncertain] = useState(false)
  const [reloadRequired, setReloadRequired] = useState(false)
  const [reload, setReload] = useState(0)
  const [currency, setCurrency] = useState("")
  const [mode, setMode] = useState<"full" | "partial">("full")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0].value)
  const [notes, setNotes] = useState("")
  const request = useRef<{ key: string; payload: Readonly<PaymentInput> } | null>(null)
  const inFlight = useRef(false)
  const unconfirmed = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!uncertain) return
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [uncertain])

  useEffect(() => {
    const currentGeneration = ++generation.current
    let cancelled = false
    if (!open || !canUpdate || !siteId) return
    // Preserve an unconfirmed receipt, including its snapshot, across closing.
    if (request.current && unconfirmed.current) return
    setLoading(true)
    setSnapshot(null)
    setError("")
    setReloadRequired(false)
    setMode("full")
    setAmount("")
    setMethod(PAYMENT_METHODS[0].value)
    setNotes("")
    request.current = null
    void getLeadOpenInvoices(siteId, leadId).then(result => {
      if (cancelled || generation.current !== currentGeneration) return
      if (result.error || !result.snapshot) {
        setError(result.error || "Unable to load open invoices. Please retry.")
        return
      }
      setSnapshot(result.snapshot)
      setCurrency(result.snapshot.invoices[0]?.currency || "")
    }).catch(() => {
      if (!cancelled) setError("Unable to load open invoices. Check your connection and retry.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true; generation.current = currentGeneration + 1 }
  }, [open, siteId, leadId, canUpdate, reload])

  const invoices = snapshot?.invoices || []
  const currencies = Array.from(new Set(invoices.map(invoice => invoice.currency)))
  const total = invoiceTotal(invoices, currency)
  const paymentAmount = mode === "full" ? total : Number(amount)
  const validAmount = mode === "full" || (/^\d+(\.\d{1,2})?$/.test(amount) && Number.isFinite(paymentAmount))
  const valid = total > 0 && validAmount && paymentAmount > 0 && paymentAmount <= total && notes.length <= 2000
  const allocations = valid ? allocateLeadPayment(invoices, paymentAmount, currency) : []
  const amountError = mode === "partial" && amount !== "" && !validAmount
    ? "Enter a positive amount with at most two decimals."
    : mode === "partial" && amount !== "" && (paymentAmount <= 0 || paymentAmount > total)
      ? "Payment must be greater than zero and cannot exceed this currency's balance."
      : ""

  const refresh = () => {
    if (inFlight.current || uncertain) return
    request.current = null
    setReload(value => value + 1)
  }

  const submit = async () => {
    if (inFlight.current || !canUpdate || !snapshot || !valid || reloadRequired) return
    const values = {
      siteId, leadId, version: snapshot.version, currency, mode,
      ...(mode === "partial" ? { amount: paymentAmount } : {}), method, notes: notes.trim(),
    }
    const key = JSON.stringify(values)
    if (!request.current || (!unconfirmed.current && request.current.key !== key)) {
      request.current = { key, payload: Object.freeze({ ...values, requestId: crypto.randomUUID() }) }
    }
    const payload = request.current.payload
    const currentGeneration = generation.current
    inFlight.current = true
    setSaving(true)
    unconfirmed.current = true
    setUncertain(true)
    setError("")
    try {
      const result = await registerLeadInvoicePayment(payload)
      if (!mounted.current || generation.current !== currentGeneration) return
      if (!result.payment) {
        const message = result.error || "Unable to confirm the payment. Retry the same payment details."
        const needsReload = /reload/i.test(message)
        const isUnconfirmed = /unable to confirm|same payment details|same payment|same details/i.test(message)
        unconfirmed.current = isUnconfirmed && !needsReload
        setReloadRequired(needsReload)
        setUncertain(unconfirmed.current)
        setError(message)
        return
      }
      request.current = null
      unconfirmed.current = false
      setUncertain(false)
      window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId, leadId } }))
      if (result.warning) toast.warning(result.warning)
      else toast.success("Payment recorded successfully")
      onOpenChange(false)
      try { onSuccess?.() } catch { toast.warning("Payment recorded, but this view could not refresh. Reload the page; do not enter the payment again.") }
    } catch {
      if (mounted.current && generation.current === currentGeneration) {
        setError("Payment confirmation was interrupted. Retry this exact payment; do not record it again elsewhere.")
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return {
    invoices, snapshot, loading, saving, error, uncertain, reloadRequired, currencies,
    currency, setCurrency, mode, setMode, amount, setAmount, method, setMethod, notes, setNotes,
    total, paymentAmount, amountError, allocations, valid, refresh, submit,
  }
}