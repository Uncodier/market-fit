import { useId, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { apiClient } from "@/app/services/api-client-service"
import { toast } from "sonner"
import { isValidEmailDomain, normalizeEmailDomain, type EmailDomainOption } from "./email-domain-options"

interface EmailDomainSelectorProps {
  siteId: string
  channelId: string
  channelName?: string
  domains: EmailDomainOption[]
  onUpdated: (payload: { metadata: Record<string, unknown> }) => void | Promise<void>
}

const NEW_DOMAIN = "new-domain"

export function EmailDomainSelector({ siteId, channelId, channelName, domains, onUpdated }: EmailDomainSelectorProps) {
  const inputId = useId()
  const [selection, setSelection] = useState(domains[0]?.domain || NEW_DOMAIN)
  const [newDomain, setNewDomain] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const effectiveSelection = selection !== NEW_DOMAIN && !domains.some((option) => option.domain === selection)
    ? NEW_DOMAIN : selection
  const addingNew = effectiveSelection === NEW_DOMAIN
  const domain = normalizeEmailDomain(addingNew ? newDomain : effectiveSelection)
  const existing = domains.find((option) => option.domain === domain)

  const continueSetup = async () => {
    if (isProcessing || !isValidEmailDomain(domain)) return
    setIsProcessing(true)
    try {
      const response = await apiClient.post("/api/integrations/zavu/email-domains", {
        domain, siteId, channelId, ...(channelName?.trim() ? { name: channelName.trim() } : {}),
      })
      if (!response.success) throw new Error(response.error?.message || "Failed to configure email domain")
      const emailDomain = response.data?.domain
      if (typeof emailDomain?.id !== "string" || !emailDomain.id
        || typeof emailDomain.domain !== "string" || normalizeEmailDomain(emailDomain.domain) !== domain) {
        throw new Error("The email domain response was incomplete or did not match your selection")
      }
      await onUpdated({
        metadata: {
          email_domain_id: emailDomain.id,
          domain,
          domain_status: emailDomain.status || "pending",
          dns_records: emailDomain.dnsRecords || [],
        },
      })
      toast.success(emailDomain.status === "verified"
        ? "Domain verified. Configure your new email address without repeating DNS setup."
        : response.data?.reused
          ? "Existing domain selected. Complete its pending DNS verification."
          : "Domain added. Configure its DNS records to continue.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to configure email domain")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <SectionCardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">1. Choose Email Domain</h4>
          <p className="text-xs text-muted-foreground">
            Reuse a domain from this site or add a new domain or subdomain.
          </p>
        </div>
        {domains.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-select`} className="text-xs">Email Domain</Label>
            <Select value={effectiveSelection} onValueChange={setSelection} disabled={isProcessing}>
              <SelectTrigger id={`${inputId}-select`}><SelectValue /></SelectTrigger>
              <SelectContent>
                {domains.map((option) => (
                  <SelectItem key={option.domain} value={option.domain}>
                    {option.domain} — {option.previouslyVerified ? "Previously verified" : "Verification pending"}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_DOMAIN}>Add a new domain or subdomain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {addingNew && (
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-new`} className="text-xs">New Domain or Subdomain</Label>
            <Input id={`${inputId}-new`} placeholder="e.g. agents.yourcompany.com" value={newDomain}
              onChange={(event) => setNewDomain(event.target.value)} disabled={isProcessing}
              autoCapitalize="none" spellCheck={false} aria-describedby={`${inputId}-help`} />
          </div>
        )}
        <div id={`${inputId}-help`} className="rounded border bg-background p-3 text-xs text-muted-foreground" aria-live="polite">
          {existing ? (
            <p>
              This exact domain is already configured in this site. We&apos;ll check its current status in Zavu.
              If verified, you&apos;ll go straight to your new email address; pending domains still need verification.
            </p>
          ) : (
            <p>
              DNS is configured once per exact domain. A new subdomain needs its own verification;
              verifying yourcompany.com does not automatically verify agents.yourcompany.com.
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Each email address has its own activation and receiving settings. Reusing a domain does not copy them.
        </p>
      </SectionCardContent>
      <SectionCardFooter>
        <Button type="button" onClick={continueSetup} disabled={isProcessing || !isValidEmailDomain(domain)}>
          {isProcessing ? "Checking domain..." : existing ? "Use Existing Domain" : "Add Domain"}
        </Button>
      </SectionCardFooter>
    </>
  )
}