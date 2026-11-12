"use client"

import { Button } from "@/app/components/ui/button"
import {
  AlertCircle,
  CheckCircle2,
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
import { ChannelSetupStepper, type ChannelSetupStep } from "./ChannelSetupStepper"
import { AgentEmailDnsSetup } from "./AgentEmailDnsSetup"
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

  const emailUsername =
    channel.agentEmail?.username || channel.agentEmail?.data?.username
  const emailDisplayName =
    channel.agentEmail?.displayName || channel.agentEmail?.data?.displayName
  const emailDomain = channel.agentEmail?.domain === "custom"
    ? channel.agentEmail.customDomain
      || channel.agentEmail.data?.customDomain
      || channel.agentEmail.data?.domain
    : channel.agentEmail?.domain || channel.agentEmail?.data?.domain
  const setupSteps: ChannelSetupStep[] = [
    { label: "Email address", status: channel.isNotConfigured || channel.isPending ? "current" : "complete" },
    ...(channel.domain === "custom" || channel.isWaitingForVerification ? [{
      label: "Verify DNS",
      status: channel.isWaitingForVerification ? "current" as const : channel.isActive ? "complete" as const : "upcoming" as const,
    }] : []),
    { label: "Ready", status: channel.isActive ? "complete" : "upcoming" },
  ]
  const descriptions = {
    not_configured: "Choose an email address to start setting up your agent's email channel.",
    pending: "Your request has been submitted. Email setup is in progress.",
    waiting_for_verification: "Verify your domain to continue setting up your agent's email channel.",
    active: "Manage your agent's email address and connection settings.",
  }

  return (
    <SectionCard id="agent-email-channel">
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Agent Email Channel
        </SectionCardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          {descriptions[channel.status]}
        </p>
      </SectionCardHeader>

      <ChannelSetupStepper steps={setupSteps} className="px-5 pb-5" />

      <SectionCardContent className="space-y-4 pb-4">
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
                No action is needed right now. We&apos;ll contact you to complete the setup.
              </p>
            </div>
          </div>
        )}

        {!channel.isActive && !channel.isNotConfigured && emailUsername && emailDomain && (
          <p className="break-all text-sm text-muted-foreground">
            Requested address: <span className="font-mono text-foreground">{emailUsername}@{emailDomain}</span>
          </p>
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
                    <span className="min-w-0 break-all font-mono">{emailUsername}@{emailDomain}</span>
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
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Advanced: AgentMail credentials & webhooks
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Use these settings for your own AgentMail account or webhook configuration.
            {channel.isWaitingForVerification && " These settings do not verify your DNS records."}
          </p>
          <div className="mt-4 space-y-4">
            <AgentMailCredentials secrets={secrets} webhookUrl={webhookUrl} />
            {secrets.isDirty && (
              <Button
                type="button" variant="outline"
                onClick={() => void secrets.savePendingSecrets()}
                disabled={secrets.isSaving}
              >
                {secrets.isSaving ? "Saving..." : "Save credentials"}
              </Button>
            )}
          </div>
        </details>
      </SectionCardContent>

      {channel.isWaitingForVerification && (
        <AgentEmailDnsSetup key={siteId} channel={channel} domain={emailDomain || channel.customDomain} />
      )}

      {(channel.isNotConfigured || channel.isActive) && <SectionCardFooter className="flex-wrap">
        {channel.isNotConfigured && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Configure your agent email address above
            </div>
            <Button
              type="button"
              onClick={async () => {
                if (await secrets.savePendingSecrets()) await channel.requestAgentEmail()
              }}
              disabled={channel.isRequesting || secrets.isSaving || !channel.canRequest}
            >
              {channel.isRequesting ? "Requesting..." : "Request Agent Email"}
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
      </SectionCardFooter>}

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

    </SectionCard>
  )
}
