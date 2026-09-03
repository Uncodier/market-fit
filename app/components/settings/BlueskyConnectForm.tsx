"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { BlueskyIcon } from "../ui/social-icons"

interface BlueskyConnectFormProps {
  siteId: string
  onConnected: () => void
}

export function BlueskyConnectForm({ siteId, onConnected }: BlueskyConnectFormProps) {
  const [handle, setHandle] = useState("")
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
        body: JSON.stringify({ handle, app_password: appPassword, siteId }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to connect Bluesky account")
      }

      onConnected()
    } catch (err: any) {
      setError(err.message || "Failed to connect Bluesky account")
    } finally {
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
            Enter your handle and an App Password (create one in Bluesky Settings &gt; Advanced &gt; App Passwords)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Handle</label>
          <Input 
            placeholder="e.g. yourbrand.bsky.social" 
            value={handle} 
            onChange={(e) => setHandle(e.target.value)} 
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">App Password</label>
          <Input 
            type="password" 
            placeholder="xxxx-xxxx-xxxx-xxxx" 
            value={appPassword} 
            onChange={(e) => setAppPassword(e.target.value)} 
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleConnect}
          disabled={loading || !handle || !appPassword}
          className="bg-[#1185fe] hover:bg-[#1185fe]/90 text-white"
        >
          {loading ? "Connecting..." : "Connect Account"}
        </Button>
      </div>
    </div>
  )
}
