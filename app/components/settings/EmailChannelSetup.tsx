import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { Copy, Check } from "@/app/components/ui/icons"
import { SectionCardFooter, SectionCardContent } from "@/app/components/ui/section-card"

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

  const metadata = channel.metadata || {}
  const domainStatus = metadata.domain_status || "not_started" // not_started, pending, verified, failed
  const dnsRecords = metadata.dns_records || []
  const hasSender = !!channel.zavu_sender_id
  const emailReceivingEnabled = !!metadata.emailReceivingEnabled

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

  const handleToggleReceiving = async (enabled: boolean) => {
    if (!channel.zavu_sender_id) return

    setIsProcessing(true)
    try {
      const response = await apiClient.patch("/api/integrations/zavu/channels/email", {
        siteId,
        channelId: channel.id,
        senderId: channel.zavu_sender_id,
        emailReceivingEnabled: enabled
      })

      if (!response.success) throw new Error(response.error?.message || "Failed to update receiving status")

      onUpdated({
        metadata: {
          ...metadata,
          emailReceivingEnabled: enabled
        }
      })
      toast.success(`Email receiving ${enabled ? 'enabled' : 'disabled'}`)
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
            Add these CNAME records to your DNS provider for {metadata.domain}
          </p>

          <div className="space-y-3">
            {dnsRecords.map((record: any, idx: number) => (
              <div key={idx} className="p-3 bg-background rounded border text-xs font-mono space-y-2">
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
              </div>
            ))}
          </div>
        </SectionCardContent>

        <SectionCardFooter>
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
    <SectionCardContent className="space-y-4 pt-0">
      <div className="space-y-4 p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Inbound Emails</h4>
          <p className="text-xs text-muted-foreground">
            To receive emails, add this MX record to your DNS:
          </p>
          <div className="p-3 bg-background rounded border text-xs font-mono flex justify-between items-center">
            <span>{metadata.domain} MX 10 inbound.zavu.dev</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(`${metadata.domain} MX 10 inbound.zavu.dev`, 'mx')}>
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
            checked={emailReceivingEnabled}
            onCheckedChange={handleToggleReceiving}
            disabled={isProcessing}
          />
        </div>
      </div>
    </SectionCardContent>
  )
}
