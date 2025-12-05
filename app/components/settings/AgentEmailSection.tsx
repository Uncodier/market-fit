"use client"

import { useState, useEffect, useMemo } from "react"
import { useFormContext } from "react-hook-form"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { ActionFooter } from "../ui/card-footer"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Mail, CheckCircle2, AlertCircle, Trash2, Download, Check, Copy } from "../ui/icons"
import { type SiteFormValues } from "./form-schema"
import { useSite } from "../../context/SiteContext"
import { apiClient } from "../../services/api-client-service"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog"

interface AgentEmailSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}

export function AgentEmailSection({ active, siteId, onSave }: AgentEmailSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isRequesting, setIsRequesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGettingDnsFiles, setIsGettingDnsFiles] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [showDnsModal, setShowDnsModal] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const { currentSite, updateSettings } = useSite()

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving agent email settings:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Get current values from form - watch only what user can change
  const domain = form.watch("channels.agent_email.domain")
  const customDomain = form.watch("channels.agent_email.customDomain") || ""
  const username = form.watch("channels.agent_email.username") || ""
  const displayName = form.watch("channels.agent_email.displayName") || ""
  const setupRequested = form.watch("channels.agent_email.setupRequested") || false
  const status = form.watch("channels.agent_email.status") || "not_configured"

  const isPending = status === "pending" || setupRequested
  const isActive = status === "active"
  const isNotConfigured = status === "not_configured"
  const isWaitingForVerification = status === "waiting_for_verification"
  
  // Get DNS records from currentSite settings - check both locations for compatibility
  const dnsRecords = currentSite?.settings?.channels?.agent_email?.dns_records || 
                     currentSite?.settings?.channels?.agent_email?.data?.dns_records
  const hasDnsRecords = Array.isArray(dnsRecords) && dnsRecords.length > 0
  
  // Group DNS records by type
  const mxRecords = hasDnsRecords ? dnsRecords.filter(record => record.type === "MX" || record.type === "mx") : []
  const txtRecords = hasDnsRecords ? dnsRecords.filter(record => record.type === "TXT" || record.type === "txt") : []
  const otherRecords = hasDnsRecords ? dnsRecords.filter(record => 
    record.type !== "MX" && record.type !== "mx" && record.type !== "TXT" && record.type !== "txt"
  ) : []

  const canRequest = () => {
    if (!domain || !username || !displayName) return false
    if (domain === "custom" && !customDomain) return false
    return true
  }

  const handleRequestAgentEmail = async () => {
    if (!currentSite || !siteId || !canRequest()) return

    setIsRequesting(true)
    try {
      // Prepare request data
      const requestData = {
        domain: domain === "custom" ? customDomain : domain,
        username: username,
        displayName: displayName,
        siteId: siteId,
        siteName: currentSite.name
      }

      // Call the API
      const response = await apiClient.post('/api/integrations/agentmail/inbox/create', requestData)

      if (response.success) {
        // Extract metadata from response if available
        // The API may return data directly or nested in agent_email
        const responseData = response.data || {}
        const agentEmailData = responseData.agent_email || responseData
        
        const responseStatus = agentEmailData.status || responseData.status || "pending"
        const domainId = agentEmailData.domain_id || responseData.domain_id || (domain === "custom" ? customDomain : domain)
        const dnsRecords = agentEmailData.dns_records || responseData.dns_records || []
        const domainStatus = agentEmailData.domain_status || responseData.domain_status
        const errorMessage = agentEmailData.error_message || responseData.error_message
        const responseUsername = agentEmailData.username || responseData.username || username
        const responseDisplayName = agentEmailData.display_name || agentEmailData.displayName || responseData.display_name || responseData.displayName || displayName

        // Update form values
        // If status is "active", don't set setupRequested to true, just update the values directly
        if (responseStatus === "active") {
          form.setValue("channels.agent_email.setupRequested", false)
          form.setValue("channels.agent_email.username", responseUsername)
          form.setValue("channels.agent_email.displayName", responseDisplayName)
        } else {
          form.setValue("channels.agent_email.setupRequested", true)
        }
        form.setValue("channels.agent_email.status", responseStatus)

        // Update settings in database with metadata - store directly in agent_email to match API structure
        await updateSettings(currentSite.id, {
          channels: {
            ...currentSite.settings?.channels,
            agent_email: {
              domain: domain as "makinari.email" | "custom" | undefined,
              customDomain: domain === "custom" ? customDomain : undefined,
              username: responseUsername,
              displayName: responseDisplayName,
              setupRequested: responseStatus === "active" ? false : true,
              status: responseStatus,
              domain_id: domainId,
              dns_records: Array.isArray(dnsRecords) && dnsRecords.length > 0 ? dnsRecords : undefined,
              domain_status: domainStatus,
              error_message: errorMessage,
              // Also keep data for backward compatibility
              data: {
                domain: (domain === "custom" ? customDomain : domain) as "makinari.email" | "custom" | undefined,
                username: responseUsername,
                displayName: responseDisplayName,
                domain_id: domainId,
                dns_records: Array.isArray(dnsRecords) && dnsRecords.length > 0 ? dnsRecords : undefined,
                domain_status: domainStatus,
                error_message: errorMessage
              }
            }
          }
        })

        toast.success("Agent email request submitted successfully")
      } else {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message 
          ? String(response.error.message)
          : "Failed to request agent email"
        toast.error(errorMessage)
      }
    } catch (error: any) {
      console.error("Error requesting agent email:", error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : error?.error?.message 
        ? String(error.error.message)
        : error?.message 
        ? String(error.message)
        : "Failed to request agent email"
      toast.error(errorMessage)
    } finally {
      setIsRequesting(false)
    }
  }

  // Initialize form values from site settings - only once when site changes
  useEffect(() => {
    if (!currentSite?.settings?.channels?.agent_email) return
    
    const agentEmailData = currentSite.settings.channels.agent_email
    const currentValues = form.getValues("channels.agent_email")
    
    // Only update if values are different to avoid infinite loops
    if (currentValues.domain !== agentEmailData.domain) {
      form.setValue("channels.agent_email.domain", agentEmailData.domain, { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.customDomain !== (agentEmailData.customDomain || "")) {
      form.setValue("channels.agent_email.customDomain", agentEmailData.customDomain || "", { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.username !== (agentEmailData.username || "")) {
      form.setValue("channels.agent_email.username", agentEmailData.username || "", { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.displayName !== (agentEmailData.displayName || "")) {
      form.setValue("channels.agent_email.displayName", agentEmailData.displayName || "", { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.setupRequested !== (agentEmailData.setupRequested || false)) {
      form.setValue("channels.agent_email.setupRequested", agentEmailData.setupRequested || false, { shouldDirty: false, shouldValidate: false })
    }
    if (currentValues.status !== (agentEmailData.status || "not_configured")) {
      form.setValue("channels.agent_email.status", agentEmailData.status || "not_configured", { shouldDirty: false, shouldValidate: false })
    }
  }, [currentSite?.id])

  // Update cooldown timer when waiting for verification
  useEffect(() => {
    if (!isWaitingForVerification) {
      setCooldownSeconds(0)
      return
    }

    const updateCooldown = () => {
      if (!siteId || !getDomainId()) {
        setCooldownSeconds(0)
        return
      }
      
      const storageKey = `agent_email_verify_${siteId}_${getDomainId()}`
      const lastVerifyTime = localStorage.getItem(storageKey)
      
      if (!lastVerifyTime) {
        setCooldownSeconds(0)
        return
      }
      
      const timeSinceLastVerify = Date.now() - parseInt(lastVerifyTime, 10)
      const fiveMinutes = 5 * 60 * 1000
      
      if (timeSinceLastVerify >= fiveMinutes) {
        setCooldownSeconds(0)
      } else {
        setCooldownSeconds(Math.ceil((fiveMinutes - timeSinceLastVerify) / 1000))
      }
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)

    return () => clearInterval(interval)
  }, [isWaitingForVerification, siteId, domain, customDomain])

  const handleDeleteInbox = async () => {
    if (!currentSite || !siteId) return

    setIsDeleting(true)
    try {
      const response = await apiClient.post('/api/integrations/agentmail/inboxes/delete-inbox', {
        siteId: siteId
      })

      if (response.success) {
        // Reset form values
        form.setValue("channels.agent_email.domain", undefined)
        form.setValue("channels.agent_email.customDomain", "")
        form.setValue("channels.agent_email.username", "")
        form.setValue("channels.agent_email.displayName", "")
        form.setValue("channels.agent_email.setupRequested", false)
        form.setValue("channels.agent_email.status", "not_configured")

        // Update settings in database
        await updateSettings(currentSite.id, {
          channels: {
            ...currentSite.settings?.channels,
            agent_email: {
              domain: undefined,
              customDomain: undefined,
              username: undefined,
              displayName: undefined,
              setupRequested: false,
              status: "not_configured",
              data: undefined
            }
          }
        })

        toast.success("Inbox deleted successfully")
        setShowDeleteDialog(false)
      } else {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message 
          ? String(response.error.message)
          : "Failed to delete inbox"
        toast.error(errorMessage)
      }
    } catch (error: any) {
      console.error("Error deleting inbox:", error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : error?.error?.message 
        ? String(error.error.message)
        : error?.message 
        ? String(error.message)
        : "Failed to delete inbox"
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  // Get domain ID (URL) for API calls - use domain_id from metadata if available, otherwise calculate
  const getDomainId = () => {
    // First try to get domain_id from stored metadata (check both locations)
    const storedDomainId = currentSite?.settings?.channels?.agent_email?.domain_id ||
                          currentSite?.settings?.channels?.agent_email?.data?.domain_id
    if (storedDomainId) {
      return storedDomainId
    }
    // Fallback to calculating from domain/customDomain
    if (domain === "custom") {
      return customDomain
    }
    return domain || ""
  }

  // Check if verify button is rate limited (5 minutes = 300000ms)
  const canVerify = () => {
    if (!siteId || !getDomainId()) return false
    
    const storageKey = `agent_email_verify_${siteId}_${getDomainId()}`
    const lastVerifyTime = localStorage.getItem(storageKey)
    
    if (!lastVerifyTime) return true
    
    const timeSinceLastVerify = Date.now() - parseInt(lastVerifyTime, 10)
    const fiveMinutes = 5 * 60 * 1000 // 300000ms
    
    return timeSinceLastVerify >= fiveMinutes
  }

  // Get remaining cooldown time in seconds
  const getRemainingCooldown = () => {
    if (!siteId || !getDomainId()) return 0
    
    const storageKey = `agent_email_verify_${siteId}_${getDomainId()}`
    const lastVerifyTime = localStorage.getItem(storageKey)
    
    if (!lastVerifyTime) return 0
    
    const timeSinceLastVerify = Date.now() - parseInt(lastVerifyTime, 10)
    const fiveMinutes = 5 * 60 * 1000
    
    if (timeSinceLastVerify >= fiveMinutes) return 0
    
    return Math.ceil((fiveMinutes - timeSinceLastVerify) / 1000)
  }

  const handleGetDnsFiles = async () => {
    if (!currentSite || !siteId) return

    const domainId = getDomainId()
    if (!domainId) {
      toast.error("Domain information is missing")
      return
    }

    setIsGettingDnsFiles(true)
    try {
      const response = await apiClient.get(`/api/agentmail/domains/${encodeURIComponent(domainId)}/zone-file`)

      if (response.success && response.data) {
        // Download the zone file
        const zoneFileContent = typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data, null, 2)
        
        const blob = new Blob([zoneFileContent], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `dns-zone-${domainId.replace(/\./g, '-')}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success("DNS zone file downloaded successfully")
      } else {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message 
          ? String(response.error.message)
          : "Failed to get DNS files"
        toast.error(errorMessage)
      }
    } catch (error: any) {
      console.error("Error getting DNS files:", error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : error?.error?.message 
        ? String(error.error.message)
        : error?.message 
        ? String(error.message)
        : "Failed to get DNS files"
      toast.error(errorMessage)
    } finally {
      setIsGettingDnsFiles(false)
    }
  }

  const handleVerify = async () => {
    if (!currentSite || !siteId || !canVerify()) return

    const domainId = getDomainId()
    if (!domainId) {
      toast.error("Domain information is missing")
      return
    }

    setIsVerifying(true)
    try {
      const response = await apiClient.post(`/api/agentmail/domains/${encodeURIComponent(domainId)}/verify`, {})

      if (response.success) {
        // Store verification timestamp in localStorage
        const storageKey = `agent_email_verify_${siteId}_${getDomainId()}`
        localStorage.setItem(storageKey, Date.now().toString())

        // Extract updated metadata from response
        const responseData = response.data || {}
        const agentEmailResponse = responseData.agent_email || responseData
        const newStatus = agentEmailResponse.status || responseData.status || currentSite.settings?.channels?.agent_email?.status || "pending"
        const updatedDomainId = agentEmailResponse.domain_id || responseData.domain_id || getDomainId()
        const updatedDnsRecords = agentEmailResponse.dns_records || responseData.dns_records || 
                                  currentSite.settings?.channels?.agent_email?.dns_records ||
                                  currentSite.settings?.channels?.agent_email?.data?.dns_records
        const updatedDomainStatus = agentEmailResponse.domain_status || responseData.domain_status || 
                                   currentSite.settings?.channels?.agent_email?.domain_status ||
                                   currentSite.settings?.channels?.agent_email?.data?.domain_status
        const updatedErrorMessage = agentEmailResponse.error_message || responseData.error_message

        form.setValue("channels.agent_email.status", newStatus)

        // Update settings in database with latest metadata - store directly in agent_email
        await updateSettings(currentSite.id, {
          channels: {
            ...currentSite.settings?.channels,
            agent_email: {
              ...currentSite.settings?.channels?.agent_email,
              status: newStatus,
              domain_id: updatedDomainId,
              dns_records: updatedDnsRecords,
              domain_status: updatedDomainStatus,
              error_message: updatedErrorMessage,
              // Also update data for backward compatibility
              data: {
                ...currentSite.settings?.channels?.agent_email?.data,
                domain_id: updatedDomainId,
                dns_records: updatedDnsRecords,
                domain_status: updatedDomainStatus,
                error_message: updatedErrorMessage
              }
            }
          }
        })

        toast.success("Domain verification initiated successfully")
      } else {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message 
          ? String(response.error.message)
          : "Failed to verify domain"
        toast.error(errorMessage)
      }
    } catch (error: any) {
      console.error("Error verifying domain:", error)
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : error?.error?.message 
        ? String(error.error.message)
        : error?.message 
        ? String(error.message)
        : "Failed to verify domain"
      toast.error(errorMessage)
    } finally {
      setIsVerifying(false)
    }
  }

  if (!active) return null

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Agent Email Channel
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Request an agent email address for automated customer communication
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-4 space-y-6">
        {isNotConfigured && (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-foreground">Domain</Label>
              <Select
                value={domain || ""}
                onValueChange={(value: "makinari.email" | "custom") => {
                  form.setValue("channels.agent_email.domain", value)
                  if (value !== "custom") {
                    form.setValue("channels.agent_email.customDomain", "")
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
              <p className="text-sm text-muted-foreground mt-1">
                Choose between our managed domain or use your own custom domain
              </p>
            </div>

            {domain === "custom" && (
              <div>
                <Label className="text-sm font-medium text-foreground">Custom Domain</Label>
                <Input
                  placeholder="example.com"
                  value={customDomain || ""}
                  onChange={(e) => form.setValue("channels.agent_email.customDomain", e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your custom domain (without @ or www)
                </p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-foreground">Username</Label>
              <Input
                placeholder="support"
                value={username || ""}
                onChange={(e) => form.setValue("channels.agent_email.username", e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                The username part of the email address (e.g., support@domain.com)
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-foreground">Display Name</Label>
              <Input
                placeholder="Support Team"
                value={displayName || ""}
                onChange={(e) => form.setValue("channels.agent_email.displayName", e.target.value)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                The display name shown to recipients
              </p>
            </div>
          </div>
        )}

        {isPending && (
          <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium">Agent email request submitted</p>
              <p className="text-xs text-muted-foreground">
                Your request is being processed. We'll contact you soon to complete the setup.
              </p>
            </div>
          </div>
        )}

        {isWaitingForVerification && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-900">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Waiting for DNS verification</p>
                <p className="text-xs text-muted-foreground">
                  Configure your DNS records using the zone file, then verify your domain.
                </p>
                {(currentSite?.settings?.channels?.agent_email?.error_message || 
                  currentSite?.settings?.channels?.agent_email?.data?.error_message) && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {currentSite.settings.channels.agent_email.error_message || 
                     currentSite.settings.channels.agent_email.data?.error_message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {isActive && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Agent email active</p>
                <p className="text-xs text-muted-foreground">
                  Your agent email is configured and ready to use
                </p>
              </div>
            </div>

            {(() => {
              const agentEmail = currentSite?.settings?.channels?.agent_email
              const emailUsername = agentEmail?.username || agentEmail?.data?.username
              const emailDisplayName = agentEmail?.displayName || agentEmail?.data?.displayName
              const emailDomain = agentEmail?.domain === "custom" 
                ? agentEmail?.customDomain 
                : agentEmail?.domain || agentEmail?.data?.domain
              
              if (!emailUsername || !emailDomain) return null
              
              return (
                <div className="space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-foreground">Email Address</Label>
                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">
                        {emailUsername}@{emailDomain}
                      </span>
                    </div>
                  </div>
                  {emailDisplayName && (
                    <div>
                      <Label className="text-sm font-medium text-foreground">Display Name</Label>
                      <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border">
                        {emailDisplayName}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>

      {isNotConfigured && (
        <ActionFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Configure your agent email address above
            </div>
            <Button
              onClick={handleRequestAgentEmail}
              disabled={isRequesting || !canRequest()}
            >
              {isRequesting ? "Requesting..." : "Request Agent Email"}
            </Button>
          </div>
        </ActionFooter>
      )}

      {isWaitingForVerification && (
        <ActionFooter>
          <div className="flex items-center justify-end w-full gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDnsModal(true)}
              disabled={!hasDnsRecords}
            >
              <Copy className="h-4 w-4 mr-2" />
              View All & Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGetDnsFiles}
              disabled={isGettingDnsFiles}
            >
              <Download className="h-4 w-4 mr-2" />
              {isGettingDnsFiles ? "Getting..." : "Get DNS Files"}
            </Button>
            <Button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying || !canVerify()}
            >
              <Check className="h-4 w-4 mr-2" />
              {isVerifying 
                ? "Verifying..." 
                : !canVerify() 
                  ? `Verify (${Math.floor(cooldownSeconds / 60)}:${String(cooldownSeconds % 60).padStart(2, '0')})`
                  : "Verify"}
            </Button>
          </div>
        </ActionFooter>
      )}

      {isActive && (
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Inbox
          </Button>
        </CardFooter>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Inbox
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inbox? This action cannot be undone and 
              all email functionality for this inbox will be permanently removed.
            </AlertDialogDescription>
            {currentSite?.settings?.channels?.agent_email?.data && (
              <div className="mt-2 p-2 border rounded bg-muted/50">
                <span className="font-medium text-sm">
                  {currentSite.settings.channels.agent_email.data.username}@
                  {currentSite.settings.channels.agent_email.data.domain}
                </span>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInbox}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-pulse bg-muted rounded" />
                  Deleting...
                </>
              ) : (
                <>Delete</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDnsModal} onOpenChange={setShowDnsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DNS Records Configuration</DialogTitle>
            <DialogDescription>
              Configure these DNS records in your domain provider. Click on any cell to copy its value.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {hasDnsRecords && (() => {
              const handleCopy = async (text: string, label: string) => {
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text)
                    toast.success(`${label} copied to clipboard`)
                  } else {
                    const textArea = document.createElement('textarea')
                    textArea.value = text
                    textArea.style.position = 'fixed'
                    textArea.style.left = '-999999px'
                    textArea.style.top = '-999999px'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    const success = document.execCommand('copy')
                    document.body.removeChild(textArea)
                    if (success) {
                      toast.success(`${label} copied to clipboard`)
                    } else {
                      throw new Error("Copy command failed")
                    }
                  }
                } catch (err) {
                  console.error("Error copying:", err)
                  toast.error("Failed to copy")
                }
              }

              const renderTable = (records: typeof dnsRecords, title: string, showPriority: boolean = true) => {
                if (!Array.isArray(records) || records.length === 0) return null

                return (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Name</TableHead>
                          <TableHead className="w-[100px]">Type</TableHead>
                          {showPriority && <TableHead className="w-[100px]">Priority</TableHead>}
                          <TableHead>Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map((record, index) => (
                          <TableRow key={index}>
                            <TableCell 
                              className="font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleCopy(record.name || "@", "Name")}
                            >
                              {record.name || "@"}
                            </TableCell>
                            <TableCell 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleCopy(record.type, "Type")}
                            >
                              <span className="text-xs bg-muted px-2 py-1 rounded">{record.type}</span>
                            </TableCell>
                            {showPriority && (
                              <TableCell 
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => handleCopy(record.priority !== undefined ? String(record.priority) : "-", "Priority")}
                              >
                                {record.priority !== undefined ? record.priority : "-"}
                              </TableCell>
                            )}
                            <TableCell 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleCopy(record.value, "Value")}
                            >
                              <code className="text-sm font-mono break-all">{record.value}</code>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              }

              return (
                <>
                  {renderTable(mxRecords, "MX Records", true)}
                  {renderTable(txtRecords, "TXT Records", false)}
                  {renderTable(otherRecords, "Other Records", true)}
                </>
              )
            })()}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                if (!hasDnsRecords) return
                
                const allRecords = dnsRecords
                  .map(record => `${record.name || "@"} ${record.type} ${record.priority ? `${record.priority} ` : ""}${record.value}`)
                  .join('\n')
                
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(allRecords)
                    toast.success("All DNS records copied to clipboard")
                  } else {
                    const textArea = document.createElement('textarea')
                    textArea.value = allRecords
                    textArea.style.position = 'fixed'
                    textArea.style.left = '-999999px'
                    textArea.style.top = '-999999px'
                    document.body.appendChild(textArea)
                    textArea.focus()
                    textArea.select()
                    const success = document.execCommand('copy')
                    document.body.removeChild(textArea)
                    if (success) {
                      toast.success("All DNS records copied to clipboard")
                    } else {
                      throw new Error("Copy command failed")
                    }
                  }
                } catch (err) {
                  console.error("Error copying all DNS records:", err)
                  toast.error("Failed to copy DNS records")
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy All Records
            </Button>
            <Button
              type="button"
              onClick={() => setShowDnsModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

