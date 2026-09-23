"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { secretsService } from "@/app/services/secrets-service"
import {
  AGENTMAIL_API_KEY_SECRET,
  AGENTMAIL_WEBHOOK_SECRET,
} from "./agentmail-settings"

type SecretKind = "apiKey" | "webhook"

interface PendingSecret {
  kind: SecretKind
  value: string
  definition: typeof AGENTMAIL_API_KEY_SECRET | typeof AGENTMAIL_WEBHOOK_SECRET
}

export function useAgentMailSecrets(siteId?: string) {
  const [apiKey, setApiKey] = useState("")
  const [webhookSecret, setWebhookSecret] = useState("")
  const [isApiKeyStored, setIsApiKeyStored] = useState(false)
  const [isWebhookSecretStored, setIsWebhookSecretStored] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    setApiKey("")
    setWebhookSecret("")
    setIsApiKeyStored(false)
    setIsWebhookSecretStored(false)

    if (!siteId) return () => {
      cancelled = true
    }

    void Promise.all([
      secretsService.checkSecretExists(
        siteId,
        AGENTMAIL_API_KEY_SECRET.provider,
        AGENTMAIL_API_KEY_SECRET.useCase,
      ),
      secretsService.checkSecretExists(
        siteId,
        AGENTMAIL_WEBHOOK_SECRET.provider,
        AGENTMAIL_WEBHOOK_SECRET.useCase,
      ),
    ]).then(([apiKeyExists, webhookSecretExists]) => {
      if (cancelled) return
      setIsApiKeyStored(apiKeyExists)
      setIsWebhookSecretStored(webhookSecretExists)
    })

    return () => {
      cancelled = true
    }
  }, [siteId])

  const savePendingSecrets = useCallback(async (): Promise<boolean> => {
    if (!siteId) {
      toast.error("Select a site before saving AgentMail credentials")
      return false
    }

    const pending: PendingSecret[] = []
    if (!isApiKeyStored && apiKey.trim()) {
      pending.push({
        kind: "apiKey",
        value: apiKey.trim(),
        definition: AGENTMAIL_API_KEY_SECRET,
      })
    }
    if (!isWebhookSecretStored && webhookSecret.trim()) {
      pending.push({
        kind: "webhook",
        value: webhookSecret.trim(),
        definition: AGENTMAIL_WEBHOOK_SECRET,
      })
    }
    if (pending.length === 0) return true

    setIsSaving(true)
    try {
      const results = await Promise.all(
        pending.map(async ({ definition, ...secret }) => ({
          ...secret,
          success: await secretsService.storeSecret(
            siteId,
            definition.provider,
            definition.useCase,
            definition.name,
            secret.value,
          ),
        })),
      )

      for (const result of results) {
        if (!result.success) continue
        if (result.kind === "apiKey") {
          setIsApiKeyStored(true)
          setApiKey("")
        } else {
          setIsWebhookSecretStored(true)
          setWebhookSecret("")
        }
      }

      const allSaved = results.every(({ success }) => success)
      if (allSaved) {
        toast.success("AgentMail credentials saved securely")
      } else {
        toast.error("Some AgentMail credentials could not be saved")
      }
      return allSaved
    } catch (error) {
      console.error("Failed to save AgentMail credentials:", error)
      toast.error("Failed to save AgentMail credentials")
      return false
    } finally {
      setIsSaving(false)
    }
  }, [apiKey, isApiKeyStored, isWebhookSecretStored, siteId, webhookSecret])

  const removeSecret = useCallback(async (
    kind: SecretKind,
    definition: typeof AGENTMAIL_API_KEY_SECRET | typeof AGENTMAIL_WEBHOOK_SECRET,
  ) => {
    if (!siteId) return

    setIsSaving(true)
    try {
      const success = await secretsService.deleteSecret(
        siteId,
        definition.provider,
        definition.useCase,
      )
      if (!success) {
        toast.error(`Failed to remove AgentMail ${kind === "apiKey" ? "API key" : "webhook secret"}`)
        return
      }

      if (kind === "apiKey") {
        setIsApiKeyStored(false)
      } else {
        setIsWebhookSecretStored(false)
      }
      toast.success(`AgentMail ${kind === "apiKey" ? "API key" : "webhook secret"} removed`)
    } catch (error) {
      console.error("Failed to remove AgentMail credential:", error)
      toast.error(`Failed to remove AgentMail ${kind === "apiKey" ? "API key" : "webhook secret"}`)
    } finally {
      setIsSaving(false)
    }
  }, [siteId])

  return {
    apiKey,
    webhookSecret,
    isApiKeyStored,
    isWebhookSecretStored,
    isSaving,
    isDirty:
      (!isApiKeyStored && apiKey.trim().length > 0)
      || (!isWebhookSecretStored && webhookSecret.trim().length > 0),
    setApiKey,
    setWebhookSecret,
    savePendingSecrets,
    removeApiKey: () => removeSecret("apiKey", AGENTMAIL_API_KEY_SECRET),
    removeWebhookSecret: () => removeSecret("webhook", AGENTMAIL_WEBHOOK_SECRET),
  }
}

export type AgentMailSecretsState = ReturnType<typeof useAgentMailSecrets>
