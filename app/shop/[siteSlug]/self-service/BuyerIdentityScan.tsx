"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/components/ui/dialog"
import { resolveAppApiUrl } from "@/app/commerce/app-api-url"
import { useSelfService } from "./SelfServiceProvider"

/** Raw mf:user UUIDs are never an identity credential at a public kiosk. */
export function isSignedBuyerCode(code: string) {
  return /^mf:buyer:[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(code) && code.length <= 1024
}

export function BuyerIdentityScan({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { context, setIdentity } = useSelfService()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [camera, setCamera] = useState(false)
  const id = `buyer-qr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const submitRef = useRef<(code: string) => Promise<void>>(async () => {})
  const inFlight = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    generation.current += 1
    return () => { generation.current += 1 }
  }, [open])

  async function submit(value: string) {
    const trimmed = value.trim()
    if (inFlight.current) return
    if (!isSignedBuyerCode(trimmed)) {
      setError("Use the signed buyer QR code from your account. Raw user IDs are not accepted.")
      return
    }
    const current = generation.current
    inFlight.current = true
    setLoading(true)
    setError("")
    setCamera(false)
    try {
      const response = await fetch(resolveAppApiUrl("/api/commerce/buyer-identity"), {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
        body: JSON.stringify({ code: trimmed, locationId: context.location.id }),
      })
      const result = await response.json()
      if (current !== generation.current) return
      if (!response.ok || typeof result.name !== "string") {
        setError(result.error || "This code is invalid or expired. Refresh it in your account and try again.")
        return
      }
      setIdentity({ code: trimmed, name: result.name })
      setCode("")
      onOpenChange(false)
    } catch {
      if (current === generation.current) setError("Unable to verify your code. Please try again.")
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }
  useEffect(() => { submitRef.current = submit })

  useEffect(() => {
    if (!open || !camera) return
    let cancelled = false
    let scanner: import("html5-qrcode").Html5Qrcode | null = null
    let starting: Promise<unknown> | null = null
    const stop = async () => {
      await starting?.catch(() => {})
      if (scanner?.isScanning) await scanner.stop().catch(() => {})
      try { scanner?.clear() } catch { /* Cleanup can race a denied camera start. */ }
    }
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return
      scanner = new Html5Qrcode(id)
      starting = scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } },
        (value) => { if (!cancelled) void submitRef.current(value) }, () => {})
      starting.catch(() => {
        if (!cancelled) { setError("Camera unavailable. Allow camera access or paste your buyer code below."); setCamera(false) }
      })
    }).catch(() => { if (!cancelled) { setError("Camera unavailable. Paste your buyer code below."); setCamera(false) } })
    return () => { cancelled = true; void stop() }
  }, [open, camera, id])

  return <Dialog open={open} onOpenChange={(value) => { setCamera(false); setError(""); if (!value) setCode(""); onOpenChange(value) }}>
    <DialogContent>
      <DialogHeader><DialogTitle>Scan buyer QR</DialogTitle>
        <DialogDescription>Optional: link this order to your account using its signed buyer QR. You can also continue anonymously.</DialogDescription>
      </DialogHeader>
      <Button type="button" variant="outline" disabled={loading} onClick={() => { setError(""); setCamera(!camera) }}>
        {camera ? "Stop camera" : "Use camera"}
      </Button>
      {camera && <div id={id} aria-label="Buyer QR camera" className="min-h-64 overflow-hidden rounded-lg" />}
      <form onSubmit={(event) => { event.preventDefault(); void submit(code) }} className="space-y-3">
        <label htmlFor={`${id}-code`} className="text-sm font-medium">Paste or type buyer code</label>
        <Input id={`${id}-code`} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" maxLength={1024} placeholder="mf:buyer:…" disabled={loading} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !code.trim()} className="w-full">{loading ? "Verifying…" : "Verify buyer code"}</Button>
      </form>
    </DialogContent>
  </Dialog>
}