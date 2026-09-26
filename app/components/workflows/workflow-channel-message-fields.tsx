"use client"

import { useMemo } from "react"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { COMMUNICATION_CHANNELS, getChannelLabel, getEnabledSiteChannels, normalizeChannel } from "@/lib/site-channels"
import { useZavuSenderPhoneNumbers } from "@/app/components/settings/use-zavu-sender-phone-numbers"
import { WF_FIELD_CLASS, type WorkflowTriggerConfig } from "./types"
import { WorkflowSearchSelect } from "./workflow-search-select"
import { getWorkflowConnectionLabel } from "./workflow-connection-label"

export function WorkflowChannelMessageFields({
  trigger,
  onPersist,
}: {
  trigger: WorkflowTriggerConfig
  onPersist: (patch: Record<string, unknown>) => Promise<unknown>
}) {
  const { currentSite } = useSite()
  const allConnections = currentSite?.settings?.channels?.connections || []
  const channel = trigger.channel || "any"
  const connections = allConnections.filter((connection) =>
    Boolean(connection.id) && ["connected", "active", "synced"].includes(connection.status) &&
    (channel === "any" || normalizeChannel(connection.type) === channel),
  )
  const senderPhoneNumbers = useZavuSenderPhoneNumbers({ connections, enabled: true })
  const available = getEnabledSiteChannels(currentSite)
  const channelOptions = useMemo(() => {
    const channels = available.length ? available : [...COMMUNICATION_CHANNELS]
    return [
      { value: "any", label: "Any channel" },
      ...channels.map((channel) => ({ value: channel, label: getChannelLabel(channel) })),
    ]
  }, [available])
  const hasAmbiguousConnections = channel === "any" || connections.length !== 1
  const priority = Number.isInteger(trigger.priority) && trigger.priority! >= 0 && trigger.priority! <= 100
    ? trigger.priority!
    : 50

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-background/30 p-3">
      <p className="text-[11px] text-muted-foreground">
        Runs on new customer messages before Customer Support replies. The workflow adds context; Customer Support sends the only reply.
        Pre-response steps can report results, but cannot use business, sandbox or browser tools.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">Channel</span>
        <WorkflowSearchSelect
          options={channelOptions}
          value={channel}
          placeholder="Channel"
          allowCreate={false}
          onChange={(next) => void onPersist({
            trigger: { ...trigger, channel: next === "any" ? undefined : next, connection_id: undefined },
          })}
        />
      </label>
      {(connections.length > 0 || Boolean(trigger.connection_id)) && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium">Connection (optional)</span>
          <WorkflowSearchSelect
            options={[
              { value: "any", label: "Any connection" },
              ...connections.map((connection) => ({
                value: connection.id!,
                label: getWorkflowConnectionLabel(connection, senderPhoneNumbers[connection.zavu_sender_id || ""]),
              })),
            ]}
            value={trigger.connection_id || "any"}
            placeholder="Connection"
            allowCreate={false}
            disabled={hasAmbiguousConnections}
            onChange={(next) => void onPersist({ trigger: { ...trigger, connection_id: next === "any" ? undefined : next } })}
          />
          {hasAmbiguousConnections && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">
                Connection filtering requires exactly one connected account for this channel. Choose a channel with one account, or use Any connection.
              </span>
              {trigger.connection_id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start h-7 text-[11px]"
                  onClick={() => void onPersist({ trigger: { ...trigger, connection_id: undefined } })}
                >
                  Use any connection
                </Button>
              )}
            </div>
          )}
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">Priority (0–100)</span>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          aria-label="Priority (0–100)"
          className={WF_FIELD_CLASS}
          key={`${trigger.channel || "any"}-${priority}`}
          defaultValue={priority}
          onBlur={(event) => {
            const value = Number(event.target.value)
            if (!Number.isInteger(value) || value < 0 || value > 100) {
              event.target.value = String(priority)
              return
            }
            if (value !== priority) void onPersist({ trigger: { ...trigger, priority: value } })
          }}
        />
        <span className="text-[10px] text-muted-foreground">
          Higher priority takes precedence when workflow guidance conflicts. Equal priorities prefer a specific connection, then a channel.
        </span>
      </label>
    </div>
  )
}