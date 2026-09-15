import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { Copy, Check, Cloud } from "@/app/components/ui/icons"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"
import { secretsService } from "@/app/services/secrets-service"

export function EmailChannelSetup({ 
  siteId, 
  channel, 
  onUpdated 
}: { 
  siteId: string, 
  channel: any, 
  onUpdated: (payload: any) => void 
}) {
  const [domain, setDomain] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [fromEmail, setFromEmail] = useState("noreply")
  const [fromName, setFromName] = useState("")

  const [isCloudflareConnected, setIsCloudflareConnected] = useState(false)
  const [isSyncingCloudflare, setIsSyncingCloudflare] = useState(false)

  const [isMxVerified, setIsMxVerified] = useState<boolean | null>(null)
  const [isVerifyingMx, setIsVerifyingMx] = useState(false)
  const [localReceivingEnabled, setLocalReceivingEnabled] = useState(!!channel.metadata?.emailReceivingEnabled)

  useEffect(() => {
    setLocalReceivingEnabled(!!channel.metadata?.emailReceivingEnabled)
  }, [channel.metadata?.emailReceivingEnabled])

  useEffect(() => {
    const checkSecrets = async () => {
      if (siteId) {
        const cfExists = await secretsService.checkSecretExists(siteId, 'cloudflare', 'dns_sync')
        setIsCloudflareConnected(cfExists)
      }
    }
    checkSecrets()
  }, [siteId])

  const metadata = channel.metadata || {}
  const domainStatus = metadata.domain_status || "not_started" // not_started, pending, verified, failed
  const dnsRecords = metadata.dns_records || []
  const hasSender = !!channel.zavu_sender_id
  const emailReceivingEnabled = !!metadata.emailReceivingEnabled

  // Check MX record for inbound emails
  useEffect(() => {
    if (hasSender && metadata.domain) {
      handleVerifyMx()
    }
  }, [hasSender, metadata.domain])

  const handleVerifyMx = async () => {
    if (!metadata.domain) return
    setIsVerifyingMx(true)
    try {
      const res = await fetch(`/api/dns/verify-mx?domain=${metadata.domain}`)
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to verify MX record")
      }

      setIsMxVerified(data.verified)
      if (data.verified) {
        toast.success("MX record verified. You can now enable receiving.")
      } else {
        toast.error("MX record is not available yet. DNS propagation may take a few minutes.")
      }
    } catch (error: any) {
      setIsMxVerified(false)
      toast.error(error.message || "Failed to verify MX record")
    } finally {
      setIsVerifyingMx(false)
    }
  }

  // Trigger sync if coming back from oauth
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('cloudflare_sync_pending') === 'true' && isCloudflareConnected && dnsRecords.length > 0 && !isSyncingCloudflare) {
      // Clean url to avoid multiple syncs
      const newUrl = window.location.pathname + window.location.search.replace(/&?cloudflare_sync_pending=true/, '')
      window.history.replaceState({}, document.title, newUrl)
      
      // Auto trigger sync
      handleSyncCloudflare()
    }
  }, [isCloudflareConnected, dnsRecords.length])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toast.success("Copied to clipboard")
  }

  const handleAddDomain = async () => {
    if (!domain) {
      toast.error("Domain is required")
      return
    }

    setIsProcessing(true)
    try {
      const response = await apiClient.post("/api/integrations/zavu/email-domains", {
        domain,
        siteId,
        channelId: channel.id,
        name: channel.name,
      })
      if (!response.success) throw new Error(response.error?.message || "Failed to add domain")

      const newDomain = response.data?.domain
      if (!newDomain?.id) throw new Error("Domain was added but the response was incomplete")

      onUpdated({
        status: "pending",
        metadata: {
          ...metadata,
          email_domain_id: newDomain.id,
          domain: newDomain.domain,
          domain_status: newDomain.status || "pending",
          dns_records: newDomain.dnsRecords || [],
        },
      })
      toast.success("Domain added. Please configure DNS records.")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSyncCloudflare = async () => {
    if (!isCloudflareConnected) {
      window.location.href = `/api/integrations/cloudflare/oauth/authorize?site_id=${siteId}`
      return
    }

    if (!siteId || !metadata.domain || !dnsRecords.length) return

    setIsSyncingCloudflare(true)
    try {
      const response = await fetch('/api/integrations/cloudflare/sync/zavu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          domain: metadata.domain,
          records: dnsRecords
        })
      })

      const data = await response.json()
      if (response.status === 401 && data.code === "cloudflare_reauth_required") {
        toast.error(data.error)
        window.location.href = `/api/integrations/cloudflare/oauth/authorize?site_id=${siteId}`
        return
      }

      if (response.ok && data.success) {
        toast.success("DNS records synced with Cloudflare successfully")
      } else {
        toast.error(data.error || "Failed to sync DNS records")
      }
    } catch (error: any) {
      console.error("Error syncing with Cloudflare:", error)
      toast.error("An error occurred while syncing with Cloudflare")
    } finally {
      setIsSyncingCloudflare(false)
    }
  }

  const handleSyncMxCloudflare = async () => {
    if (!isCloudflareConnected) {
      window.location.href = `/api/integrations/cloudflare/oauth/authorize?site_id=${siteId}`
      return
    }

    if (!siteId || !metadata.domain) return

    setIsSyncingCloudflare(true)
    try {
      const response = await fetch('/api/integrations/cloudflare/sync/zavu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          domain: metadata.domain,
          records: [{
            type: 'MX',
            name: metadata.domain,
            value: 'inbound.zavu.dev',
            priority: 10
          }]
        })
      })

      const data = await response.json()
      if (response.status === 401 && data.code === "cloudflare_reauth_required") {
        toast.error(data.error)
        window.location.href = `/api/integrations/cloudflare/oauth/authorize?site_id=${siteId}`
        return
      }

      if (response.ok && data.success) {
        toast.success("MX record synced with Cloudflare successfully")
      } else {
        toast.error(data.error || "Failed to sync MX record")
      }
    } catch (error: any) {
      console.error("Error syncing MX with Cloudflare:", error)
      toast.error("An error occurred while syncing with Cloudflare")
    } finally {
      setIsSyncingCloudflare(false)
    }
  }

  const handleVerifyDomain = async () => {
    if (!metadata.email_domain_id) return

    setIsProcessing(true)
    try {
      const response = await apiClient.post(`/api/integrations/zavu/email-domains/${metadata.email_domain_id}/verify`, {
        siteId,
        channelId: channel.id,
      })
      if (!response.success) throw new Error(response.error?.message || "Failed to verify domain")

      const updatedDomain = response.data?.domain
      if (!updatedDomain) throw new Error("Verification started but the response was incomplete")

      onUpdated({
        metadata: {
          ...metadata,
          domain_status: updatedDomain.status,
          dns_records: updatedDomain.dnsRecords || metadata.dns_records,
        },
      })
      toast.success("Verification check started")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateSender = async () => {
    if (!fromEmail || !fromName) {
      toast.error("From address and name are required")
      return
    }

    setIsProcessing(true)
    try {
      const fullEmail = `${fromEmail}@${metadata.domain}`
      const response = await apiClient.post("/api/integrations/zavu/channels/email", {
        siteId,
        channelId: channel.id,
        name: channel.name,
        emailAddress: fullEmail,
        emailFromName: fromName,
        emailDomainId: metadata.email_domain_id,
        active: true,
      })

      if (!response.success) throw new Error(response.error?.message || "Failed to create sender")

      onUpdated({
        zavu_sender_id: response.data.senderId,
        status: "connected",
        metadata: {
          ...metadata,
          from_address: fullEmail,
          from_name: fromName,
          emailReceivingEnabled: false,
        }
      })
      toast.success("Email sender created")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveReceiving = async () => {
    if (!channel.zavu_sender_id) return

    setIsProcessing(true)
    try {
      const response = await apiClient.put("/api/integrations/zavu/channels/email", {
        siteId,
        channelId: channel.id,
        senderId: channel.zavu_sender_id,
        emailReceivingEnabled: localReceivingEnabled
      })

      if (!response.success) throw new Error(response.error?.message || "Failed to update receiving status")

      const responseData = response.data as
        | { emailReceivingEnabled?: boolean; sender?: { emailReceivingEnabled?: boolean } }
        | undefined
      const appliedReceivingEnabled =
        responseData?.sender?.emailReceivingEnabled ??
        responseData?.emailReceivingEnabled

      if (typeof appliedReceivingEnabled !== "boolean") {
        throw new Error("Zavu updated the sender but returned an incomplete response")
      }

      if (localReceivingEnabled && !appliedReceivingEnabled) {
        setLocalReceivingEnabled(false)
        setIsMxVerified(false)
        throw new Error("Zavu could not enable receiving. Verify that the MX record has propagated.")
      }

      onUpdated({
        metadata: {
          ...metadata,
          emailReceivingEnabled: appliedReceivingEnabled
        }
      })
      toast.success(`Email receiving ${appliedReceivingEnabled ? 'enabled' : 'disabled'}`)
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsProcessing(false)
    }
  }

  // Step 1: Add Domain
  if (!metadata.email_domain_id) {
    return (
      <>
        <SectionCardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">1. Add Your Domain</h4>
            <p className="text-xs text-muted-foreground">
              Enter the domain you want to send emails from (e.g., yourcompany.com)
            </p>
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="yourcompany.com" 
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <Button 
            type="button" 
            onClick={handleAddDomain} 
            disabled={isProcessing || !domain}
          >
            {isProcessing ? "Adding..." : "Add Domain"}
          </Button>
        </SectionCardFooter>
      </>
    )
  }

  // Step 2: Verify DNS
  if (domainStatus !== "verified") {
    return (
      <>
        <SectionCardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">2. Configure DNS Records</h4>
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded capitalize">
              {domainStatus}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Add these DNS records to your DNS provider for {metadata.domain}
          </p>

          <div className="space-y-3">
            {dnsRecords.map((record: any, idx: number) => (
              <div key={idx} className="p-3 bg-background rounded border text-xs font-mono space-y-2">
                {record.type && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-bold">{record.type}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Name/Host:</span>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[200px]">{record.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(record.name, `name-${idx}`)}>
                      {copied === `name-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Value/Target:</span>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[200px]">{record.value}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(record.value, `val-${idx}`)}>
                      {copied === `val-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                {record.type === 'MX' && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Priority:</span>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">{record.priority || '10'}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard((record.priority || '10').toString(), `prio-${idx}`)}>
                        {copied === `prio-${idx}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCardContent>

        <SectionCardFooter className="justify-end gap-2 flex-wrap">
          <Button 
            type="button" 
            variant="outline"
            onClick={handleSyncCloudflare} 
            disabled={isProcessing || isSyncingCloudflare || !dnsRecords.length}
          >
            <Cloud className="h-4 w-4 mr-2" />
            {isSyncingCloudflare ? "Syncing..." : isCloudflareConnected ? "Sync with Cloudflare" : "Connect Cloudflare"}
          </Button>
          <Button 
            type="button" 
            variant="secondary"
            onClick={handleVerifyDomain} 
            disabled={isProcessing}
          >
            {isProcessing ? "Verifying..." : "Verify DNS"}
          </Button>
        </SectionCardFooter>
      </>
    )
  }

  // Step 3: Create Sender
  if (!hasSender) {
    return (
      <>
        <SectionCardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">3. Configure Email Address</h4>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
              Domain Verified
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Set up the email address your agent will use
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">From Address</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="text-right"
                />
                <span className="text-muted-foreground text-sm">@{metadata.domain}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">From Name</Label>
              <Input 
                placeholder="e.g. Acme Support"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
              />
            </div>
          </div>
        </SectionCardContent>

        <SectionCardFooter>
          <Button 
            type="button" 
            onClick={handleCreateSender} 
            disabled={isProcessing || !fromEmail || !fromName}
          >
            {isProcessing ? "Creating..." : "Create Email Channel"}
          </Button>
        </SectionCardFooter>
      </>
    )
  }

  // Step 4: Manage Existing Sender (Inbound config)
  return (
    <>
      <SectionCardContent className="space-y-4 pt-0">
        <div className="space-y-4 p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Inbound Emails</h4>
              {isMxVerified !== null && (
                <span className={`text-xs px-2 py-1 rounded capitalize ${
                  isMxVerified ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                }`}>
                  {isVerifyingMx ? "Checking..." : isMxVerified ? "Verified" : "Pending"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              To receive emails, add this MX record to your DNS:
            </p>
            <div className="p-3 bg-background rounded border text-xs font-mono flex items-center gap-2">
              <span className="flex-1 truncate">{metadata.domain} MX 10 inbound.zavu.dev</span>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(`${metadata.domain} MX 10 inbound.zavu.dev`, 'mx')}>
                {copied === 'mx' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-background rounded border">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Receiving</Label>
              <p className="text-xs text-muted-foreground">
                Allow the agent to receive inbound emails
              </p>
            </div>
            <Switch 
              checked={localReceivingEnabled}
              onCheckedChange={setLocalReceivingEnabled}
              disabled={isProcessing || (!emailReceivingEnabled && isMxVerified !== true)}
            />
          </div>
        </div>
      </SectionCardContent>
      <SectionCardFooter className="justify-end gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={handleSyncMxCloudflare}
          disabled={isProcessing || isSyncingCloudflare}
        >
          <Cloud className="h-4 w-4 mr-2" />
          {isSyncingCloudflare ? "Syncing..." : isCloudflareConnected ? "Sync with Cloudflare" : "Connect Cloudflare"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleVerifyMx}
          disabled={isProcessing || isVerifyingMx}
        >
          {isVerifyingMx ? "Checking..." : "Verify MX"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveReceiving}
          disabled={isProcessing || localReceivingEnabled === emailReceivingEnabled}
        >
          {isProcessing ? "Saving..." : "Save Changes"}
        </Button>
      </SectionCardFooter>
    </>
  )
}
