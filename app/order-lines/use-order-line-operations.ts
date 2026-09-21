"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { siteMembersService } from "@/app/services/site-members-service"
import {
  advanceOperationalOrderLines,
  assignOperationalOrderLines,
  updateOperationalOrderLineStatus,
} from "./actions"
import { orderLineStatusLabel, type OrderLineActionStatus } from "./status"
import type { OrderLineAssignee, OrderLineRow } from "./types"

interface AuthUser {
  id: string
  email?: string | null
  user_metadata?: {
    name?: string
    full_name?: string
  }
}

interface UseOrderLineOperationsOptions {
  siteId?: string
  user?: AuthUser | null
  refresh: () => Promise<unknown>
  t: (key: string) => string
}

export function useOrderLineOperations({
  siteId,
  user,
  refresh,
  t,
}: UseOrderLineOperationsOptions) {
  const [updatingLineId, setUpdatingLineId] = useState<string | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const { data: listedAssignees } = useSWR(
    siteId ? ["order-line-assignees", siteId] : null,
    async () => {
      const members = await siteMembersService.getMembers(siteId!)
      return members
        .filter(
          (member) => member.status === "active" && Boolean(member.user_id),
        )
        .map((member) => ({
          id: member.user_id!,
          name: member.name?.trim() || member.email,
        }))
    },
  )
  const assignees = useMemo<OrderLineAssignee[]>(() => {
    const currentName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      "Current user"
    const options = [...(listedAssignees || [])]
    if (user?.id && !options.some((member) => member.id === user.id)) {
      options.unshift({ id: user.id, name: currentName })
    }
    return options
  }, [listedAssignees, user])
  const busy = Boolean(updatingLineId || updatingOrderId)

  const updateStatus = async (
    line: OrderLineRow,
    status: OrderLineActionStatus,
  ) => {
    if (!siteId || busy) return
    setUpdatingLineId(line.id)
    try {
      const result = await updateOperationalOrderLineStatus(
        siteId,
        line.id,
        status,
      )
      if (result.error) throw new Error(result.error)
      toast.success(
        `${line.name} marked as ${orderLineStatusLabel(status).toLowerCase()}`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("orderLines.error.updateFailed"),
      )
    } finally {
      setUpdatingLineId(null)
      void refresh()
    }
  }

  const advanceOrder = async (lines: OrderLineRow[]) => {
    if (!siteId || busy || lines.length === 0) return
    setUpdatingOrderId(lines[0].order.id)
    try {
      const result = await advanceOperationalOrderLines(
        siteId,
        lines.map((line) => line.id),
      )
      if (result.error) throw new Error(result.error)
      toast.success(
        `${result.count || 0} ${t("orderLines.bulk.linesAdvanced")}`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("orderLines.bulk.updateFailed"),
      )
    } finally {
      setUpdatingOrderId(null)
      void refresh()
    }
  }

  const assignLines = async (
    lines: OrderLineRow[],
    assigneeId: string | null,
  ) => {
    if (!siteId || busy || lines.length === 0) return
    const isBulk = lines.length > 1
    if (isBulk) setUpdatingOrderId(lines[0].order.id)
    else setUpdatingLineId(lines[0].id)

    try {
      const result = await assignOperationalOrderLines(
        siteId,
        lines.map((line) => line.id),
        assigneeId,
      )
      if (result.error) throw new Error(result.error)
      toast.success(
        assigneeId
          ? t("orderLines.assignee.assigned")
          : t("orderLines.assignee.unassignedSuccess"),
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("orderLines.assignee.updateFailed"),
      )
    } finally {
      if (isBulk) setUpdatingOrderId(null)
      else setUpdatingLineId(null)
      void refresh()
    }
  }

  return {
    assignees,
    updatingLineId,
    updatingOrderId,
    updateStatus,
    advanceOrder,
    assignLines,
  }
}
