import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Check, Cloud, Copy } from "@/app/components/ui/icons"
import { SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { ZAVU_INBOUND_MX_HOST, ZAVU_INBOUND_MX_PRIORITY } from "@/lib/zavu-email-dns"

interface EmailDnsRecord {
  type?: string
  name: string
  value: string
  priority?: number | string
}

interface EmailDnsSetupProps {
  domain: string
  domainStatus: string
  records: EmailDnsRecord[]
  copied: string | null
  isProcessing: boolean
  isSyncingCloudflare: boolean
  isCloudflareConnected: boolean
  onCopy: (text: string, id: string) => void
  onSync: () => void
  onVerify: () => void
}

export function EmailDnsSetup({
  domain,
  domainStatus,
  records,
  copied,
  isProcessing,
  isSyncingCloudflare,
  isCloudflareConnected,
  onCopy,
  onSync,
  onVerify,
}: EmailDnsSetupProps) {
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
          Add these DNS records to your DNS provider for {domain}
        </p>

        <div className="space-y-3">
          {records.map((record, index) => (
            <div key={index} className="p-3 bg-background rounded border text-xs font-mono space-y-2">
              {record.type && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-bold">{record.type}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Name/Host:</span>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[200px]">{record.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(record.name, `name-${index}`)}>
                    {copied === `name-${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Value/Target:</span>
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[200px]">{record.value}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onCopy(record.value, `val-${index}`)}>
                    {copied === `val-${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              {record.type === "MX" && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Priority:</span>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[200px]">{record.priority || "10"}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onCopy((record.priority || "10").toString(), `prio-${index}`)}
                    >
                      {copied === `prio-${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCardContent>

      <SectionCardFooter className="justify-end gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={onSync}
          disabled={isProcessing || isSyncingCloudflare || !records.length}
        >
          <Cloud className="h-4 w-4 mr-2" />
          {isSyncingCloudflare ? "Syncing..." : isCloudflareConnected ? "Sync with Cloudflare" : "Connect Cloudflare"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onVerify}
          disabled={isProcessing}
        >
          {isProcessing ? "Verifying..." : "Verify DNS"}
        </Button>
      </SectionCardFooter>
    </>
  )
}

interface EmailInboundSettingsProps {
  domain: string
  copied: string | null
  isMxConfigured: boolean
  isMxVerified: boolean | null
  isVerifyingMx: boolean
  isProcessing: boolean
  isSyncingCloudflare: boolean
  isCloudflareConnected: boolean
  isChannelActive: boolean
  isActivating: boolean
  receivingEnabled: boolean
  hasReceivingChanges: boolean
  onCopy: (text: string, id: string) => void
  onReceivingChange: (enabled: boolean) => void
  onSync: () => void
  onVerify: () => void
  onSave: () => void
  onActivate: () => void
}

export function EmailInboundSettings({
  domain,
  copied,
  isMxConfigured,
  isMxVerified,
  isVerifyingMx,
  isProcessing,
  isSyncingCloudflare,
  isCloudflareConnected,
  isChannelActive,
  isActivating,
  receivingEnabled,
  hasReceivingChanges,
  onCopy,
  onReceivingChange,
  onSync,
  onVerify,
  onSave,
  onActivate,
}: EmailInboundSettingsProps) {
  const showActivation =
    isMxConfigured && receivingEnabled && !isChannelActive && !hasReceivingChanges

  return (
    <>
      <SectionCardContent className="space-y-4 pt-0">
        <div className="space-y-4 p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Inbound Emails</h4>
              {(isMxConfigured || isMxVerified !== null) && (
                <span className={`text-xs px-2 py-1 rounded capitalize ${
                  isMxConfigured ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                }`}>
                  {isVerifyingMx ? "Checking..." : isMxConfigured ? "Verified" : "Pending"}
                </span>
              )}
            </div>
            {!isMxConfigured && (
              <>
                <p className="text-xs text-muted-foreground">
                  To receive emails, add this MX record to your DNS:
                </p>
                <div className="p-3 bg-background rounded border text-xs font-mono flex items-center gap-2">
                  <span className="flex-1 truncate">
                    {domain} MX {ZAVU_INBOUND_MX_PRIORITY} {ZAVU_INBOUND_MX_HOST}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onCopy(
                      `${domain} MX ${ZAVU_INBOUND_MX_PRIORITY} ${ZAVU_INBOUND_MX_HOST}`,
                      "mx"
                    )}
                  >
                    {copied === "mx" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-background rounded border">
            <div className="space-y-0.5">
              <Label className="text-sm">Enable Receiving</Label>
              <p className="text-xs text-muted-foreground">
                Allow the agent to receive inbound emails
              </p>
            </div>
            <Switch
              checked={receivingEnabled}
              onCheckedChange={onReceivingChange}
              disabled={isProcessing || isActivating || !isMxConfigured}
            />
          </div>

          {showActivation && (
            <div className="p-3 bg-background rounded border">
              <Label className="text-sm">Activate Email Channel</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Final step: activate this connection before it can send or receive email.
                Activation may use an included connection or add your plan&apos;s monthly channel fee.
              </p>
            </div>
          )}
        </div>
      </SectionCardContent>

      {(!isMxConfigured || hasReceivingChanges || showActivation) && (
        <SectionCardFooter className="justify-end gap-2 flex-wrap">
          {!isMxConfigured && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onSync}
                disabled={isProcessing || isSyncingCloudflare || isActivating}
              >
                <Cloud className="h-4 w-4 mr-2" />
                {isSyncingCloudflare ? "Syncing..." : isCloudflareConnected ? "Sync with Cloudflare" : "Connect Cloudflare"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onVerify}
                disabled={isProcessing || isVerifyingMx || isActivating}
              >
                {isVerifyingMx ? "Checking..." : "Verify MX"}
              </Button>
            </>
          )}
          {hasReceivingChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={onSave}
              disabled={isProcessing || isActivating}
            >
              {isProcessing ? "Saving..." : "Save Changes"}
            </Button>
          )}
          {showActivation && (
            <Button
              type="button"
              onClick={onActivate}
              disabled={isProcessing || isActivating}
            >
              {isActivating ? "Activating..." : "Activate Email Channel"}
            </Button>
          )}
        </SectionCardFooter>
      )}
    </>
  )
}
