"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Checkbox } from "@/app/components/ui/checkbox"
import { ChevronDown, ChevronRight, Play, Trash2 } from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import {
  SectionCard,
  SectionCardContent,
  SectionCardHeader,
  SectionCardTitle,
} from "@/app/components/ui/section-card"
import { WEBHOOK_EVENT_OPTIONS, type WebhookEventType } from "@/lib/webhook-events"
import type { WebhookEndpoint } from "@/lib/webhooks"

interface WebhookEndpointCardProps {
  endpoint: WebhookEndpoint
  index: number
  isExpanded: boolean
  subscriptions: Record<string, boolean>
  isSubmitting: boolean
  onToggle: () => void
  onToggleEvent: (event: WebhookEventType, checked: boolean) => void
  onDelete: () => void
  onTest: () => void
}

export function WebhookEndpointCard({
  endpoint,
  index,
  isExpanded,
  subscriptions,
  isSubmitting,
  onToggle,
  onToggleEvent,
  onDelete,
  onTest,
}: WebhookEndpointCardProps) {
  return (
    <SectionCard id={`webhook-endpoint-${index}`} className="border border-border">
      <SectionCardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <SectionCardTitle className="text-lg font-semibold truncate">
              {endpoint.name}
            </SectionCardTitle>
            <p className="text-sm text-muted-foreground truncate mt-1">{endpoint.target_url}</p>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </SectionCardHeader>

      {isExpanded && (
        <>
          <SectionCardContent className="space-y-4 border-t">
            <div className="space-y-2">
              <Label>Subscribed Events</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {WEBHOOK_EVENT_OPTIONS.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!subscriptions[option.id]}
                      onCheckedChange={(checked: boolean) => onToggleEvent(option.id, !!checked)}
                      disabled={isSubmitting}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endpoint ID</Label>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono bg-muted px-2 py-1 rounded">{endpoint.id}</span>
              </div>
            </div>
          </SectionCardContent>

          <ActionFooter>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Endpoint
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Endpoint</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the webhook endpoint &quot;{endpoint.name}&quot;?
                      This action cannot be undone and all subscriptions will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                    >
                      Delete Endpoint
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button type="button" variant="outline" onClick={onTest} disabled={isSubmitting}>
                <Play className="h-4 w-4 mr-2" />
                Test Endpoint
              </Button>
            </div>
          </ActionFooter>
        </>
      )}
    </SectionCard>
  )
}
