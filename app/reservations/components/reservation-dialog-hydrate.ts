import type { CatalogItem, Reservation } from "@/app/types"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"

export function existingRelationValue(
  id: string | null | undefined,
  label: string,
): RelationSelectValue {
  if (!id) return null
  return { mode: "existing", id, label }
}

export function buildCombinedCalendars(params: {
  siteCalendars?: any[]
  profileCalendarsData?: { id: string; name?: string; settings?: any }[]
}) {
  const cals: any[] = []
  ;(params.siteCalendars || []).forEach((cal: any) => {
    cals.push({
      id: cal.id,
      name: cal.name,
      duration_minutes: cal.duration || 30,
      type: "site",
      label: `${cal.name} (Team)`,
      location: cal.location || null,
    })
  })
  ;(params.profileCalendarsData || []).forEach((profile) => {
    const eventTypes = profile.settings?.calendar?.event_types || []
    eventTypes.forEach((et: any) => {
      cals.push({
        id: et.id,
        name: et.title,
        duration_minutes: et.duration || 30,
        type: "profile",
        label: `${et.title} (${profile.name || "User"})`,
        owner_id: profile.id,
        location: et.location || null,
      })
    })
  })
  return cals
}

export function hydrateReservationForm(reservation: Reservation) {
  if (reservation.is_task) {
    let rawDescription = (reservation as any).original_task_description || ""
    let rawMetadata = (reservation as any).original_task_metadata || {}
    let parsedNotes = rawDescription
    let extractedCalendarId = (reservation as any).original_schedule_id || null
    let contextData = rawMetadata?._calendar_context
    if (!contextData) {
      try {
        const notesData = JSON.parse(rawDescription)
        if (notesData._calendar_context) {
          contextData = notesData._calendar_context
          parsedNotes = notesData.notes || ""
        }
      } catch {
        // not json
      }
    } else {
      try {
        const notesData = JSON.parse(rawDescription)
        if (notesData._calendar_context) parsedNotes = notesData.notes || ""
      } catch {
        parsedNotes = rawDescription
      }
    }
    if (contextData) extractedCalendarId = extractedCalendarId || contextData.catalog_item_id
    const start = reservation.start_time ? new Date(reservation.start_time) : undefined
    return {
      mode: "task" as const,
      taskTitle: (reservation as any).original_task_title || reservation.catalog_item?.name || "",
      taskAssignee: reservation.assignee_user_id || "",
      taskType: (reservation as any).original_task_type || "meeting",
      notes: parsedNotes,
      taskCalendarValue: extractedCalendarId
        ? existingRelationValue(extractedCalendarId, "Calendar")
        : null,
      taskDate: start,
      taskTime: start ? start.toTimeString().slice(0, 5) : "09:00",
      leadValue: existingRelationValue(
        reservation.lead_id,
        reservation.lead?.name || reservation.lead?.email || reservation.lead_id,
      ),
      catalogItemValue: null as RelationSelectValue,
      selectedSlot: null as { start: string; end: string } | null,
    }
  }

  return {
    mode: "service" as const,
    catalogItemValue: existingRelationValue(
      reservation.catalog_item_id,
      reservation.catalog_item?.name || reservation.catalog_item_id || "",
    ),
    leadValue: existingRelationValue(
      reservation.lead_id,
      reservation.lead?.name || reservation.lead?.email || reservation.lead_id,
    ),
    taskAssignee: reservation.assignee_user_id || "",
    selectedSlot: { start: reservation.start_time, end: reservation.end_time },
    notes: reservation.notes || "",
    taskTitle: "",
    taskType: "meeting",
    taskCalendarValue: null as RelationSelectValue,
    taskDate: undefined as Date | undefined,
    taskTime: "09:00",
  }
}

export function resolveSellableChild(
  axesLength: number,
  selectedOptions: Record<string, string>,
  children: CatalogItem[],
) {
  if (!axesLength) return null
  if (Object.keys(selectedOptions).length !== axesLength) return null
  return (
    children.find((child) => {
      const childOpts = child.metadata?.option_values
      if (!childOpts) return false
      return Object.entries(selectedOptions).every(([aId, vId]) => childOpts[aId] === vId)
    }) || null
  )
}

export function isReservationDialogDirty(params: {
  isEdit: boolean
  mode: "service" | "task"
  reservation?: Reservation | null
  taskTitle: string
  taskAssignee: string
  notes: string
  leadId: string
  catalogItemId: string
  selectedSlot: { start: string; end: string } | null
  taskDate?: Date
  catalogItemValue: unknown
  leadValue: unknown
}) {
  const {
    isEdit,
    mode,
    reservation,
    taskTitle,
    taskAssignee,
    notes,
    leadId,
    catalogItemId,
    selectedSlot,
    taskDate,
    catalogItemValue,
    leadValue,
  } = params
  if (isEdit) {
    if (mode === "task") {
      return (
        taskTitle.trim() !== (reservation?.catalog_item?.name || "") ||
        taskAssignee !== (reservation?.assignee_user_id || "") ||
        notes.trim() !== (reservation?.notes || "") ||
        leadId !== (reservation?.lead_id || "")
      )
    }
    return (
      catalogItemId !== (reservation?.catalog_item_id || "") ||
      leadId !== (reservation?.lead_id || "") ||
      taskAssignee !== (reservation?.assignee_user_id || "") ||
      selectedSlot?.start !== reservation?.start_time ||
      selectedSlot?.end !== reservation?.end_time ||
      notes.trim() !== (reservation?.notes || "")
    )
  }
  if (mode === "task") {
    return Boolean(taskTitle.trim() || taskAssignee || taskDate || leadValue || notes.trim())
  }
  return Boolean(catalogItemValue || leadValue || taskAssignee || selectedSlot || notes.trim())
}
