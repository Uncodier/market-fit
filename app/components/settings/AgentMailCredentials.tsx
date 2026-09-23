"use client"

import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { CheckCircle2, Copy } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { copyTextToClipboard } from "./copy-to-clipboard"
import type { AgentMailSecretsState } from "./use-agentmail-secrets"

interface StoredSecretProps {
  label: string
  isSaving: boolean
  onRemove: () => void
}

function StoredSecret({ label, isSaving, onRemove }: StoredSecretProps) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/20 p-3">
      <CheckCircle2 className="h-4 w-4 text-green-500" />
      <span className="text-sm">{label} is securely stored in Vault</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto h-7 text-destructive hover:bg-destructive/10"
        onClick={onRemove}
        disabled={isSaving}
      >
        Remove
      </Button>
    </div>
  )
}

interface AgentMailCredentialsProps {
  secrets: AgentMailSecretsState
  webhookUrl: string
}

export function AgentMailCredentials({
  secrets,
  webhookUrl,
}: AgentMailCredentialsProps) {
  const copyWebhookUrl = async () => {
    if (!webhookUrl) return

    try {
      await copyTextToClipboard(webhookUrl)
      toast.success("Webhook URL copied to clipboard")
    } catch (error) {
      console.error("Failed to copy AgentMail webhook URL:", error)
      toast.error("Failed to copy webhook URL")
    }
  }

  return (
    <div className="space-y-5 border-b border-black/5 pb-5 dark:border-white/5">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          AgentMail API Key (BYOK)
        </Label>
        <p className="text-xs text-muted-foreground">
          Bring your own API key to bypass system rate limits and use your own AgentMail account.
        </p>
        {secrets.isApiKeyStored ? (
          <StoredSecret
            label="API key"
            isSaving={secrets.isSaving}
            onRemove={secrets.removeApiKey}
          />
        ) : (
          <Input
            type="password"
            autoComplete="off"
            placeholder="am_live_..."
            value={secrets.apiKey}
            onChange={(event) => secrets.setApiKey(event.target.value)}
            className="w-full font-mono text-sm"
            aria-label="AgentMail API key"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Webhook Signing Secret
        </Label>
        <p className="text-xs text-muted-foreground">
          Create an AgentMail webhook for the <code>message.received</code> event, then save its
          <code className="ml-1">whsec_...</code> signing secret here.
        </p>
        {secrets.isWebhookSecretStored ? (
          <StoredSecret
            label="Webhook secret"
            isSaving={secrets.isSaving}
            onRemove={secrets.removeWebhookSecret}
          />
        ) : (
          <Input
            type="password"
            autoComplete="off"
            placeholder="whsec_..."
            value={secrets.webhookSecret}
            onChange={(event) => secrets.setWebhookSecret(event.target.value)}
            className="w-full font-mono text-sm"
            aria-label="AgentMail webhook signing secret"
          />
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Webhook URL</Label>
        <div className="flex items-center gap-2">
          <Input
            value={webhookUrl}
            readOnly
            placeholder="API server URL is not configured"
            className="bg-muted/30 font-mono text-xs"
            aria-label="AgentMail webhook URL"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyWebhookUrl}
            disabled={!webhookUrl}
            aria-label="Copy AgentMail webhook URL"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste this URL into the destination URL field in AgentMail.
        </p>
      </div>
    </div>
  )
}
