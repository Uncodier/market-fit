"use client"

import { Button } from "@/app/components/ui/button"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Download,
  Mail,
  Trash2,
} from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import {
  SectionCard,
  SectionCardContent,
  SectionCardFooter,
  SectionCardHeader,
  SectionCardTitle,
} from "@/app/components/ui/section-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import type { SiteFormValues } from "./form-schema"
import { apiClient } from "@/app/services/api-client-service"
import { AgentEmailDnsDialog } from "./AgentEmailDnsDialog"
import { AgentMailCredentials } from "./AgentMailCredentials"
import { buildAgentMailWebhookUrl } from "./agentmail-settings"
import { useAgentEmailChannel } from "./use-agent-email-channel"
import { useAgentMailSecrets } from "./use-agentmail-secrets"

interface AgentEmailSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void | Promise<void>
}

export function AgentEmailSection({
  active,
  siteId,
  onSave,
}: AgentEmailSectionProps) {
  const channel = useAgentEmailChannel({ siteId, onSave })
  const secrets = useAgentMailSecrets(siteId)
  const webhookUrl = buildAgentMailWebhookUrl(apiClient.getApiUrl())

  if (!active) return null

  const save = async () => {
    if (!(await secrets.savePendingSecrets())) return
    await channel.saveForm()
  }

  const emailUsername =
    channel.agentEmail?.username || channel.agentEmail?.data?.username
  const emailDisplayName =
    channel.agentEmail?.displayName || channel.agentEmail?.data?.displayName
  const emailDomain = channel.agentEmail?.domain === "custom"
    ? channel.agentEmail.customDomain
      || channel.agentEmail.data?.customDomain
      || channel.agentEmail.data?.domain
    : channel.agentEmail?.domain || channel.agentEmail?.data?.domain
  const errorMessage =
    channel.agentEmail?.error_message || channel.agentEmail?.data?.error_message

  return (
    <SectionCard id="agent-email-channel">
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Agent Email Channel
        </SectionCardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Request an agent email address for automated customer communication
        </p>
      </SectionCardHeader>

      <SectionCardContent className="space-y-4 pb-4">
        <AgentMailCredentials secrets={secrets} webhookUrl={webhookUrl} />

        {channel.isNotConfigured && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Domain</Label>
              <Select
                value={channel.domain || ""}
                onValueChange={(value: "makinari.email" | "custom") => {
                  channel.form.setValue("channels.agent_email.domain", value)
                  if (value !== "custom") {
                    channel.form.setValue("channels.agent_email.customDomain", "")
                  }
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="makinari.email">makinari.email</SelectItem>
                  <SelectItem value="custom">Custom Domain</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose between our managed domain or use your own custom domain
              </p>
            </div>

            {channel.domain === "custom" && (
              <div>
                <Label className="text-sm font-medium text-foreground">Custom Domain</Label>
                <Input
                  placeholder="example.com"
                  value={channel.customDomain}
                  onChange={(event) => channel.form.setValue(
                    "channels.agent_email.customDomain",
                    event.target.value,
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter your custom domain without @ or www
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-foreground">Username</Label>
              <Input
                placeholder="support"
                value={channel.username}
                onChange={(event) => channel.form.setValue(
                  "channels.agent_email.username",
                  event.target.value,
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The username part of the email address, such as support@domain.com
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Display Name</Label>
              <Input
                placeholder="Support Team"
                value={channel.displayName}
                onChange={(event) => channel.form.setValue(
                  "channels.agent_email.displayName",
                  event.target.value,
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The display name shown to recipients
              </p>
            </div>
          </div>
        )}

        {channel.isPending && (
          <div className="flex items-center space-x-2 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Agent email request submitted</p>
              <p className="text-xs text-muted-foreground">
                Your request is being processed. We&apos;ll contact you to complete the setup.
              </p>
            </div>
          </div>
        )}

        {channel.isWaitingForVerification && (
          <div className="flex items-center space-x-2 rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Waiting for DNS verification</p>
              <p className="text-xs text-muted-foreground">
                Configure your DNS records using the zone file, then verify your domain.
              </p>
              {errorMessage && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
        )}

        {channel.isActive && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Agent email active</p>
                <p className="text-xs text-muted-foreground">
                  Your agent email is configured and ready to use
                </p>
              </div>
            </div>

            {emailUsername && emailDomain && (
              <div className="space-y-2">
                <div>
                  <Label className="text-sm font-medium text-foreground">Email Address</Label>
                  <div className="mt-1 flex items-center gap-2 rounded-md border bg-gray-50 p-3 dark:bg-gray-900">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{emailUsername}@{emailDomain}</span>
                  </div>
                </div>
                {emailDisplayName && (
                  <div>
                    <Label className="text-sm font-medium text-foreground">Display Name</Label>
                    <div className="mt-1 rounded-md border bg-gray-50 p-3 dark:bg-gray-900">
                      {emailDisplayName}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SectionCardContent>

      <SectionCardFooter
        onSave={save}
        saving={channel.isSaving || secrets.isSaving}
        dirty={channel.form.formState.isDirty || secrets.isDirty}
      >
        {channel.isNotConfigured && (
          <div className="mr-2 flex w-full items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Configure your agent email address above
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={channel.requestAgentEmail}
              disabled={channel.isRequesting || !channel.canRequest}
            >
              {channel.isRequesting ? "Requesting..." : "Request Agent Email"}
            </Button>
          </div>
        )}

        {channel.isWaitingForVerification && (
          <div className="mr-2 flex w-full items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={channel.syncCloudflare}
              disabled={channel.isSyncingCloudflare || !channel.hasDnsRecords}
            >
              <Cloud className="mr-2 h-4 w-4" />
              {channel.isSyncingCloudflare
                ? "Syncing..."
                : channel.isCloudflareConnected
                  ? "Sync with Cloudflare"
                  : "Connect Cloudflare"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => channel.setShowDnsModal(true)}
              disabled={!channel.hasDnsRecords}
            >
              <Copy className="mr-2 h-4 w-4" />
              View All & Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={channel.getDnsFiles}
              disabled={channel.isGettingDnsFiles}
            >
              <Download className="mr-2 h-4 w-4" />
              {channel.isGettingDnsFiles ? "Getting..." : "Get DNS Files"}
            </Button>
            <Button
              type="button"
              onClick={channel.verifyDomain}
              disabled={channel.isVerifying || !channel.canVerify}
            >
              <Check className="mr-2 h-4 w-4" />
              {channel.isVerifying
                ? "Verifying..."
                : !channel.canVerify
                  ? `Verify (${Math.floor(channel.cooldownSeconds / 60)}:${String(
                    channel.cooldownSeconds % 60,
                  ).padStart(2, "0")})`
                  : "Verify"}
            </Button>
          </div>
        )}

        {channel.isActive && (
          <div className="mr-2 flex w-full items-center justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={() => channel.setShowDeleteDialog(true)}
              disabled={channel.isDeleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Inbox
            </Button>
          </div>
        )}
      </SectionCardFooter>

      <AlertDialog
        open={channel.showDeleteDialog}
        onOpenChange={channel.setShowDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Inbox
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inbox? This action cannot be undone and all
              email functionality for this inbox will be permanently removed.
            </AlertDialogDescription>
            {emailUsername && emailDomain && (
              <div className="mt-2 rounded border bg-muted/50 p-2">
                <span className="text-sm font-medium">{emailUsername}@{emailDomain}</span>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={channel.isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={channel.deleteInbox}
              disabled={channel.isDeleting}
              className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            >
              {channel.isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgentEmailDnsDialog
        open={channel.showDnsModal}
        onOpenChange={channel.setShowDnsModal}
        records={channel.dnsRecords}
        isCloudflareConnected={channel.isCloudflareConnected}
        isSyncingCloudflare={channel.isSyncingCloudflare}
        onSyncCloudflare={channel.syncCloudflare}
      />
    </SectionCard>
  )
}
