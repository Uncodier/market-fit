"use client"

import React, { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

interface Payout {
  id: string
  requested_credits: number | string
  created_at: string
  site?: { name?: string | null } | null
  bank_details?: {
    accountName?: string
    bankName?: string
    routingNumber?: string
    accountNumber?: string
  } | null
}

export function PayoutAdminClient({ initialPayouts }: { initialPayouts: Payout[] }) {
  const { t, locale } = useLocalization()
  const [payouts, setPayouts] = useState(initialPayouts)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleMarkAsPaid = async (payoutId: string) => {
    if (!confirm(t("content.payouts.confirmTransfer"))) return

    setProcessingId(payoutId)
    try {
      const response = await fetch('/api/payouts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId, status: 'completed' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || t("content.payouts.updateFailed"))
      }

      toast.success(t("content.payouts.completed"))
      setPayouts(payouts.filter(p => p.id !== payoutId))
    } catch {
      toast.error(t("content.payouts.updateFailed"))
    } finally {
      setProcessingId(null)
    }
  }

  const exportCSV = () => {
    if (payouts.length === 0) return
    
    // Wise Batch Format example
    const headers = ["Recipient Name", "Recipient Account", "Routing Number", "Amount", "Currency"]
    const rows = payouts.map(p => {
      const bank = p.bank_details || {}
      return [
        `"${bank.accountName || ''}"`,
        `"${bank.accountNumber || ''}"`,
        `"${bank.routingNumber || ''}"`,
        p.requested_credits,
        "USD"
      ].join(",")
    })
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `payouts_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (payouts.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground">
        {t("content.payouts.empty")}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={exportCSV} variant="outline">
          {t("content.payouts.downloadCsv")}
        </Button>
      </div>
      
      <div className="rounded-xl border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t("content.payouts.site")}</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t("content.payouts.amount")}</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t("content.payouts.bankDetails")}</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">{t("content.payouts.requestedAt")}</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">{t("content.payouts.actions")}</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {payouts.map((p) => {
                const bank = p.bank_details || {}
                return (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle">{p.site?.name || t("content.payouts.unknownSite")}</td>
                    <td className="p-4 align-middle font-medium">${Number(p.requested_credits).toFixed(2)}</td>
                    <td className="p-4 align-middle">
                      <div className="text-xs">
                        <div><span className="font-semibold">{t("content.payouts.name")}:</span> {bank.accountName}</div>
                        <div><span className="font-semibold">{t("content.payouts.bank")}:</span> {bank.bankName}</div>
                        <div><span className="font-semibold">{t("content.payouts.routing")}:</span> {bank.routingNumber}</div>
                        <div><span className="font-semibold">{t("content.payouts.account")}:</span> {bank.accountNumber}</div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">{new Date(p.created_at).toLocaleString(locale)}</td>
                    <td className="p-4 align-middle text-right">
                      <Button 
                        size="sm" 
                        onClick={() => handleMarkAsPaid(p.id)}
                        disabled={processingId === p.id}
                      >
                        {processingId === p.id ? t("content.payouts.processing") : t("content.payouts.markPaid")}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
