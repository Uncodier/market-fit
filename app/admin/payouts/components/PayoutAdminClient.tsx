"use client"

import React, { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"

export function PayoutAdminClient({ initialPayouts }: { initialPayouts: any[] }) {
  const [payouts, setPayouts] = useState(initialPayouts)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleMarkAsPaid = async (payoutId: string) => {
    if (!confirm("Are you sure you have completed this transfer in the bank?")) return

    setProcessingId(payoutId)
    try {
      const response = await fetch('/api/payouts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payoutId, status: 'completed' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update payout')
      }

      toast.success("Payout marked as completed")
      setPayouts(payouts.filter(p => p.id !== payoutId))
    } catch (err: any) {
      toast.error(err.message)
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
        No pending payouts at this time.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={exportCSV} variant="outline">
          Download Wise CSV Template
        </Button>
      </div>
      
      <div className="rounded-xl border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Site</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Amount</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Bank Details</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Requested At</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {payouts.map((p) => {
                const bank = p.bank_details || {}
                return (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle">{p.site?.name || 'Unknown Site'}</td>
                    <td className="p-4 align-middle font-medium">${Number(p.requested_credits).toFixed(2)}</td>
                    <td className="p-4 align-middle">
                      <div className="text-xs">
                        <div><span className="font-semibold">Name:</span> {bank.accountName}</div>
                        <div><span className="font-semibold">Bank:</span> {bank.bankName}</div>
                        <div><span className="font-semibold">Routing:</span> {bank.routingNumber}</div>
                        <div><span className="font-semibold">Account:</span> {bank.accountNumber}</div>
                      </div>
                    </td>
                    <td className="p-4 align-middle">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-4 align-middle text-right">
                      <Button 
                        size="sm" 
                        onClick={() => handleMarkAsPaid(p.id)}
                        disabled={processingId === p.id}
                      >
                        {processingId === p.id ? "Processing..." : "Mark as Paid"}
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
