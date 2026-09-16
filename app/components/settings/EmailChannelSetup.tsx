import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"
import { secretsService } from "@/app/services/secrets-service"
import { EmailDnsSetup, EmailInboundSettings } from "./EmailChannelSetupViews"
import { isEmailChannelActive, resolveEmailReceivingEnabled } from "./email-channel-utils"
import { useEmailChannelActivation } from "./use-email-channel-activation"
import { ChannelSetupStepper } from "./ChannelSetupStepper"
import { buildEmailSetupSteps } from "./channel-setup-steps"
import { ZAVU_INBOUND_MX_HOST, ZAVU_INBOUND_MX_PRIORITY } from "@/lib/zavu-email-dns"

export function EmailChannelSetup({ 
  siteId, 
  channel, 
  onUpdated 
}: { 
  siteId: string, 
  channel: any, 
  onUpdated: (payload: any) => void 
}) {
  const metadata = channel.metadata || {}
  const domainStatus = metadata.domain_status || "not_started"
  const dnsRecords = metadata.dns_records || []
  const hasSender = !!channel.zavu_sender_id
  const emailReceivingEnabled = !!metadata.emailReceivingEnabled

  const [domain, setDomain] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [fromEmail, setFromEmail] = useState("noreply")
  const [fromName, setFromName] = useState("")

  const [isCloudflareConnected, setIsCloudflareConnected] = useState(false)
  const [isSyncingCloudflare, setIsSyncingCloudflare] = useState(false)

  const [isMxVerified, setIsMxVerified] = useState<boolean | null>(
    emailReceivingEnabled ? true : null
  )
  const [isVerifyingMx, setIsVerifyingMx] = useState(false)
  const [localReceivingEnabled, setLocalReceivingEnabled] = useState(emailReceivingEnabled)
  const {
    activateEmailChannel,
    isActivating,
    isEmailChannelActive: emailChannelActive,
  } = useEmailChannelActivation({ siteId, channel, metadata, onUpdated })
  const setupSteps = buildEmailSetupSteps({
    domainVerified: domainStatus === "verified",
    inboundEnabled: emailReceivingEnabled,
    channelActive: emailChannelActive,
  })

  useEffect(() => {
    setLocalReceivingEnabled(emailReceivingEnabled)
    if (emailReceivingEnabled) {
      setIsMxVerified(true)
    }
  }, [emailReceivingEnabled])

  useEffect(() => {
    const checkSecrets = async () => {
      if (siteId) {
        const cfExists = await secretsService.checkSecretExists(siteId, 'cloudflare', 'dns_sync')
        setIsCloudflareConnected(cfExists)
      }
    }
    checkSecrets()
  }, [siteId])

  // Check MX record for inbound emails
  useEffect(() => {
    if (hasSender && metadata.domain && !emailReceivingEnabled) {
      handleVerifyMx()
    }
  }, [hasSender, metadata.domain, emailReceivingEnabled])

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
            value: ZAVU_INBOUND_MX_HOST,
            priority: ZAVU_INBOUND_MX_PRIORITY
          }],
          replaceConflictingInboundMx: true
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
      })

      if (!response.success) throw new Error(response.error?.message || "Failed to create sender")

      const channelActive = isEmailChannelActive(response.data)
      onUpdated({
        zavu_sender_id: response.data.senderId,
        status: channelActive ? "connected" : "in_progress",
        metadata: {
          ...metadata,
          from_address: fullEmail,
          from_name: fromName,
          emailReceivingEnabled: false,
          emailChannelActive: channelActive,
        }
      })
      toast.success(channelActive ? "Email channel created and activated" : "Email sender created")
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

      const appliedReceivingEnabled = resolveEmailReceivingEnabled(
        response.data,
        localReceivingEnabled
      )

      if (localReceivingEnabled && !appliedReceivingEnabled) {
        setLocalReceivingEnabled(false)
        setIsMxVerified(false)
        throw new Error("Zavu could not enable receiving. Verify that the MX record has propagated.")
      }

      setLocalReceivingEnabled(appliedReceivingEnabled)
      if (appliedReceivingEnabled) {
        setIsMxVerified(true)
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
        <ChannelSetupStepper steps={setupSteps} className="px-5 pb-5" />
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
        <ChannelSetupStepper steps={setupSteps} className="px-5 pb-5" />
        <EmailDnsSetup
          domain={metadata.domain}
          domainStatus={domainStatus}
          records={dnsRecords}
          copied={copied}
          isProcessing={isProcessing}
          isSyncingCloudflare={isSyncingCloudflare}
          isCloudflareConnected={isCloudflareConnected}
          onCopy={copyToClipboard}
          onSync={handleSyncCloudflare}
          onVerify={handleVerifyDomain}
        />
      </>
    )
  }

  // Step 3: Create Sender
  if (!hasSender) {
    return (
      <>
        <ChannelSetupStepper steps={setupSteps} className="px-5 pb-5" />
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
  const isMxConfigured = emailReceivingEnabled || isMxVerified === true
  const hasReceivingChanges = localReceivingEnabled !== emailReceivingEnabled

  return (
    <>
      <ChannelSetupStepper steps={setupSteps} className="px-5 pb-5" />
      <EmailInboundSettings
        domain={metadata.domain}
        copied={copied}
        isMxConfigured={isMxConfigured}
        isMxVerified={isMxVerified}
        isVerifyingMx={isVerifyingMx}
        isProcessing={isProcessing}
        isSyncingCloudflare={isSyncingCloudflare}
        isCloudflareConnected={isCloudflareConnected}
        isChannelActive={emailChannelActive}
        isActivating={isActivating}
        receivingEnabled={localReceivingEnabled}
        hasReceivingChanges={hasReceivingChanges}
        onCopy={copyToClipboard}
        onReceivingChange={setLocalReceivingEnabled}
        onSync={handleSyncMxCloudflare}
        onVerify={handleVerifyMx}
        onSave={handleSaveReceiving}
        onActivate={activateEmailChannel}
      />
    </>
  )
}
