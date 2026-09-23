"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { apiClient } from "@/app/services/api-client-service"
import { secretsService } from "@/app/services/secrets-service"
import type { SiteFormValues } from "./form-schema"
import type { AgentMailDnsRecord } from "./AgentEmailDnsDialog"
import { deleteAgentMailInbox } from "./agentmail-inbox-api"

type AgentEmailStatus =
  | "not_configured"
  | "pending"
  | "active"
  | "waiting_for_verification"

interface AgentEmailApiData {
  agent_email?: AgentEmailApiData
  status?: string
  domain_id?: string
  inbox_id?: string
  id?: string
  dns_records?: AgentMailDnsRecord[]
  domain_status?: string
  error_message?: string
  username?: string
  display_name?: string
  displayName?: string
}

interface UseAgentEmailChannelOptions {
  siteId?: string
  onSave?: (data: SiteFormValues) => void | Promise<void>
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (!error || typeof error !== "object") return fallback

  const value = error as { message?: unknown; error?: { message?: unknown } }
  if (typeof value.message === "string") return value.message
  if (typeof value.error?.message === "string") return value.error.message
  return fallback
}

function normalizeStatus(status: string | undefined): AgentEmailStatus {
  if (status === "active" || status === "waiting_for_verification") return status
  if (status === "pending" || status === "requested") return "pending"
  return "not_configured"
}

function verificationStorageKey(siteId: string, domainId: string) {
  return `agent_email_verify_${siteId}_${domainId}`
}

