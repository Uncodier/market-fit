"use client"

import { useEffect, useState, useMemo } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createClient } from "@/lib/supabase/client"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import { resolveVariantAxesForDisplay } from "@/app/catalog/variant-resolve"
import type { Reservation, CatalogItem, VariantAxis } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { reservationCanCancel, reservationCanRegisterPayment } from "../reservation-helpers"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { filterReservablePickerItems } from "@/app/catalog/storefront-availability"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { isModifierSelectionValid } from "@/app/components/commerce/ModifierPickerPanel"
import { submitServiceReservationForm, submitTeamTaskReservation, cancelReservationFromDialog } from "./reservation-dialog-submit"
import {
  buildCombinedCalendars,
  hydrateReservationForm,
  isReservationDialogDirty,
  resolveSellableChild,
} from "./reservation-dialog-hydrate"
import {
  ReservationDialogFormSkeleton,
  ReservationServiceFields,
} from "./reservation-dialog-service-fields"
import {
  ReservationNoServicesState,
  ReservationTaskFields,
} from "./reservation-dialog-task-fields"
import { ReservationDialogFooter } from "./reservation-dialog-footer"

interface CreateReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  reservation?: Reservation | null
  initialSlot?: { start: string; end: string } | null
  onRegisterPayment?: (reservation: Reservation) => void
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  onSuccess,
  reservation,
  initialSlot,
  onRegisterPayment,
}: CreateReservationDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const isEdit = Boolean(reservation)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const canCancel = Boolean(reservation && reservationCanCancel(reservation))
  const canRegisterPayment = Boolean(
    reservation && onRegisterPayment && reservationCanRegisterPayment(reservation),
  )
  const isBusy = isSubmitting || isCancelling
  const [catalogItemValue, setCatalogItemValue] = useState<RelationSelectValue>(null)
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string; timezone?: string } | null>(null)
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
      const { data, error } = await supabase.from("profiles").select("id, name, settings").in("id", memberIds)
      if (error) throw error
      return data
    }
  )

  const combinedCalendars = useMemo(
    () =>
      buildCombinedCalendars({
        siteCalendars: currentSite?.settings?.calendars,
        profileCalendarsData,
      }),
    [currentSite?.settings?.calendars, profileCalendarsData],
  )

  const leads = leadsData?.leads || []
  const members = membersData?.members || []
  const items = useMemo(
    () => filterReservablePickerItems(catalogData?.data || [], reservation?.catalog_item_id),
    [catalogData?.data, reservation?.catalog_item_id],
  )
  const schedules = combinedCalendars
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
      const next = hydrateReservationForm(reservation)
      setMode(next.mode)
      setTaskTitle(next.taskTitle)
      setTaskAssignee(next.taskAssignee)
      setTaskType(next.taskType)
      setNotes(next.notes)
      setTaskCalendarValue(next.taskCalendarValue)
      setTaskDate(next.taskDate)
      setTaskTime(next.taskTime)
      setLeadValue(next.leadValue)
      setCatalogItemValue(next.catalogItemValue)
      setSelectedSlot(next.selectedSlot)
      return
    }
    resetForm()
    if (!catalogLoading && items.length === 0) setMode("task")
    if (initialSlot) {
      setSelectedSlot(initialSlot)
      const dt = new Date(initialSlot.start)
      setTaskDate(dt)
      setTaskTime(dt.toTimeString().slice(0, 5))
    }
  }, [open, reservation, initialSlot, items.length, catalogLoading])

  useEffect(() => {
    if (!catalogItemId || !currentSite) return
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
          const resolved = resolveVariantAxesForDisplay(parentItem, data as CatalogItem[])
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

  const resolvedChild = useMemo(
    () => resolveSellableChild(axes.length, selectedOptions, children),
    [selectedOptions, axes.length, children],
  )

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
  const taskCalendarId = taskCalendarValue?.mode === "existing" ? taskCalendarValue.id : ""
  const taskCalendarSchedule = useMemo(
    () => schedules.find((s: any) => s.id === taskCalendarId) || null,
    [schedules, taskCalendarId],
  )

  const dirty = isReservationDialogDirty({
    isEdit,
    mode,
    reservation,
    taskTitle,
    taskAssignee,
    notes,
    leadId: leadValue?.mode === "existing" ? leadValue.id : "",
    catalogItemId,
    selectedSlot,
    taskDate,
    catalogItemValue,
    leadValue,
  })

  const { discardOpen, setDiscardOpen, handleOpenChange, confirmDiscard } =
    useDirtyDialogClose({
      dirty,
      busy: isBusy,
      onOpenChange: (next) => {
        if (!next) {
          resetForm()
          setCancelConfirmOpen(false)
        }
        onOpenChange(next)
      },
    })

  const handleCancelReservation = async () => {
    if (!currentSite || !reservation || !reservationCanCancel(reservation)) return
    setIsCancelling(true)
    try {
      await cancelReservationFromDialog({ siteId: currentSite.id, reservation, t })
      resetForm()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || t("reservations.toast.cancelFailed") || "Failed to cancel reservation")
      throw error
    } finally {
      setIsCancelling(false)
    }
  }

  const handleSubmit = async () => {
    if (!currentSite) return
    setIsSubmitting(true)
    try {
      if (mode === "task") {
        if (!taskDate || !taskTime) {
          toast.error(t("reservations.toast.selectDateTime") || "Select a date and time")
          setIsSubmitting(false)
          return
        }
        const taskResult = await submitTeamTaskReservation({
          siteId: currentSite.id,
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
        })
        if (taskResult.error) {
          setIsSubmitting(false)
          return
        }
        resetForm()
        onSuccess()
        onOpenChange(false)
        return
      }

      if (!selectedSlot || !sellableItem) {
        toast.error(t("reservations.toast.selectTimeSlot") || "Select a time slot")
        setIsSubmitting(false)
        return
      }
      const serviceResult = await submitServiceReservationForm({
        siteId: currentSite.id,
        isEdit,
        reservation,
        sellableItem,
        parentItem: parentItemObj,
        leadValue,
        selectedSlot,
        taskAssignee,
        notes,
        selectedModifiers,
        t,
      })
      if (serviceResult.error) {
        setIsSubmitting(false)
        return
      }
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
        <DialogContent size="lg" busy={isBusy}>
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? (reservation?.is_task ? t("reservations.task.editTitle") || "Edit Task" : t("reservations.dialog.editTitle") || "Edit reservation")
                : t("reservations.dialog.createTitle") || "Create reservation"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? (reservation?.is_task ? t("reservations.task.editDescription") || "Update the task details." : t("reservations.dialog.editDescription") || "Update the service, customer, time slot, or notes.")
                : t("reservations.dialog.createDescription") || "Book a reservable service for a customer."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {!isEdit && (
              <div className="flex justify-center mb-4">
                <Tabs value={mode} onValueChange={(val) => setMode(val as "service" | "task")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="service" disabled={items.length === 0 && !catalogLoading}>{t("reservations.mode.service") || "Service"}</TabsTrigger>
                    <TabsTrigger value="task">{t("reservations.mode.task") || "Team Task"}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {mode === "task" ? (
              <ReservationTaskFields
                taskTitle={taskTitle}
                setTaskTitle={setTaskTitle}
                taskAssignee={taskAssignee}
                setTaskAssignee={setTaskAssignee}
                members={members}
                schedules={schedules}
                schedulesLoading={profilesLoading}
                taskCalendarValue={taskCalendarValue}
                setTaskCalendarValue={setTaskCalendarValue}
                taskCalendarSchedule={taskCalendarSchedule}
                taskDate={taskDate}
                setTaskDate={setTaskDate}
                taskTime={taskTime}
                setTaskTime={setTaskTime}
                leads={leads}
                leadValue={leadValue}
                setLeadValue={setLeadValue}
                siteId={currentSite!.id}
                t={t}
                taskType={taskType}
                setTaskType={setTaskType}
                notes={notes}
                setNotes={setNotes}
              />
            ) : catalogLoading ? (
              <ReservationDialogFormSkeleton />
            ) : mode === "service" && items.length === 0 ? (
              <ReservationNoServicesState
                onGoToCatalog={() => {
                  handleOpenChange(false)
                  router.push("/catalog")
                }}
              />
            ) : (
              <ReservationServiceFields
                items={items}
                catalogItemValue={catalogItemValue}
                setCatalogItemValue={setCatalogItemValue}
                catalogItemId={catalogItemId}
                loadingVariants={loadingVariants}
                loadingModifiers={loadingModifiers}
                needsVariant={needsVariant}
                modifierGroups={modifierGroups}
                axes={axes}
                selectedOptions={selectedOptions}
                setSelectedOptions={setSelectedOptions}
                children={children}
                parentItemObj={parentItemObj}
                selectedModifiers={selectedModifiers}
                setSelectedModifiers={setSelectedModifiers}
                t={t}
                leads={leads}
                leadValue={leadValue}
                setLeadValue={setLeadValue}
                siteId={currentSite!.id}
                members={members}
                taskAssignee={taskAssignee}
                setTaskAssignee={setTaskAssignee}
                selectedSlot={selectedSlot}
                setSelectedSlot={setSelectedSlot}
                sellableItem={sellableItem}
                resolvedChild={resolvedChild}
                reservationId={reservation?.id}
                initialSlotStart={initialSlot?.start}
                notes={notes}
                setNotes={setNotes}
                siteCurrency={currentSite?.settings?.currency}
              />
            )}
          </DialogBody>

          <ReservationDialogFooter
            canCancel={canCancel}
            canRegisterPayment={canRegisterPayment}
            onCancelReservation={() => setCancelConfirmOpen(true)}
            onRegisterPayment={
              canRegisterPayment && reservation
                ? () => onRegisterPayment?.(reservation)
                : undefined
            }
            onClose={() => handleOpenChange(false)}
            onSubmit={() => void handleSubmit()}
            isBusy={isBusy}
            isSubmitting={isSubmitting}
            isEdit={isEdit}
            serviceDisabled={
              mode === "service"
                ? items.length === 0 || !sellableItem || !modifiersValid || !leadValue || !selectedSlot
                : false
            }
            t={t}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t("reservations.dialog.discardTitle") || "Discard changes?"}
        description={t("reservations.dialog.discardDescription") || "Your changes will be lost."}
        confirmLabel={t("reservations.dialog.discard") || "Discard"}
        variant="destructive"
        onConfirm={confirmDiscard}
        dataPermission="allow"
      />
      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title={t("reservations.dialog.cancelConfirmTitle") || "Cancel this reservation?"}
        description={t("reservations.dialog.cancelConfirmDescription") || "The time slot will become available again."}
        confirmLabel={t("reservations.dialog.cancelReservation") || "Cancel reservation"}
        variant="destructive"
        loading={isCancelling}
        onConfirm={handleCancelReservation}
        dataPermission="allow"
      />
    </>
  )
}
