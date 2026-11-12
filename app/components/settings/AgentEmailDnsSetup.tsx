"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Download } from "@/app/components/ui/icons"
import { EmailDnsSetup } from "./EmailChannelSetupViews"
import { copyTextToClipboard } from "./copy-to-clipboard"
import type { useAgentEmailChannel } from "./use-agent-email-channel"

export function AgentEmailDnsSetup({ channel, domain }: {
  channel: ReturnType<typeof useAgentEmailChannel>
  domain: string
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const retryTime = `${Math.floor(channel.cooldownSeconds / 60)}:${String(
    channel.cooldownSeconds % 60,
  ).padStart(2, "0")}`
  const error = channel.agentEmail?.error_message || channel.agentEmail?.data?.error_message

  const copy = async (text: string, id: string) => {
    try {
      await copyTextToClipboard(text)
      setCopied(id)
      toast.success("DNS record copied to clipboard")
    } catch {
      toast.error("Failed to copy DNS record")
    }
  }

  return (
    <EmailDnsSetup
      domain={domain}
      domainStatus={channel.agentEmail?.domain_status || channel.agentEmail?.data?.domain_status || "pending"}
      records={channel.dnsRecords}
      copied={copied}
      isProcessing={channel.isVerifying}
      isSyncingCloudflare={channel.isSyncingCloudflare}
      isCloudflareConnected={channel.isCloudflareConnected}
      onCopy={copy}
      onSync={channel.syncCloudflare}
      onVerify={channel.verifyDomain}
      verifyDisabled={!channel.canVerify}
      verifyLabel={channel.cooldownSeconds > 0 ? `Verify again in ${retryTime}` : undefined}
      notice={(
        <>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          {!channel.hasDnsRecords && (
            <p className="text-xs text-muted-foreground">
              No DNS records are available to preview yet. Try downloading the DNS file.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            DNS changes may take time to propagate. After a verification attempt, wait five minutes before checking again.
          </p>
        </>
      )}
      additionalActions={(
        <Button type="button" variant="outline" onClick={channel.getDnsFiles} disabled={channel.isGettingDnsFiles}>
          <Download className="mr-2 h-4 w-4" />
          {channel.isGettingDnsFiles ? "Downloading..." : "Download DNS file"}
        </Button>
      )}
    />
  )
}