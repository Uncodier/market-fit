"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { SectionCardFooter } from "@/app/components/ui/section-card"
import { useLocalization } from "@/app/context/LocalizationContext"

const actions = {
  remove_agents: { label: "connectors.removeAllAgents", help: "connectors.removeAllAgentsHelp" },
  remove_members: { label: "connectors.removeAllMembers", help: "connectors.removeAllMembersHelp" },
} as const

export type BulkAccessOperation = keyof typeof actions

export function ConnectorBulkAccess({ name, members, agents, disabled, pending, onConfirm }: {
  name: string; members: boolean; agents: boolean; disabled: boolean; pending: boolean;
  onConfirm: (operation: BulkAccessOperation) => Promise<void>
}) {
  const { t } = useLocalization()
  const [operation, setOperation] = useState<BulkAccessOperation>()
  return <SectionCardFooter className="flex-wrap">
    <Button type="button" variant="outline" size="sm" disabled={disabled || !agents} onClick={() => setOperation("remove_agents")}>
      {t(actions.remove_agents.label)}
    </Button>
    <Button type="button" variant="outline" size="sm" disabled={disabled || !members} onClick={() => setOperation("remove_members")}>
      {t(actions.remove_members.label)}
    </Button>
    {operation && <ConfirmDialog open onOpenChange={open => { if (!open) setOperation(undefined) }}
      title={t(actions[operation].label)} description={t(actions[operation].help, { account: name })}
      confirmLabel={t("connectors.removeAccess")} cancelLabel={t("connectors.cancel")} variant="destructive" loading={pending}
      onConfirm={() => onConfirm(operation)} />}
  </SectionCardFooter>
}