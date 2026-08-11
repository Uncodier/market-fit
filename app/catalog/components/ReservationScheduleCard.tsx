"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { getScheduleByCatalogItem, upsertReservationSchedule, deleteReservationSchedule } from "@/app/reservations/schedule-actions"
import { ReservationSchedule } from "@/app/types"
import { toast } from "sonner"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { CalendarIcon, ChevronDown, ChevronRight, PlusCircle, Trash2, Plus, Clock } from "@/app/components/ui/icons"
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

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

function ScheduleForm({ 
  schedule, 
  catalogItemId, 
  onSaved, 
  onCancel,
  onDeleted 
}: { 
  schedule: Partial<ReservationSchedule>, 
  catalogItemId: string, 
  onSaved: (s: ReservationSchedule) => void,
  onCancel: () => void,
  onDeleted: () => void
}) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const defaultDays = DAYS.reduce((acc, day) => {
    acc[day] = { enabled: false, timeBlocks: [{ start: "09:00", end: "17:00" }] }
    return acc
  }, {} as any)

  const mappedDays = DAYS.reduce((acc, day) => {
    const loadedDays = schedule.days || {}
    const d = loadedDays[day]
    if (d) {
      if (d.timeBlocks && d.timeBlocks.length > 0) {
        acc[day] = d
      } else if (d.start && d.end) {
        acc[day] = { enabled: d.enabled, timeBlocks: [{ start: d.start, end: d.end }] }
      } else {
        acc[day] = { enabled: d.enabled, timeBlocks: [{ start: "09:00", end: "17:00" }] }
      }
    } else {
      acc[day] = { enabled: false, timeBlocks: [{ start: "09:00", end: "17:00" }] }
    }
    return acc
  }, {} as any)

  const methods = useForm({
    defaultValues: {
      name: schedule.name || "",
      duration_minutes: schedule.duration_minutes || 60,
      capacity: schedule.capacity || 1,
      timezone: schedule.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City",
      days: mappedDays
    }
  })

  const { handleSubmit, control, watch, setValue, formState: { isSubmitting } } = methods
  const [isDeleting, setIsDeleting] = useState(false)

  const onSubmit = async (data: any) => {
    if (!currentSite) return

    const { data: savedData, error } = await upsertReservationSchedule({
      id: schedule?.id,
      name: data.name,
      catalog_item_id: catalogItemId,
      site_id: currentSite.id,
      duration_minutes: parseInt(data.duration_minutes),
      capacity: parseInt(data.capacity),
      timezone: data.timezone,
      days: data.days
    })

    if (error) {
      toast.error(error)
    } else if (savedData) {
      toast.success(t("catalog.schedules.saved") || "Schedule saved")
      onSaved(savedData as ReservationSchedule)
    }
  }

  const handleDelete = async () => {
    if (!schedule.id) {
      onDeleted()
      return
    }
    
    setIsDeleting(true)
    const { error } = await deleteReservationSchedule(schedule.id)
    if (error) {
      toast.error(error)
      setIsDeleting(false)
    } else {
      toast.success(t("catalog.schedules.removed") || "Schedule removed")
      onDeleted()
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
        <div className="space-y-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("catalog.schedules.scheduleName") || "Schedule Name"}</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input placeholder="e.g. Standard" className="bg-background" {...field} />
                )}
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("catalog.schedules.duration") || "Duration"}</Label>
              <div className="flex items-center gap-2">
                <Controller
                  name="duration_minutes"
                  control={control}
                  render={({ field }) => (
                    <Input type="number" min="1" className="bg-background" {...field} />
                  )}
                />
                <span className="text-sm text-muted-foreground w-16">min</span>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("catalog.schedules.capacity") || "Capacity"}</Label>
              <div className="flex items-center gap-2">
                <Controller
                  name="capacity"
                  control={control}
                  render={({ field }) => (
                    <Input type="number" min="1" className="bg-background" {...field} />
                  )}
                />
                <span className="text-sm text-muted-foreground w-16">seats</span>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t("catalog.schedules.timezone") || "Timezone"}</Label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <Input className="bg-background" {...field} />
                )}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium">{t("catalog.schedules.weeklyAvailability") || "Weekly Availability"}</Label>
            <div className="grid gap-0 border dark:border-white/5 border-black/5 rounded-md overflow-hidden bg-muted/10">
              {DAYS.map((day, i) => (
                <div 
                  key={day} 
                  className={`flex flex-col sm:flex-row sm:items-start justify-between p-4 transition-colors ${
                    i !== DAYS.length - 1 ? 'border-b dark:border-white/5 border-black/5' : ''
                  }`}
                >
                  <div className="w-32 flex items-center gap-3 mt-1.5">
                    <Controller
                      name={`days.${day}.enabled`}
                      control={control}
                      render={({ field }) => (
                        <Switch 
                          checked={field.value} 
                          onCheckedChange={field.onChange} 
                        />
                      )}
                    />
                    <span className="capitalize text-sm font-medium">
                      {t(`settings.company.days.${day}`) || day}
                    </span>
                  </div>
                  
                  {watch(`days.${day}.enabled`) ? (
                    <div className="flex flex-1 flex-col gap-2 mt-3 sm:mt-0 items-end sm:items-start">
                      {watch(`days.${day}.timeBlocks`)?.map((_: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <Controller
                            name={`days.${day}.timeBlocks.${index}.start`}
                            control={control}
                            render={({ field }) => (
                              <Input type="time" className="h-9 w-32 bg-background" {...field} />
                            )}
                          />
                          <span className="text-muted-foreground text-sm px-2">{t("catalog.schedules.to") || "to"}</span>
                          <Controller
                            name={`days.${day}.timeBlocks.${index}.end`}
                            control={control}
                            render={({ field }) => (
                              <Input type="time" className="h-9 w-32 bg-background" {...field} />
                            )}
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const currentBlocks = watch(`days.${day}.timeBlocks`) || [];
                              if (currentBlocks.length > 1) {
                                setValue(`days.${day}.timeBlocks`, currentBlocks.filter((_: any, i: number) => i !== index));
                              }
                            }}
                            disabled={(watch(`days.${day}.timeBlocks`) || []).length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 text-muted-foreground w-[292px] justify-start mt-1 bg-background border"
                        onClick={() => {
                          const currentBlocks = watch(`days.${day}.timeBlocks`) || [];
                          setValue(`days.${day}.timeBlocks`, [...currentBlocks, { start: "09:00", end: "17:00" }]);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-2" /> {t("catalog.schedules.addHours") || "Add hours"}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-3 sm:mt-0 px-2 h-9 flex items-center justify-end sm:justify-start w-full sm:w-auto sm:flex-1">
                      {t("catalog.schedules.closed") || "Closed"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ActionFooter className="rounded-b-lg -mx-6 md:-mx-8 border-x-0 border-b-0 mb-0 flex justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("common.remove") || "Remove"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("catalog.schedules.removeScheduleTitle") || "Remove Schedule"}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("catalog.schedules.removeConfirm") ||
                      "Are you sure you want to remove this schedule? This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
                  >
                    {t("catalog.schedules.removeSchedule") || "Remove Schedule"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={isSubmitting || isDeleting}>
                {isSubmitting
                  ? (t("common.saving") || "Saving...")
                  : schedule.id
                    ? (t("catalog.schedules.saveChanges") || "Save Changes")
                    : (t("catalog.schedules.createSchedule") || "Create Schedule")}
              </Button>
            </div>
          </ActionFooter>
        </div>
      </form>
    </FormProvider>
  )
}

export function ReservationScheduleCard({ catalogItemId }: { catalogItemId: string }) {
  const { t } = useLocalization()
  const [schedules, setSchedules] = useState<Partial<ReservationSchedule>[]>([])
  const [expandedSchedules, setExpandedSchedules] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const loadSchedules = async () => {
    setLoading(true)
    const { data } = await getScheduleByCatalogItem(catalogItemId)
    if (data && data.length > 0) {
      setSchedules(data)
    } else {
      setSchedules([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (catalogItemId) {
      loadSchedules()
    }
  }, [catalogItemId])

  const toggleExpansion = useCallback((index: number) => {
    const newExpanded = new Set(expandedSchedules)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSchedules(newExpanded)
  }, [expandedSchedules])

  const addSchedule = () => {
    const newSchedules = [{ name: "" }, ...schedules]
    setSchedules(newSchedules)
    setExpandedSchedules(new Set([0, ...Array.from(expandedSchedules).map(i => i + 1)]))
  }

  const handleSaved = (index: number, savedData: ReservationSchedule) => {
    const newSchedules = [...schedules]
    newSchedules[index] = savedData
    setSchedules(newSchedules)
    
    // Collapse after saving
    const newExpanded = new Set(expandedSchedules)
    newExpanded.delete(index)
    setExpandedSchedules(newExpanded)
  }

  const handleDeleted = (index: number) => {
    const newSchedules = schedules.filter((_, i) => i !== index)
    setSchedules(newSchedules)
    
    const newExpanded = new Set<number>()
    expandedSchedules.forEach(expIndex => {
      if (expIndex < index) newExpanded.add(expIndex)
      else if (expIndex > index) newExpanded.add(expIndex - 1)
    })
    setExpandedSchedules(newExpanded)
  }

  if (loading) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("catalog.schedules.title") || "Schedules"}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("catalog.schedules.description") || "Configure reservation schedules and availability slots."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSchedule}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("catalog.schedules.addSchedule") || "Add Schedule"}
        </Button>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-10 bg-muted/20 border rounded-lg border-dashed">
          <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
          <p className="text-muted-foreground text-sm font-medium">{t("catalog.schedules.noSchedules") || "No schedules configured"}</p>
          <p className="text-muted-foreground text-xs mt-1">
            {t("catalog.schedules.emptyHint") || "Add a schedule to define when this item can be booked."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={addSchedule}>
            <PlusCircle className="mr-2 h-4 w-4" /> {t("catalog.schedules.addSchedule") || "Add Schedule"}
          </Button>
        </div>
      ) : (
        schedules.map((schedule, index) => {
          const isExpanded = expandedSchedules.has(index)
          const activeDays = schedule.days ? Object.values(schedule.days).filter((d: any) => d.enabled).length : 0

          return (
            <Card key={schedule.id || index} className="border dark:border-white/5 border-black/5 shadow-sm overflow-hidden">
              <CardHeader 
                className="px-6 md:px-8 py-6 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpansion(index)}
              >
                <div className="flex flex-col gap-1 w-full md:flex-row md:items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                      {schedule.name || t("catalog.schedules.newSchedule") || "New Schedule"}
                    </CardTitle>
                    {schedule.id ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-2 md:mt-1">
                        <span>{t("catalog.schedules.daysActive", { count: activeDays }) || `${activeDays} days active`}</span>
                        <span>•</span>
                        <span>{t("catalog.schedules.minSlots", { count: schedule.duration_minutes || 60 }) || `${schedule.duration_minutes || 60} min slots`}</span>
                        <span>•</span>
                        <span>{t("catalog.schedules.capacityLabel", { count: schedule.capacity || 1 }) || `Capacity: ${schedule.capacity || 1}`}</span>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground mt-2 md:mt-1">
                        {t("catalog.schedules.notSavedYet") || "Not saved yet. Expand to configure."}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="px-6 md:px-8 pb-0 pt-6 border-t">
                  <ScheduleForm 
                    schedule={schedule} 
                    catalogItemId={catalogItemId}
                    onSaved={(s) => handleSaved(index, s)}
                    onCancel={() => toggleExpansion(index)}
                    onDeleted={() => handleDeleted(index)}
                  />
                </CardContent>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
