"use client"

import { useEffect, useState, useMemo } from "react"
import { format } from "date-fns"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createClient } from "@/lib/supabase/client"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import { resolveVariantAxesForDisplay } from "@/app/catalog/variant-resolve"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import { ModifierPickerPanel, isModifierSelectionValid } from "@/app/components/commerce/ModifierPickerPanel"
import type { Reservation, CatalogItem, VariantAxis } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { upsertReservation } from "../actions"
import { assertReservationSlot } from "../availability"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"
import { Skeleton } from "@/app/components/ui/skeleton"
import { User, List, CheckSquare } from "@/app/components/ui/icons"
import { PosCustomerSelect } from "@/app/pos/components/PosCustomerSelect"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { TimeSelect } from "@/app/components/ui/time-select"
import { Combobox } from "@/app/components/ui/combobox"
import { createTask, updateTask } from "@/app/leads/tasks/actions"

function ReservationDialogFormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mx-auto h-6 w-52" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  )
}

interface CreateReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  reservation?: Reservation | null
  initialSlot?: { start: string; end: string } | null
}

function existingValue(id: string | null | undefined, label: string): RelationSelectValue {
  if (!id) return null
  return { mode: "existing", id, label }
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  onSuccess,
  reservation,
  initialSlot,
}: CreateReservationDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()
  const router = useRouter()
  const isEdit = Boolean(reservation)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [catalogItemValue, setCatalogItemValue] = useState<RelationSelectValue>(null)
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)
  const [notes, setNotes] = useState("")
  
  const [mode, setMode] = useState<"service" | "task">("service")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskAssignee, setTaskAssignee] = useState<string>("")
  const [taskDate, setTaskDate] = useState<Date | undefined>(undefined)
  const [taskTime, setTaskTime] = useState("09:00")
  const [taskCalendarValue, setTaskCalendarValue] = useState<RelationSelectValue>(null)
  const [taskType, setTaskType] = useState("meeting")

  const [children, setChildren] = useState<CatalogItem[]>([])
  const [axes, setAxes] = useState<VariantAxis[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [loadingModifiers, setLoadingModifiers] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupWithItems[]>([])
  const [selectedModifiers, setSelectedModifiers] = useState<CartModifier[]>([])

  const { data: leadsData } = useSWR(
    open && currentSite ? ["leads", currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData, isLoading: catalogLoading } = useSWR(
    open && currentSite ? ["catalog", currentSite.id, "reservable"] : null,
    () => listCatalogItems({ siteId: currentSite!.id, isReservation: true, pageSize: 100 })
  )

  const { data: membersData } = useSWR(
    open && currentSite ? ["site_members", currentSite.id] : null,
    async () => {
      const res = await fetch(`/api/site-members/${currentSite!.id}`)
      if (!res.ok) throw new Error("Failed to fetch members")
      return res.json()
    }
  )

  const { data: profileCalendarsData, isLoading: profilesLoading } = useSWR(
    open && currentSite && membersData?.members ? ["profiles_calendars", currentSite.id] : null,
    async () => {
      const supabase = createClient()
      const memberIds = (membersData?.members || []).map((m: any) => m.user_id).filter(Boolean)
      
      if (memberIds.length === 0) return []
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, settings")
        .in("id", memberIds)
        
      if (error) throw error
      return data
    }
  )

  const combinedCalendars = useMemo(() => {
    const cals: any[] = []
    
    // 1. Site calendars
    const siteCals = currentSite?.settings?.calendars || []
    siteCals.forEach((cal: any) => {
      cals.push({
        id: cal.id,
        name: cal.name,
        duration_minutes: cal.duration || 30,
        type: 'site',
        label: `${cal.name} (Team)`,
        location: cal.location || null
      })
    })
    
    // 2. Profile event types
    if (profileCalendarsData) {
      profileCalendarsData.forEach((profile: any) => {
        const eventTypes = profile.settings?.calendar?.event_types || []
        eventTypes.forEach((et: any) => {
          cals.push({
            id: et.id,
            name: et.title,
            duration_minutes: et.duration || 30,
            type: 'profile',
            label: `${et.title} (${profile.name || 'User'})`,
            owner_id: profile.id,
            location: et.location || null
          })
        })
      })
    }
    
    return cals
  }, [currentSite?.settings?.calendars, profileCalendarsData])

  const leads = leadsData?.leads || []
  const members = membersData?.members || []
  const items = useMemo(() => (catalogData?.data || []).filter((item: any) => !item.parent_id), [catalogData?.data])
  const schedules = combinedCalendars
  const schedulesLoading = profilesLoading
  const catalogItemId = catalogItemValue?.mode === "existing" ? catalogItemValue.id : ""

  const resetForm = () => {
    setCatalogItemValue(null)
    setLeadValue(null)
    setSelectedSlot(null)
    setNotes("")
    setChildren([])
    setAxes([])
    setModifierGroups([])
    setSelectedOptions({})
    setSelectedModifiers([])
    setMode("service")
    setTaskTitle("")
    setTaskType("meeting")
    setTaskAssignee("")
    setTaskDate(undefined)
    setTaskTime("09:00")
    setTaskCalendarValue(null)
  }

  useEffect(() => {
    if (!open) return
    if (reservation) {
      if (reservation.is_task) {
        setMode("task")
        setTaskTitle((reservation as any).original_task_title || reservation.catalog_item?.name || "")
        setTaskAssignee(reservation.assignee_user_id || "")
        
        // We'll set taskType from the original task type if we mapped it, but since we map to Reservation, we don't have it here directly unless we attach it.
        // As a fallback, we default to "meeting" if it's not present.
        setTaskType((reservation as any).original_task_type || "meeting")
        
        // Extract calendar context if present on the raw record directly, or fallback to parsing the description for legacy compatibility.
        let rawDescription = (reservation as any).original_task_description || ""
        let rawMetadata = (reservation as any).original_task_metadata || {}
        let parsedNotes = rawDescription
        let extractedCalendarId = (reservation as any).original_schedule_id || null
        
        let contextData = rawMetadata?._calendar_context;
        if (!contextData) {
          try {
            const notesData = JSON.parse(rawDescription)
            if (notesData._calendar_context) {
              contextData = notesData._calendar_context
              parsedNotes = notesData.notes || ""
            }
          } catch (e) {
            // not json
          }
        } else {
          // Even if contextData exists, rawDescription might still contain the legacy JSON string 
          // because previous updates didn't clear it. Let's clean it up if so.
          try {
            const notesData = JSON.parse(rawDescription)
            if (notesData._calendar_context) {
              parsedNotes = notesData.notes || ""
            }
          } catch(e) {
            parsedNotes = rawDescription;
          }
        }

        if (contextData) {
          extractedCalendarId = extractedCalendarId || contextData.catalog_item_id
        }
        
        setNotes(parsedNotes)
        if (extractedCalendarId) {
           setTaskCalendarValue(existingValue(extractedCalendarId, "Calendar"))
        }

        if (reservation.start_time) {
          const dt = new Date(reservation.start_time)
          setTaskDate(dt)
          setTaskTime(dt.toTimeString().slice(0, 5))
        }
        setLeadValue(
          existingValue(reservation.lead_id, reservation.lead?.name || reservation.lead?.email || reservation.lead_id)
        )
      } else {
        setMode("service")
        setCatalogItemValue(
          existingValue(
            reservation.catalog_item_id,
            reservation.catalog_item?.name || reservation.catalog_item_id || ""
          )
        )
        setLeadValue(
          existingValue(reservation.lead_id, reservation.lead?.name || reservation.lead?.email || reservation.lead_id)
        )
        setTaskAssignee(reservation.assignee_user_id || "")
        setSelectedSlot({ start: reservation.start_time, end: reservation.end_time })
        setNotes(reservation.notes || "")
      }
      return
    }
    resetForm()
    
    // Automatically switch to Team Task mode if there are no reservable services
    if (!catalogLoading && items.length === 0) {
      setMode("task")
    }

    if (initialSlot) {
      setSelectedSlot(initialSlot)
      const dt = new Date(initialSlot.start)
      setTaskDate(dt)
      setTaskTime(dt.toTimeString().slice(0, 5))
    }
  }, [open, reservation, initialSlot, items.length, catalogLoading])

  useEffect(() => {
    if (!catalogItemId || !currentSite) return
    
    // Si estamos editando y el catalogItemId ya es una variante (no está en la lista de items filtrados que solo tiene parents),
    // `parentItem` será undefined. No cargaremos hijos ni modifiers para la variante en sí, porque se asume que ya fue seleccionado
    // y en edición no permitimos re-seleccionar variantes, solo cambiar de servicio principal.
    const parentItem = items.find((i: any) => i.id === catalogItemId)
    
    if (!parentItem) {
      setChildren([])
      setAxes([])
      setModifierGroups([])
      setSelectedOptions({})
      return
    }

    setLoadingVariants(true)
    setLoadingModifiers(true)
    setSelectedOptions({})
    setSelectedModifiers([])
    setChildren([])
    setAxes([])
    setModifierGroups([])

    const supabase = createClient()
    
    void supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", catalogItemId)
      .eq("status", "active")
      .eq("is_purchasable", true)
      .then(({ data, error }) => {
        if (data && !error) {
          const resolved = resolveVariantAxesForDisplay(
            parentItem,
            data as CatalogItem[]
          )
          setChildren(resolved.children)
          setAxes(resolved.axes)
        }
        setLoadingVariants(false)
      })

    void getModifierGroupsForCatalogItem(catalogItemId).then(({ data }) => {
      setModifierGroups(data || [])
      setLoadingModifiers(false)
    })
  }, [catalogItemId, currentSite, items])

  const resolvedChild = useMemo(() => {
    if (!axes.length) return null
    if (Object.keys(selectedOptions).length !== axes.length) return null
    return (
      children.find((c) => {
        const childOpts = c.metadata?.option_values
        if (!childOpts) return false
        return Object.entries(selectedOptions).every(
          ([aId, vId]) => childOpts[aId] === vId
        )
      }) || null
    )
  }, [selectedOptions, axes.length, children])

  const needsVariant = axes.length > 0
  const parentItemObj = useMemo(() => {
    const found = items.find((i: any) => i.id === catalogItemId)
    if (found) return found
    if (reservation && reservation.catalog_item_id === catalogItemId) {
      return { id: catalogItemId, name: reservation.catalog_item?.name || catalogItemId } as CatalogItem
    }
    return null
  }, [items, catalogItemId, reservation])
  
  const sellableItem = needsVariant ? resolvedChild : parentItemObj

  const modifiersValid = modifierGroups.length === 0 || isModifierSelectionValid(modifierGroups, selectedModifiers).ok

  // Support auto-filling duration from selected calendar (schedule) for Team Tasks
  const taskCalendarId = taskCalendarValue?.mode === "existing" ? taskCalendarValue.id : ""
  const taskCalendarSchedule = useMemo(() => {
    return schedules.find((s: any) => s.id === taskCalendarId) || null
  }, [schedules, taskCalendarId])

  // Optional: you could theoretically disable end time fields or do auto-calculating in real-time,
  // but we can simply resolve the correct endTime during submit if a schedule is chosen.

  const dirty = isEdit
    ? (mode === "task"
      ? taskTitle.trim() !== (reservation?.catalog_item?.name || "") ||
        taskAssignee !== (reservation?.assignee_user_id || "") ||
        taskDate?.getTime() !== (reservation?.start_time ? new Date(reservation.start_time).getTime() : undefined) ||
        notes.trim() !== (reservation?.notes || "") ||
        (leadValue?.mode === "existing" ? leadValue.id : "") !== (reservation?.lead_id || "") ||
        (taskCalendarValue?.mode === "existing" ? taskCalendarValue.id : "") !== "" // simplistic dirty check for calendar
      : catalogItemId !== (reservation?.catalog_item_id || "") ||
        (leadValue?.mode === "existing" ? leadValue.id : "") !== (reservation?.lead_id || "") ||
        taskAssignee !== (reservation?.assignee_user_id || "") ||
        selectedSlot?.start !== reservation?.start_time ||
        selectedSlot?.end !== reservation?.end_time ||
        notes.trim() !== (reservation?.notes || ""))
    : Boolean(
        mode === "task"
          ? taskTitle.trim() || taskAssignee || taskDate || leadValue || notes.trim()
          : catalogItemValue || leadValue || taskAssignee || selectedSlot || notes.trim()
      )

  const { discardOpen, setDiscardOpen, handleOpenChange, confirmDiscard } =
    useDirtyDialogClose({
      dirty,
      busy: isSubmitting,
      onOpenChange: (next) => {
        if (!next) resetForm()
        onOpenChange(next)
      },
    })

  const handleSubmit = async () => {
    if (!currentSite) return
    setIsSubmitting(true)
    
    try {
      if (mode === "task") {
        if (!taskTitle.trim()) {
          toast.error("Task title is required")
          setIsSubmitting(false)
          return
        }
        if (!taskDate || !taskTime) {
          toast.error("Select a date and time")
          setIsSubmitting(false)
          return
        }

        const taskStartIso = new Date(`${taskDate.toISOString().split("T")[0]}T${taskTime}:00`).toISOString()
        
        let resolvedLeadId = null
        if (leadValue) {
          const { id, error: leadError } = await resolveRelationId(
            "lead",
            leadValue,
            currentSite.id
          )
          if (leadError) throw new Error(leadError)
          resolvedLeadId = id
        }

        // If we are editing, we might already have a _calendar_context in `notes`
        // We only overwrite it if the user actually changed the calendar (taskCalendarSchedule exists)
        // If they didn't select a new one, but we have an old one, we should preserve it.
        let parsedExistingNotes: any = null
        if (isEdit) {
           const meta = reservation?.original_task_metadata || {}
           if (meta._calendar_context) {
              parsedExistingNotes = meta._calendar_context
           } else if (reservation?.original_task_description) {
              try {
                const parsed = JSON.parse(reservation.original_task_description)
                if (parsed._calendar_context) {
                  parsedExistingNotes = parsed._calendar_context
                }
              } catch(e) {}
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
          site_id: currentSite.id,
          metadata: {},
        }
        
        if (taskCalendarSchedule) {
           const startDateObj = new Date(taskStartIso)
           const endDateObj = new Date(startDateObj.getTime() + (taskCalendarSchedule.duration_minutes * 60000))
           taskPayload.metadata = {
             _calendar_context: {
               origin: parsedExistingNotes?.origin || "reservations_modal",
               catalog_item_id: taskCalendarSchedule.id,
               catalog_item_name: taskCalendarSchedule.name || "Team Calendar",
               duration: `${taskCalendarSchedule.duration_minutes} min`,
               end_time: endDateObj.toISOString(),
               location: taskCalendarSchedule.location || parsedExistingNotes?.location || null 
             }
           }
        } else if (parsedExistingNotes) {
           taskPayload.metadata = {
             _calendar_context: parsedExistingNotes
           }
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

        resetForm()
        onSuccess()
        onOpenChange(false)
        return
      }

      if (!selectedSlot) {
        toast.error("Select a time slot")
        setIsSubmitting(false)
        return
      }
      if (!sellableItem) throw new Error("Service is required")
      const resolvedItemId = sellableItem.id

      const { id: resolvedLeadId, error: leadError } = await resolveRelationId(
        "lead",
        leadValue,
        currentSite.id
      )
      if (leadError) throw new Error(leadError)
      if (!resolvedLeadId) throw new Error("Customer is required")

      await assertReservationSlot(
        currentSite.id,
        resolvedItemId,
        selectedSlot.start,
        selectedSlot.end,
        reservation?.quantity || 1,
        true,
        reservation?.id
      )

      let finalNotes = notes.trim()
      if (selectedModifiers.length > 0) {
        const modifiersText = selectedModifiers
          .map(m => `- ${m.cartQty}x ${m.name}` + (m.cartPrice ? ` (+${formatPrice(m.cartPrice, parentItemObj?.currency || "USD")})` : ""))
          .join("\n")
        finalNotes = finalNotes ? `${finalNotes}\n\nExtras:\n${modifiersText}` : `Extras:\n${modifiersText}`
      }

      const payload: Partial<Reservation> = {
        site_id: currentSite.id,
        catalog_item_id: resolvedItemId,
        lead_id: resolvedLeadId,
        assignee_user_id: taskAssignee || undefined,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        notes: finalNotes || null,
        quantity: reservation?.quantity || 1,
      }
      if (reservation) {
        payload.id = reservation.id
      } else {
        payload.status = "confirmed"
      }

      const res = await upsertReservation(payload)
      if (res.error) throw new Error(res.error)

      toast.success(
        isEdit
          ? t("reservations.toast.updated") || "Reservation updated"
          : t("reservations.toast.created") || "Reservation created successfully"
      )
      resetForm()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(
        error.message ||
          (isEdit
            ? t("reservations.toast.updateFailed") || "Failed to update reservation"
            : t("reservations.toast.createFailed") || "Failed to create reservation")
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="lg" busy={isSubmitting}>
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? (reservation?.is_task ? "Edit Task" : t("reservations.dialog.editTitle") || "Edit reservation")
                : t("reservations.dialog.createTitle") || "Create reservation"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? (reservation?.is_task ? "Update the task details." : t("reservations.dialog.editDescription") || "Update the service, customer, time slot, or notes.")
                : t("reservations.dialog.createDescription") || "Book a reservable service for a customer."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {!isEdit && (
              <div className="flex justify-center mb-4">
                <Tabs value={mode} onValueChange={(val) => setMode(val as "service" | "task")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="service" disabled={items.length === 0 && !catalogLoading}>Service</TabsTrigger>
                    <TabsTrigger value="task">Team Task</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {mode === "task" ? (
              <>
                <div className="space-y-2">
                  <Label>Task Title</Label>
                  <Input 
                    placeholder="Enter task name..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Combobox
                    options={members.map((m: any) => ({ value: m.user_id, label: m.name || m.email }))}
                    value={taskAssignee}
                    onValueChange={setTaskAssignee}
                    placeholder="Select team member..."
                    emptyMessage="No members found"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Calendar (Optional)</Label>
                  <RelationSelect
                    options={schedules.map((schedule: any) => ({
                      id: schedule.id,
                      label: schedule.label || schedule.name || "Unnamed Calendar",
                    }))}
                    value={taskCalendarValue}
                    onValueChange={setTaskCalendarValue}
                    allowCreate={false}
                    placeholder="Link to a specific calendar/schedule..."
                    emptyMessage={schedulesLoading ? "Loading calendars..." : "No calendars found"}
                  />
                  {taskCalendarSchedule?.duration_minutes && (
                     <p className="text-xs text-muted-foreground">
                       Duration: {taskCalendarSchedule.duration_minutes} mins
                     </p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <DatePicker 
                      date={taskDate} 
                      setDate={setTaskDate as any} 
                      className="w-full h-11 bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <TimeSelect 
                      value={taskTime} 
                      onValueChange={setTaskTime} 
                      step={15}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Customer (Optional)</Label>
                  <PosCustomerSelect
                    leads={leads}
                    leadValue={leadValue}
                    setLeadValue={setLeadValue}
                    siteId={currentSite.id}
                    t={t}
                    clearable={true}
                    placeholder="Select customer..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website_visit">Website Visit</SelectItem>
                      <SelectItem value="demo">Product Demo</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="quote">Quote</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Any special requirements or details?"
                  />
                </div>
              </>
            ) : catalogLoading ? (
              <ReservationDialogFormSkeleton />
            ) : mode === "service" && items.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">No reservable services</p>
                <p className="text-muted-foreground mt-1">
                  Create a reservable service in your catalog first.
                </p>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => {
                    handleOpenChange(false)
                    router.push("/catalog")
                  }}
                >
                  Go to Catalog
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Service</Label>
                  <RelationSelect
                    options={items.map((item: { id: string; name: string }) => ({
                      id: item.id,
                      label: item.name,
                    }))}
                    value={catalogItemValue}
                    onValueChange={(value) => {
                      setCatalogItemValue(value)
                      if (!reservation && !initialSlot) setSelectedSlot(null)
                    }}
                    allowCreate={false}
                    placeholder="Select a reservable service..."
                    emptyMessage="No reservable services found"
                  />
                </div>

                {/* Variants & Modifiers */}
                {catalogItemId && (loadingVariants || loadingModifiers) ? (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-16 w-full rounded-2xl" />
                      <Skeleton className="h-16 w-full rounded-2xl" />
                    </div>
                  </div>
                ) : catalogItemId && (needsVariant || modifierGroups.length > 0) ? (
                  <>
                    {needsVariant && (
                      <div className="[&_.mb-8]:mb-0 [&_.space-y-8]:space-y-4 [&_section]:p-4 [&_section]:rounded-2xl [&_.grid]:!grid-cols-1">
                        <VariantPicker
                          axes={axes}
                          selectedOptions={selectedOptions}
                          onOptionSelect={(axisId, valueId) =>
                            setSelectedOptions((prev) => ({ ...prev, [axisId]: valueId }))
                          }
                          childrenItems={children}
                          presentation="pdp"
                          currency={parentItemObj?.currency || "USD"}
                        />
                      </div>
                    )}
                    {modifierGroups.length > 0 && (
                      <div className="space-y-2">
                        {!needsVariant ? null : (
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {t("pos.modifiers.title") || "Add extras"}
                          </h4>
                        )}
                        <ModifierPickerPanel
                          groups={modifierGroups}
                          value={selectedModifiers}
                          onChange={setSelectedModifiers}
                          resolvePrice={(id, price) => price}
                          currency={parentItemObj?.currency || "USD"}
                        />
                      </div>
                    )}
                  </>
                ) : null}

                <div className="space-y-2">
                  <Label>Customer</Label>
                  <PosCustomerSelect
                    leads={leads}
                    leadValue={leadValue}
                    setLeadValue={setLeadValue}
                    siteId={currentSite.id}
                    t={t}
                    clearable={false}
                    placeholder="Select customer..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assignee (Optional)</Label>
                  <Combobox
                    options={members.map((m: any) => ({ value: m.user_id, label: m.name || m.email }))}
                    value={taskAssignee}
                    onValueChange={setTaskAssignee}
                    placeholder="Assign to team member..."
                    emptyMessage="No members found"
                  />
                </div>
                {selectedSlot && !sellableItem ? (
                  <p className="text-sm text-muted-foreground">
                    Selected: {format(new Date(selectedSlot.start), "PPP p")} – {format(new Date(selectedSlot.end), "p")}
                  </p>
                ) : null}
                {sellableItem ? (
                  <div className="space-y-2">
                    <Label>Time slot</Label>
                    <ReservationSlotPicker
                      key={`${sellableItem.id}-${reservation?.id || "new"}-${initialSlot?.start || ""}`}
                      catalogItemId={sellableItem.id}
                      hideDetailsStep
                      ignoreReservationId={reservation?.id}
                      selectedStartIso={selectedSlot?.start}
                      selectedEndIso={selectedSlot?.end}
                      onSelect={(start, end) => setSelectedSlot({ start, end })}
                    />
                    {selectedSlot ? (
                      <p className="text-sm text-muted-foreground">
                        Selected: {format(new Date(selectedSlot.start), "PPP p")} – {format(new Date(selectedSlot.end), "p")}
                      </p>
                    ) : null}
                  </div>
                ) : catalogItemId && needsVariant && !resolvedChild ? (
                  <div className="space-y-2">
                    <Label>Time slot</Label>
                    <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Please select options above to see available times.
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="reservation-notes">Notes</Label>
                  <Textarea
                    id="reservation-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Any special requirements?"
                  />
                </div>
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={
                isSubmitting || 
                (mode === "service" ? (items.length === 0 || !sellableItem || !modifiersValid || !leadValue || !selectedSlot) : false)
              }
            >
              {isSubmitting
                ? isEdit
                  ? t("reservations.dialog.saving") || "Saving..."
                  : t("reservations.dialog.creating") || "Creating..."
                : isEdit
                  ? t("reservations.dialog.save") || "Save changes"
                  : t("reservations.dialog.createTitle") || "Create reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard changes?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
      />
    </>
  )
}
