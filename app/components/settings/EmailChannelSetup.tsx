import { useState, useEffect } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { secretsService } from "@/app/services/secrets-service"
import { EmailDnsSetup, EmailInboundSettings } from "./EmailChannelSetupViews"
import { isEmailChannelActive } from "./email-channel-utils"
import { useEmailChannelActivation } from "./use-email-channel-activation"
import { useEmailReceivingUpdate } from "./use-email-receiving-update"
import { useZavuEmailDomainSync } from "./use-zavu-email-domain-sync"
import { ChannelSetupStepper } from "./ChannelSetupStepper"
import { buildEmailSetupSteps } from "./channel-setup-steps"
import { buildEmailDomainUpdate } from "./email-domain-update"
import { ZAVU_INBOUND_MX_HOST, ZAVU_INBOUND_MX_PRIORITY } from "@/lib/zavu-email-dns"
import { EmailDomainSelector } from "./EmailDomainSelector"
import { EmailAddressSetup } from "./EmailAddressSetup"
import { getEmailDomainOptions, type EmailDomainConnection } from "./email-domain-options"
import type { SiteFormValues } from "./form-schema"

type EmailConnection = NonNullable<SiteFormValues["channels"]["connections"]>[number]
type EmailSetupChannel = Partial<Pick<EmailConnection, "name" | "zavu_sender_id" | "metadata">> & { id: string; status?: string }
type EmailSetupUpdate = Pick<EmailConnection, "zavu_sender_id" | "metadata"> & { status?: string }

function setupErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function EmailChannelSetup({ 
  siteId, 
  channel, 
  connections = [],
  onUpdated,
}: { 
  siteId: string, 
  channel: EmailSetupChannel,
  connections?: readonly EmailDomainConnection[],
  onUpdated: (payload: EmailSetupUpdate) => void | Promise<void>
}) {
  const metadata = channel.metadata || {}
  const domainStatus = metadata.domain_status || "not_started"
  const dnsRecords = metadata.dns_records || []
  const hasSender = !!channel.zavu_sender_id
  const emailReceivingEnabled = !!metadata.emailReceivingEnabled

  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const [fromEmail, setFromEmail] = useState("noreply")
  const [fromName, setFromName] = useState("")
  const canCreateSender = Boolean(fromName.trim()
    && z.string().email().safeParse(`${fromEmail.trim()}@${metadata.domain}`).success)
  const domains = getEmailDomainOptions(connections, channel.id)

  const [isCloudflareConnected, setIsCloudflareConnected] = useState(false)
  const [isSyncingCloudflare, setIsSyncingCloudflare] = useState(false)

  const [isMxVerified, setIsMxVerified] = useState<boolean | null>(
    emailReceivingEnabled ? true : null
  )
  const [isVerifyingMx, setIsVerifyingMx] = useState(false)
  const {
    activateEmailChannel,
    isActivating,
    isEmailChannelActive: emailChannelActive,
  } = useEmailChannelActivation({ siteId, channel, metadata, onUpdated })
  const {
    isUpdating: isUpdatingReceiving,
    receivingEnabled: localReceivingEnabled,
    setReceivingEnabled: setLocalReceivingEnabled,
    saveReceiving: handleSaveReceiving,
  } = useEmailReceivingUpdate({
    siteId,
    channel,
    metadata,
    channelActive: emailChannelActive,
    activateChannel: activateEmailChannel,
    onUpdated,
  })
  useZavuEmailDomainSync({
    siteId,
    channelId: channel.id,
    domainId: metadata.email_domain_id,
    status: domainStatus,
    enabled: true,
    onDomainChange: async (updatedDomain) => {
      await onUpdated(buildEmailDomainUpdate(metadata, updatedDomain, emailChannelActive))
    },
  })
  const setupSteps = buildEmailSetupSteps({
    domainVerified: domainStatus === "verified",
    senderConfigured: hasSender,
    inboundEnabled: emailReceivingEnabled,
    channelActive: emailChannelActive,
  })

  useEffect(() => {
    if (emailReceivingEnabled) setIsMxVerified(true)
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

      if (!data.verified) {
        setIsMxVerified(false)
        toast.error("MX record is not available yet. DNS propagation may take a few minutes.")
        return
      }

      if (metadata.email_domain_id) {
        const response = await apiClient.post(
          `/api/integrations/zavu/email-domains/${metadata.email_domain_id}/verify`,
          { siteId, channelId: channel.id }
        )
        if (!response.success) {
          throw new Error(response.error?.message || "Zavu could not refresh the MX verification")
        }
        const updatedDomain = response.data?.domain
        if (!updatedDomain) throw new Error("Zavu returned an incomplete domain verification")
        await onUpdated(buildEmailDomainUpdate(metadata, updatedDomain, emailChannelActive))
        if (updatedDomain.status !== "verified") {
          setIsMxVerified(false)
          toast.error("MX record is still pending in Zavu. Check DNS propagation and retry.")
          return
        }
      }

      setIsMxVerified(true)
      toast.success("MX record rechecked in Zavu. You can now enable receiving.")
    } catch (error) {
      setIsMxVerified(false)
      toast.error(setupErrorMessage(error, "Failed to verify MX record"))
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
    } catch (error) {
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
    } catch (error) {
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

      await onUpdated(buildEmailDomainUpdate(metadata, updatedDomain, emailChannelActive))
      toast.success("Verification check started")
    } catch (error) {
      toast.error(setupErrorMessage(error, "An error occurred"))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateSender = async () => {
    if (isProcessing || !canCreateSender) {
      toast.error("From address and name are required")
      return
    }

    setIsProcessing(true)
    try {
      const fullEmail = `${fromEmail.trim()}@${metadata.domain}`
      const response = await apiClient.post("/api/integrations/zavu/channels/email", {
        siteId,
        channelId: channel.id,
        name: channel.name,
        emailAddress: fullEmail,
        emailFromName: fromName.trim(),
        emailDomainId: metadata.email_domain_id,
      })

      if (!response.success) throw new Error(response.error?.message || "Failed to create sender")
      if (!response.data?.senderId) throw new Error("Zavu did not confirm the new email sender")

      const channelActive = isEmailChannelActive(response.data)
      await onUpdated({
        zavu_sender_id: response.data.senderId,
        status: channelActive ? "connected" : "in_progress",
        metadata: {
          ...metadata,
          from_address: fullEmail,
          from_name: fromName.trim(),
          emailReceivingEnabled: false,
          emailChannelActive: channelActive,
        }
      })
      toast.success(channelActive ? "Email channel created and activated" : "Email sender created")
    } catch (error) {
      toast.error(setupErrorMessage(error, "An error occurred"))
    } finally {
      setIsProcessing(false)
    }
  }

  // Step 1: Choose an exact domain; the server determines whether it can be reused.
  if (!metadata.email_domain_id) {
    return (
      <>
        <ChannelSetupStepper steps={setupSteps} className="px-5 pb-5" />
        <EmailDomainSelector
          key={`${siteId}:${channel.id}`}
          siteId={siteId}
          channelId={channel.id}
          channelName={channel.name}
          domains={domains}
          onUpdated={(payload) => onUpdated({ ...payload, metadata: { ...metadata, ...payload.metadata } })}
        />
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
        <EmailAddressSetup
          domain={metadata.domain}
          fromEmail={fromEmail}
          fromName={fromName}
          isProcessing={isProcessing}
          canCreate={canCreateSender}
          onEmailChange={setFromEmail}
          onNameChange={setFromName}
          onCreate={handleCreateSender}
        />
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
        isProcessing={isProcessing || isUpdatingReceiving}
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
