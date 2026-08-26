import { toast } from "sonner"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { createTask, updateTask } from "@/app/leads/tasks/actions"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import type { CatalogItem, Reservation } from "@/app/types"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { isRoundRobinPassOrParent } from "@/app/commerce/pass-round-robin"
import { validateReservationSlot, updateReservationStatus, resolveRoundRobinService } from "../actions"
import { saveServiceReservation } from "../sale-order-actions"

export async function submitTeamTaskReservation(params: {
  siteId: string
  isEdit: boolean
  reservation?: Reservation | null
  taskTitle: string
  taskDate: Date
  taskTime: string
  taskType: string
  taskAssignee: string
  leadValue: RelationSelectValue
  notes: string
  taskCalendarSchedule: {
    id: string
    name?: string
    duration_minutes?: number
    location?: string | null
  } | null
  t: (key: string) => string
}) {
  const {
    siteId,
    isEdit,
    reservation,
    taskTitle,
    taskDate,
    taskTime,
    taskType,
    taskAssignee,
    leadValue,
    notes,
    taskCalendarSchedule,
    t,
  } = params

  if (!taskTitle.trim()) {
    toast.error(t("reservations.toast.taskTitleRequired") || "Task title is required")
    return { error: "Task title is required" }
  }

  const taskStartIso = new Date(`${taskDate.toISOString().split("T")[0]}T${taskTime}:00`).toISOString()
  let resolvedLeadId = null
  if (leadValue) {
    const { id, error: leadError } = await resolveRelationId("lead", leadValue, siteId)
    if (leadError) throw new Error(leadError)
    resolvedLeadId = id
  }

  let parsedExistingNotes: any = null
  if (isEdit) {
    const meta = reservation?.original_task_metadata || {}
    if (meta._calendar_context) parsedExistingNotes = meta._calendar_context
    else if (reservation?.original_task_description) {
      try {
        const parsed = JSON.parse(reservation.original_task_description)
        if (parsed._calendar_context) parsedExistingNotes = parsed._calendar_context
      } catch {
        // ignore
      }
    }
  }

  const taskPayload: any = {
    title: taskTitle.trim(),
    description: notes.trim() || null,
    type: taskType as any,
    stage: "consideration" as const,
    status: "pending" as const,
    scheduled_date: taskStartIso,
    assignee: taskAssignee || undefined,
    lead_id: resolvedLeadId,
    site_id: siteId,
    metadata: {},
  }

  if (taskCalendarSchedule) {
    const startDateObj = new Date(taskStartIso)
    const endDateObj = new Date(
      startDateObj.getTime() + (taskCalendarSchedule.duration_minutes || 30) * 60000,
    )
    taskPayload.metadata = {
      _calendar_context: {
        origin: parsedExistingNotes?.origin || "reservations_modal",
        catalog_item_id: taskCalendarSchedule.id,
        catalog_item_name: taskCalendarSchedule.name || "Team Calendar",
        duration: `${taskCalendarSchedule.duration_minutes || 30} min`,
        end_time: endDateObj.toISOString(),
        location: taskCalendarSchedule.location || parsedExistingNotes?.location || null,
      },
    }
  } else if (parsedExistingNotes) {
    taskPayload.metadata = { _calendar_context: parsedExistingNotes }
  }

  if (isEdit && reservation?.original_task_id) {
    const res = await updateTask(reservation.original_task_id, taskPayload)
    if (res.error) throw new Error(res.error)
    toast.success(t("reservations.toast.updated") || "Task updated")
  } else {
    const res = await createTask(taskPayload)
    if (res.error) throw new Error(res.error)
    toast.success(t("reservations.toast.created") || "Task created successfully")
  }

  return {}
}

export async function submitServiceReservationForm(params: {
  siteId: string
  isEdit: boolean
  reservation?: Reservation | null
  sellableItem: CatalogItem
  parentItem?: CatalogItem | null
  leadValue: RelationSelectValue
  selectedSlot: { start: string; end: string }
  taskAssignee: string
  notes: string
  selectedModifiers: CartModifier[]
  t: (key: string) => string
}) {
  const { id: resolvedLeadId, error: leadError } = await resolveRelationId(
    "lead",
    params.leadValue,
    params.siteId,
  )
  if (leadError) throw new Error(leadError)
  if (!resolvedLeadId) throw new Error("Customer is required")

  const { error: slotError } = await validateReservationSlot({
    siteId: params.siteId,
    catalogItem: {
      id: params.sellableItem.id,
      kind: params.sellableItem.kind,
      digital_subtype: params.sellableItem.digital_subtype,
      redeem_assignment_mode:
        params.sellableItem.redeem_assignment_mode ||
        params.parentItem?.redeem_assignment_mode,
    },
    startIso: params.selectedSlot.start,
    endIso: params.selectedSlot.end,
    quantity: params.reservation?.quantity || 1,
    isAdmin: true,
    ignoreReservationId: params.reservation?.id,
  })
  if (slotError) throw new Error(slotError)

  const isPass =
    params.sellableItem.digital_subtype === "pass" ||
    isRoundRobinPassOrParent(params.sellableItem, params.parentItem)

  let actualCatalogItemId = params.sellableItem.id
  if (isPass) {
    const { data: resolvedId, error: resolveError } = await resolveRoundRobinService({
      siteId: params.siteId,
      passCatalogItemId: params.sellableItem.id,
      startIso: params.selectedSlot.start,
      endIso: params.selectedSlot.end,
      quantity: params.reservation?.quantity || 1,
      ignoreReservationId: params.reservation?.id,
      preferredMemberId: params.reservation?.catalog_item_id,
    })
    if (resolveError) throw new Error(resolveError)
    if (resolvedId) actualCatalogItemId = resolvedId
  }

  const payload: Partial<Reservation> = {
    site_id: params.siteId,
    catalog_item_id: actualCatalogItemId,
    lead_id: resolvedLeadId,
    assignee_user_id: params.taskAssignee || undefined,
    start_time: params.selectedSlot.start,
    end_time: params.selectedSlot.end,
    notes: params.notes.trim() || null,
    quantity: params.reservation?.quantity || 1,
  }
  if (params.reservation) payload.id = params.reservation.id
  else payload.status = "confirmed"

  const res = await saveServiceReservation({
    reservation: payload,
    overrideSaleItemId: isPass ? params.sellableItem.id : undefined,
    modifiers: params.selectedModifiers.map((modifier) => ({
      catalogItemId: modifier.catalogItemId,
      quantity: modifier.cartQty,
      unitPriceOverride: modifier.cartPrice,
      groupId: modifier.groupId,
    })),
  })
  if (res.error) throw new Error(res.error)
  toast.success(
    params.isEdit
      ? params.t("reservations.toast.updated") || "Reservation updated"
      : params.t("reservations.toast.created") || "Reservation created successfully",
  )
  return {}
}

export async function cancelReservationFromDialog(params: {
  siteId: string
  reservation: Reservation
  t: (key: string) => string
}) {
  const res = await updateReservationStatus(params.siteId, params.reservation.id, "cancelled")
  if (res.error) throw new Error(res.error)
  toast.success(params.t("reservations.toast.cancelled") || "Reservation cancelled")
}
