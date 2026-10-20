import { useId } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"

interface EmailAddressSetupProps {
  domain: string
  fromEmail: string
  fromName: string
  isProcessing: boolean
  canCreate: boolean
  onEmailChange: (value: string) => void
  onNameChange: (value: string) => void
  onCreate: () => void
}

export function EmailAddressSetup({ domain, fromEmail, fromName, isProcessing, canCreate,
  onEmailChange, onNameChange, onCreate }: EmailAddressSetupProps) {
  const inputId = useId()
  return (
    <>
      <SectionCardContent className="space-y-4 pt-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium">Configure Email Address</h4>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Domain Verified</span>
        </div>
        <p className="text-xs text-muted-foreground">
          DNS is already verified for {domain}. Add another address without repeating domain setup.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-address`} className="text-xs">From Address</Label>
            <div className="flex items-center gap-2">
              <Input id={`${inputId}-address`} value={fromEmail} onChange={(event) => onEmailChange(event.target.value)}
                className="text-right min-w-0" disabled={isProcessing} autoCapitalize="none" spellCheck={false}
                aria-describedby={`${inputId}-preview`} />
              <span className="text-muted-foreground text-sm break-all">@{domain}</span>
            </div>
            <p id={`${inputId}-preview`} className="text-xs text-muted-foreground break-all">
              {fromEmail.trim() || "your-address"}@{domain}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${inputId}-name`} className="text-xs">From Name</Label>
            <Input id={`${inputId}-name`} placeholder="e.g. Acme Support" value={fromName}
              onChange={(event) => onNameChange(event.target.value)} disabled={isProcessing} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          This creates a separate email channel. Activate it and enable receiving for this address in the next step.
        </p>
      </SectionCardContent>
      <SectionCardFooter>
        <Button type="button" onClick={onCreate} disabled={isProcessing || !canCreate}>
          {isProcessing ? "Creating..." : "Create Email Channel"}
        </Button>
      </SectionCardFooter>
    </>
  )
}