"use client"

import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { RelationSelect, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { PosCustomerSelect } from "@/app/pos/components/PosCustomerSelect"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { TimeSelect } from "@/app/components/ui/time-select"
import { Combobox } from "@/app/components/ui/combobox"
import { useLocalization } from "@/app/context/LocalizationContext"
import { TASK_TYPES } from "@/app/leads/types"

const TASK_TYPE_OPTIONS = TASK_TYPES.filter((type) =>
  [
    "website_visit",
    "demo",
    "meeting",
    "email",
    "call",
    "quote",
    "contract",
    "payment",
    "referral",
    "feedback",
    "trial",
    "onboarding",
  ].includes(type.id)
)

type CalendarOption = {
  id: string
  name?: string
  label?: string
  duration_minutes?: number
}

export function ReservationTaskFields({
  taskTitle,
  setTaskTitle,
  taskAssignee,
  setTaskAssignee,
  members,
  schedules,
  schedulesLoading,
  taskCalendarValue,
  setTaskCalendarValue,
  taskCalendarSchedule,
  taskDate,
  setTaskDate,
  taskTime,
  setTaskTime,
  leads,
  leadValue,
  setLeadValue,
  siteId,
  t,
  taskType,
  setTaskType,
  notes,
  setNotes,
}: {
  taskTitle: string
  setTaskTitle: (value: string) => void
  taskAssignee: string
  setTaskAssignee: (value: string) => void
  members: { user_id: string; name?: string; email?: string }[]
  schedules: CalendarOption[]
  schedulesLoading: boolean
  taskCalendarValue: RelationSelectValue
  setTaskCalendarValue: (value: RelationSelectValue) => void
  taskCalendarSchedule: CalendarOption | null
  taskDate: Date | undefined
  setTaskDate: (date: Date | undefined) => void
  taskTime: string
  setTaskTime: (value: string) => void
  leads: any[]
  leadValue: RelationSelectValue
  setLeadValue: (value: RelationSelectValue) => void
  siteId: string
  t: (key: string, params?: Record<string, string | number>) => string
  taskType: string
  setTaskType: (value: string) => void
  notes: string
  setNotes: (value: string) => void
}) {
  return (
    <>
      <div className="space-y-2">
        <Label>{t("reservations.task.title") || "Task Title"}</Label>
        <Input
          placeholder={t("reservations.task.titlePlaceholder") || "Enter task name..."}
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("reservations.task.assignee") || "Assignee"}</Label>
        <Combobox
          options={members.map((m) => ({ value: m.user_id, label: m.name || m.email || m.user_id }))}
          value={taskAssignee}
          onValueChange={setTaskAssignee}
          placeholder={t("reservations.task.selectMember") || "Select team member..."}
          emptyMessage={t("reservations.placeholder.noMembers") || "No members found"}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("reservations.task.calendarOptional") || "Calendar (Optional)"}</Label>
        <RelationSelect
          options={schedules.map((schedule) => ({
            id: schedule.id,
            label: schedule.label || schedule.name || t("reservations.task.unnamedCalendar") || "Unnamed Calendar",
          }))}
          value={taskCalendarValue}
          onValueChange={setTaskCalendarValue}
          allowCreate={false}
          placeholder={t("reservations.task.linkCalendar") || "Link to a specific calendar/schedule..."}
          emptyMessage={
            schedulesLoading
              ? t("reservations.task.loadingCalendars") || "Loading calendars..."
              : t("reservations.task.noCalendars") || "No calendars found"
          }
        />
        {taskCalendarSchedule?.duration_minutes ? (
          <p className="text-xs text-muted-foreground">
            {t("reservations.task.durationMins", { minutes: taskCalendarSchedule.duration_minutes }) ||
              `Duration: ${taskCalendarSchedule.duration_minutes} mins`}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("reservations.task.date") || "Date"}</Label>
          <DatePicker
            date={taskDate}
            setDate={setTaskDate as any}
            className="w-full h-11 bg-background border border-input rounded-md hover:bg-accent hover:text-accent-foreground"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("reservations.task.time") || "Time"}</Label>
          <TimeSelect
            value={taskTime}
            onValueChange={setTaskTime}
            step={15}
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("reservations.task.customerOptional") || "Customer (Optional)"}</Label>
        <PosCustomerSelect
          leads={leads}
          leadValue={leadValue}
          setLeadValue={setLeadValue}
          siteId={siteId}
          t={t}
          clearable={true}
          placeholder={t("reservations.placeholder.selectCustomer") || "Select customer..."}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("reservations.task.type") || "Type"}</Label>
        <Select value={taskType} onValueChange={setTaskType}>
          <SelectTrigger>
            <SelectValue placeholder={t("reservations.task.selectType") || "Select type"} />
          </SelectTrigger>
          <SelectContent>
            {TASK_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {t(`reservations.taskType.${type.id}`) || type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("reservations.task.description") || "Description"}</Label>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t("reservations.task.notesPlaceholder") || "Any special requirements or details?"}
        />
      </div>
    </>
  )
}

export function ReservationNoServicesState({ onGoToCatalog }: { onGoToCatalog: () => void }) {
  const { t } = useLocalization()
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{t("reservations.empty.noServices") || "No reservable services"}</p>
      <p className="text-muted-foreground mt-1">
        {t("reservations.empty.noServicesHint") || "Create a reservable service in your catalog first."}
      </p>
      <Button type="button" className="mt-3" onClick={onGoToCatalog}>
        {t("reservations.empty.goToCatalog") || "Go to Catalog"}
      </Button>
    </div>
  )
}
