"use client"

import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Loader2 } from "@/app/components/ui/icons"
import type { useMarketplaceAction } from "../hooks/use-marketplace-action"

export const marketplaceActionLabels = {
  accept: "Accept order", reject: "Reject order", ready: "Mark ready", cancel: "Cancel with provider", request: "Request courier",
}

export function MarketplaceActionDialog({ control }: { control: ReturnType<typeof useMarketplaceAction> }) {
  const action = control.action
  return <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open) control.close() }}>
    <DialogContent size="sm" busy={control.busy} showClose={!control.busy} onClick={(event) => event.stopPropagation()}>
      <DialogHeader>
        <DialogTitle>{action ? marketplaceActionLabels[action] : "Marketplace action"}</DialogTitle>
        <DialogDescription>The provider must confirm this action. Sending it does not start preparation or printing.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {action === "accept" && <div className="space-y-2">
          <Label htmlFor="marketplace-cooking-time">Cooking time (minutes)</Label>
          <Input id="marketplace-cooking-time" type="number" min={1} max={120} step={1}
            value={control.cookingTime} onChange={(event) => control.setCookingTime(event.target.value)} disabled={control.busy} />
        </div>}
        {(action === "reject" || action === "cancel") && <div className="space-y-2">
          <Label htmlFor="marketplace-reason">Reason</Label>
          <Textarea id="marketplace-reason" maxLength={500} value={control.reason}
            onChange={(event) => control.setReason(event.target.value)} disabled={control.busy} />
        </div>}
        {control.error && <p role="alert" className="text-sm text-destructive">{control.error}</p>}
        {control.result && <p role="status" className="text-sm">{control.result.message}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={control.close} disabled={control.busy}>Close</Button>
        <Button variant={action === "reject" || action === "cancel" ? "destructive" : "default"}
          data-permission="update" disabled={!action || !control.allowed(action)} onClick={() => void control.submit()}>
          {control.busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {control.busy ? "Waiting for provider…" : action ? marketplaceActionLabels[action] : "Confirm"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}