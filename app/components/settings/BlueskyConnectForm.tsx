"use client"

import { useId, useState } from "react"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { BlueskyIcon } from "../ui/social-icons"

interface BlueskyConnectFormProps {
  siteId: string
  onConnected: () => void
  onCancel?: () => void
  existingHandle?: string
}

export function BlueskyConnectForm({ siteId, onConnected, onCancel, existingHandle }: BlueskyConnectFormProps) {
  const id = useId()
  const { showBillingLimitFromError } = useBillingLimit()
  const [handle, setHandle] = useState(existingHandle || "")
  const [appPassword, setAppPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    if (!handle || !appPassword) {
      setError("Handle and app password are required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/social/bluesky/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ handle: handle.trim(), app_password: appPassword, siteId }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        if (!showBillingLimitFromError(data)) {
          setError(typeof data.error === "string" ? data.error : "Failed to connect Bluesky account")
        }
        return
      }

      onConnected()
    } catch {
      setError("Failed to connect Bluesky account. Please try again.")
    } finally {
      setAppPassword("")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full font-inter font-bold bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 text-[#1185fe]">
          <BlueskyIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Connect Bluesky Account
          </p>
          <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">
            Enter your handle and an app password from{" "}
            <a className="underline" href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">Bluesky settings</a>.
            Do not use your regular password.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-handle`} className="text-xs font-medium text-muted-foreground">Handle</label>
          <Input 
            id={`${id}-handle`} maxLength={255} autoCapitalize="none" spellCheck={false} readOnly={!!existingHandle}
            placeholder="e.g. yourbrand.bsky.social" 
            value={handle} 
            onChange={(e) => setHandle(e.target.value)} 
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-password`} className="text-xs font-medium text-muted-foreground">App Password</label>
          <Input 
            id={`${id}-password`} maxLength={128} autoComplete="off"
            type="password" 
            placeholder="xxxx-xxxx-xxxx-xxxx" 
            value={appPassword} 
            onChange={(e) => setAppPassword(e.target.value)} 
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>}
        <Button
          type="button"
          onClick={handleConnect}
          disabled={loading || !handle.trim() || !appPassword.trim()}
          className="bg-[#1185fe] hover:bg-[#1185fe]/90 text-white"
        >
          {loading ? "Connecting..." : onCancel ? "Reconnect Account" : "Connect Account"}
        </Button>
      </div>
    </div>
  )
}