export function useAgentEmailChannel({
  siteId,
  onSave,
}: UseAgentEmailChannelOptions) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite, updateSettings } = useSite()
  const [isRequesting, setIsRequesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGettingDnsFiles, setIsGettingDnsFiles] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDnsModal, setShowDnsModal] = useState(false)
  const [isCloudflareConnected, setIsCloudflareConnected] = useState(false)
  const [isSyncingCloudflare, setIsSyncingCloudflare] = useState(false)

  const domain = form.watch("channels.agent_email.domain")
  const customDomain = form.watch("channels.agent_email.customDomain") || ""
  const username = form.watch("channels.agent_email.username") || ""
  const displayName = form.watch("channels.agent_email.displayName") || ""
  const setupRequested = form.watch("channels.agent_email.setupRequested") || false
  const status = form.watch("channels.agent_email.status") || "not_configured"
  const agentEmail = currentSite?.settings?.channels?.agent_email

  const dnsRecords = useMemo<AgentMailDnsRecord[]>(() => {
    const records = agentEmail?.dns_records || agentEmail?.data?.dns_records
    return Array.isArray(records) ? records : []
  }, [agentEmail?.data?.dns_records, agentEmail?.dns_records])

  const domainId = useMemo(() => {
    const storedDomainId = agentEmail?.domain_id || agentEmail?.data?.domain_id
    if (storedDomainId) return storedDomainId
    return domain === "custom" ? customDomain : domain || ""
  }, [agentEmail?.data?.domain_id, agentEmail?.domain_id, customDomain, domain])

  useEffect(() => {
    let cancelled = false
    if (!siteId) {
      setIsCloudflareConnected(false)
      return
    }

    void secretsService
      .checkSecretExists(siteId, "cloudflare", "dns_sync")
      .then((exists) => {
        if (!cancelled) setIsCloudflareConnected(exists)
      })

    return () => {
      cancelled = true
    }
  }, [siteId])

  useEffect(() => {
    if (!agentEmail) return
    const values = form.getValues("channels.agent_email")
    const nextValues = {
      domain: agentEmail.domain,
      customDomain: agentEmail.customDomain || "",
      username: agentEmail.username || "",
      displayName: agentEmail.displayName || "",
      setupRequested: agentEmail.setupRequested || false,
      status: agentEmail.status || "not_configured",
    }

    for (const [key, value] of Object.entries(nextValues)) {
      const field = key as keyof typeof nextValues
      if (values[field] !== value) {
        form.setValue(`channels.agent_email.${field}`, value, {
          shouldDirty: false,
          shouldValidate: false,
        })
      }
    }
  }, [agentEmail, form])

  useEffect(() => {
    if (status !== "waiting_for_verification" || !siteId || !domainId) {
      setCooldownSeconds(0)
      return
    }

    const updateCooldown = () => {
      const lastVerifyTime = Number(
        localStorage.getItem(verificationStorageKey(siteId, domainId)),
      )
      const remaining = Math.ceil((5 * 60 * 1000 - (Date.now() - lastVerifyTime)) / 1000)
      setCooldownSeconds(lastVerifyTime > 0 ? Math.max(0, remaining) : 0)
    }

    updateCooldown()
    const interval = window.setInterval(updateCooldown, 1000)
    return () => window.clearInterval(interval)
  }, [domainId, siteId, status])

  const saveForm = useCallback(async (): Promise<boolean> => {
    if (!onSave) return true
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
      return true
    } catch (error) {
      console.error("Failed to save agent email settings:", error)
      toast.error("Failed to save agent email settings")
      return false
    } finally {
      setIsSaving(false)
    }
  }, [form, onSave])

  const syncCloudflare = useCallback(async () => {
    if (!isCloudflareConnected) {
      window.location.href = `/api/integrations/cloudflare/oauth/authorize?site_id=${siteId}`
      return
    }
    if (!siteId || !domainId || dnsRecords.length === 0) return

    setIsSyncingCloudflare(true)
    try {
      const response = await fetch("/api/integrations/cloudflare/sync/agentmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, domain: domainId, records: dnsRecords }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        toast.error(data.error || "Failed to sync DNS records")
        return
      }
      toast.success("DNS records synced with Cloudflare successfully")
    } catch (error) {
      console.error("Failed to sync AgentMail DNS records:", error)
      toast.error("An error occurred while syncing with Cloudflare")
    } finally {
      setIsSyncingCloudflare(false)
    }
  }, [dnsRecords, domainId, isCloudflareConnected, siteId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (
      params.get("cloudflare_sync_pending") !== "true"
      || !isCloudflareConnected
      || dnsRecords.length === 0
      || isSyncingCloudflare
    ) return

    params.delete("cloudflare_sync_pending")
    const query = params.toString()
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    )
    void syncCloudflare()
  }, [dnsRecords.length, isCloudflareConnected, isSyncingCloudflare, syncCloudflare])

  const canRequest = Boolean(
    domain
    && username
    && displayName
    && (domain !== "custom" || customDomain),
  )

  const requestAgentEmail = async () => {
    if (!currentSite || !siteId || !canRequest) return
    setIsRequesting(true)

    try {
      const response = await apiClient.post<AgentEmailApiData>(
        "/api/integrations/agentmail/inbox/create",
        {
          domain: domain === "custom" ? customDomain : domain,
          username,
          displayName,
          siteId,
          siteName: currentSite.name,
        },
      )
      if (!response.success) {
        toast.error(errorMessage(response.error, "Failed to request agent email"))
        return
      }

      const responseData = response.data || {}
      const data = responseData.agent_email || responseData
      const responseStatus = normalizeStatus(data.status || responseData.status)
      const nextDomainId =
        data.domain_id
        || responseData.domain_id
        || (domain === "custom" ? customDomain : domain)
      const inboxId = data.inbox_id || data.id || responseData.inbox_id || responseData.id
      const nextDnsRecords = data.dns_records || responseData.dns_records || []
      const domainStatus = data.domain_status || responseData.domain_status
      const responseError = data.error_message || responseData.error_message
      const responseUsername = data.username || responseData.username || username
      const responseDisplayName =
        data.display_name
        || data.displayName
        || responseData.display_name
        || responseData.displayName
        || displayName

      form.setValue("channels.agent_email.setupRequested", responseStatus !== "active")
      form.setValue("channels.agent_email.username", responseUsername)
      form.setValue("channels.agent_email.displayName", responseDisplayName)
      form.setValue("channels.agent_email.status", responseStatus)

      await updateSettings(currentSite.id, {
        channels: {
          ...currentSite.settings?.channels,
          agent_email: {
            domain,
            customDomain: domain === "custom" ? customDomain : undefined,
            username: responseUsername,
            displayName: responseDisplayName,
            setupRequested: responseStatus !== "active",
            status: responseStatus,
            inbox_id: inboxId,
            id: inboxId,
            domain_id: nextDomainId,
            dns_records: nextDnsRecords.length > 0 ? nextDnsRecords : undefined,
            domain_status: domainStatus,
            error_message: responseError,
            data: {
              domain,
              customDomain: domain === "custom" ? customDomain : undefined,
              username: responseUsername,
              displayName: responseDisplayName,
              inbox_id: inboxId,
              id: inboxId,
              domain_id: nextDomainId,
              dns_records: nextDnsRecords.length > 0 ? nextDnsRecords : undefined,
              domain_status: domainStatus,
              error_message: responseError,
            },
          },
        },
      })
      toast.success("Agent email request submitted successfully")
    } catch (error) {
      console.error("Failed to request agent email:", error)
      toast.error(errorMessage(error, "Failed to request agent email"))
    } finally {
      setIsRequesting(false)
    }
  }

  const deleteInbox = async () => {
    if (!currentSite || !siteId) return
    const inboxId =
      agentEmail?.inbox_id
      || agentEmail?.id
      || agentEmail?.data?.inbox_id
      || agentEmail?.data?.id
      || (agentEmail?.username && agentEmail.domain
        ? `${agentEmail.username}@${
          agentEmail.domain === "custom" && agentEmail.customDomain
            ? agentEmail.customDomain
            : agentEmail.domain
        }`
        : undefined)

    if (!inboxId) {
      toast.error("Inbox ID not found. Cannot delete inbox.")
      return
    }

    setIsDeleting(true)
    try {
      await deleteAgentMailInbox(inboxId)

      form.setValue("channels.agent_email.domain", undefined)
      form.setValue("channels.agent_email.customDomain", "")
      form.setValue("channels.agent_email.username", "")
      form.setValue("channels.agent_email.displayName", "")
      form.setValue("channels.agent_email.setupRequested", false)
      form.setValue("channels.agent_email.status", "not_configured")
      await updateSettings(currentSite.id, {
        channels: {
          ...currentSite.settings?.channels,
          agent_email: {
            setupRequested: false,
            status: "not_configured",
          },
        },
      })
      toast.success("Inbox deleted successfully")
      setShowDeleteDialog(false)
    } catch (error) {
      console.error("Failed to delete AgentMail inbox:", error)
      toast.error(errorMessage(error, "Failed to delete inbox"))
    } finally {
      setIsDeleting(false)
    }
  }

  const getDnsFiles = async () => {
    if (!currentSite || !siteId || !domainId) {
      toast.error("Domain information is missing")
      return
    }

    setIsGettingDnsFiles(true)
    try {
      const response = await apiClient.get(
        `/api/integrations/agentmail/domains/${encodeURIComponent(domainId)}/zone-file`,
      )
      if (!response.success || response.data === undefined) {
        toast.error(errorMessage(response.error, "Failed to get DNS files"))
        return
      }

      const content =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data, null, 2)
      const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }))
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `dns-zone-${domainId.replace(/\./g, "-")}.txt`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success("DNS zone file downloaded successfully")
    } catch (error) {
      console.error("Failed to get AgentMail DNS files:", error)
      toast.error(errorMessage(error, "Failed to get DNS files"))
    } finally {
      setIsGettingDnsFiles(false)
    }
  }

  const canVerify = Boolean(siteId && domainId && cooldownSeconds === 0)

  const verifyDomain = async () => {
    if (!currentSite || !siteId || !domainId || !canVerify) return
    setIsVerifying(true)

    try {
      const response = await apiClient.post<AgentEmailApiData>(
        `/api/integrations/agentmail/domains/${encodeURIComponent(domainId)}/verify`,
        {},
      )
      if (!response.success) {
        toast.error(errorMessage(response.error, "Failed to verify domain"))
        return
      }

      localStorage.setItem(verificationStorageKey(siteId, domainId), Date.now().toString())
      setCooldownSeconds(300)
      const responseData = response.data || {}
      const data = responseData.agent_email || responseData
      const nextStatus = normalizeStatus(
        data.status || responseData.status || agentEmail?.status,
      )
      const nextDomainId = data.domain_id || responseData.domain_id || domainId
      const nextRecords = data.dns_records || responseData.dns_records || dnsRecords
      const nextDomainStatus =
        data.domain_status || responseData.domain_status || agentEmail?.domain_status
      const nextError = data.error_message || responseData.error_message

      form.setValue("channels.agent_email.status", nextStatus)
      await updateSettings(currentSite.id, {
        channels: {
          ...currentSite.settings?.channels,
          agent_email: {
            ...agentEmail,
            status: nextStatus,
            domain_id: nextDomainId,
            dns_records: nextRecords,
            domain_status: nextDomainStatus,
            error_message: nextError,
            data: {
              ...agentEmail?.data,
              domain_id: nextDomainId,
              dns_records: nextRecords,
              domain_status: nextDomainStatus,
              error_message: nextError,
            },
          },
        },
      })
      toast.success("Domain verification initiated successfully")
    } catch (error) {
      console.error("Failed to verify AgentMail domain:", error)
      toast.error(errorMessage(error, "Failed to verify domain"))
    } finally {
      setIsVerifying(false)
    }
  }

  return {
    form,
    agentEmail,
    domain,
    customDomain,
    username,
    displayName,
    status,
    dnsRecords,
    hasDnsRecords: dnsRecords.length > 0,
    isPending: status === "pending" || setupRequested,
    isActive: status === "active",
    isNotConfigured: status === "not_configured",
    isWaitingForVerification: status === "waiting_for_verification",
    isRequesting,
    isSaving,
    isDeleting,
    isGettingDnsFiles,
    isVerifying,
    cooldownSeconds,
    canRequest,
    canVerify,
    showDeleteDialog,
    showDnsModal,
    isCloudflareConnected,
    isSyncingCloudflare,
    setShowDeleteDialog,
    setShowDnsModal,
    saveForm,
    syncCloudflare,
    requestAgentEmail,
    deleteInbox,
    getDnsFiles,
    verifyDomain,
  }
}
