"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
  isBefore,
  startOfDay,
} from "date-fns"
import { getReservationSlotsLocalFirst } from "@/app/pos/local/reservation-slots"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Clock, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { es, enUS } from "date-fns/locale"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { ReservationSlotPickerPage } from "./booking/ReservationSlotPickerPage"
import {
  findSlotByInstant,
  isSameSlotInstant,
  mergeCurrentReservationSlot,
  shouldShowSlotLeftover,
  slotCalendarDate,
  formatSlotTime,
  calendarDateFromIso,
  formatSlotTimeZoneName,
  type ReservationSlotOption,
  type SlotTimeDisplay,
} from "./reservation-slot-utils"

interface ReservationSlotPickerProps {
  catalogItemId: string
  quantity?: number
  onSelect: (startIso: string, endIso: string, additionalData?: any) => void
  selectedStartIso?: string
  selectedEndIso?: string
  ignoreReservationId?: string
  hideDetailsStep?: boolean
  layout?: "dialog" | "page"
  /** system = browser clock (reservations/POS). venue = schedule TZ + label (book/PDP). */
  timeDisplay?: SlotTimeDisplay
}

export function ReservationSlotPicker({
  catalogItemId,
  quantity = 1,
  onSelect,
  selectedStartIso,
  selectedEndIso,
  ignoreReservationId,
  hideDetailsStep = false,
  layout = "dialog",
  timeDisplay,
}: ReservationSlotPickerProps) {
  const display: SlotTimeDisplay = timeDisplay ?? (layout === "page" ? "venue" : "system")
  const { locale, t } = useLocalization()
  const dateLocale = locale === "es" ? es : enUS
  const { user } = useAuth()
  const session = user ? { user } : null

  const [activeStep, setActiveStep] = useState<"calendar" | "time" | "details">("calendar")
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  
  const [allSlots, setAllSlots] = useState<ReservationSlotOption[]>([])
  const [monthAvailability, setMonthAvailability] = useState<Record<string, boolean>>({})
  const [isLoadingSlots, setIsLoadingSlots] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<{start: string, end: string, available?: number} | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [guestsString, setGuestsString] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (session?.user && !email) {
      setEmail(session.user.email || "")
      setName(session.user.user_metadata?.name || "")
    }
  }, [session, email])

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedStartIso) return
    const date = calendarDateFromIso(selectedStartIso, undefined, display)
    setCurrentMonth(startOfMonth(date))
    setSelectedDate(date)
    setActiveStep("time")
  }, [selectedStartIso, catalogItemId, display])

  useEffect(() => {
    async function loadMonthAvailability() {
      setIsLoadingSlots(true)
      const firstDayOfMonth = startOfMonth(currentMonth).getDay()
      const startDate = addDays(startOfMonth(currentMonth), -firstDayOfMonth)
      const startStr = format(startDate, "yyyy-MM-dd")
      const endStr = format(addDays(startDate, 41), "yyyy-MM-dd")
      
      const { slots: available } = await getReservationSlotsLocalFirst({
        catalogItemId,
        startDate: startStr,
        endDate: endStr,
        qty: quantity,
        ignoreReservationId,
      })

      const slots = mergeCurrentReservationSlot(available, selectedStartIso, selectedEndIso)

      setAllSlots(slots)
      
      const availMap: Record<string, boolean> = {}
      slots.forEach(slot => {
        availMap[slotCalendarDate(slot.start, slot.timezone, display)] = true
      })
      if (selectedStartIso) {
        const match = findSlotByInstant(slots, selectedStartIso)
        availMap[slotCalendarDate(selectedStartIso, match?.timezone, display)] = true
        if (match) setSelectedSlot(match)
      }
      setMonthAvailability(availMap)
      setIsLoadingSlots(false)
    }
    
    if (catalogItemId) {
      loadMonthAvailability()
    }
  }, [catalogItemId, currentMonth, quantity, ignoreReservationId, selectedStartIso, selectedEndIso, display])

  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const startDate = addDays(startOfMonth(currentMonth), -firstDayOfMonth)
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 41),
  })

  // get slots for selected date
  const slotsForSelectedDate = selectedDate ? allSlots.filter(s => {
    return slotCalendarDate(s.start, s.timezone, display) === format(selectedDate, "yyyy-MM-dd")
  }) : []

  const handleConfirm = () => {
    if (selectedSlot) {
      onSelect(selectedSlot.start, selectedSlot.end, {
        name,
        email,
        guests: guestsString,
        notes,
        available: selectedSlot.available,
        timezone: selectedSlot.timezone,
      })
    }
  }

  return (
    <div className={cn("relative w-full", layout === "page" ? "pb-8" : "")} ref={containerRef}>
      {layout === "dialog" ? (
      <div>
        {activeStep === "calendar" ? (
          <div className="p-1">
            <div className="flex items-center justify-between mb-6 px-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                disabled={isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-lg text-center flex-1">
                {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                <div key={idx} className="text-[11px] font-bold text-muted-foreground uppercase py-2">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-2 gap-x-1 mt-4">
              {isLoadingSlots && Object.keys(monthAvailability).length === 0 ? (
                Array.from({ length: 42 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-10 mx-auto rounded-full" />
                ))
              ) : (
                calendarDays.map((date) => {
                  const dateStr = format(date, "yyyy-MM-dd")
                  const isSelected = selectedDate && isSameDay(date, selectedDate)
                  const isToday = isSameDay(date, new Date())
                  const isPast = isBefore(startOfDay(date), startOfDay(new Date()))
                  const isCurrentMonth = isSameMonth(date, currentMonth)
                  const isAvailable = monthAvailability[dateStr] ?? false
                  const isCurrentReservationDate = Boolean(
                    selectedStartIso && slotCalendarDate(selectedStartIso, undefined, display) === dateStr
                  )
                  const shouldDisable = (isPast || !isAvailable) && !isCurrentReservationDate

                  return (
                    <button
                      key={date.toISOString()}
                      disabled={shouldDisable}
                      onClick={() => {
                        if (!isCurrentMonth) {
                          setCurrentMonth(startOfMonth(date))
                        }
                        setSelectedDate(date)
                        setSelectedSlot(null)
                        setActiveStep("time")
                      }}
                      className={cn(
                        "h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : "hover:bg-accent hover:text-accent-foreground",
                        isToday && !isSelected && "text-primary font-bold bg-primary/5",
                        !shouldDisable && !isSelected && !isToday && isCurrentMonth && "font-semibold text-foreground bg-accent/20",
                        !shouldDisable && !isSelected && !isToday && !isCurrentMonth && "font-medium text-muted-foreground bg-transparent",
                        shouldDisable && "opacity-30 cursor-not-allowed hover:bg-transparent font-normal"
                      )}
                    >
                      {format(date, "d")}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        {activeStep === "time" ? (
          <div className="p-1">
            <div className="flex items-center justify-between mb-6 px-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                onClick={() => setActiveStep("calendar")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-semibold text-center text-lg flex-1">
                {selectedDate && format(selectedDate, "eeee, MMMM d", { locale: dateLocale })}
              </h3>
            </div>
            {display === "venue" ? (
              <p className="text-xs text-muted-foreground text-center mb-3">
                {t("booking.timesInTimezone", {
                  timezone: formatSlotTimeZoneName(slotsForSelectedDate[0]?.timezone || allSlots[0]?.timezone),
                }) || `Times shown in ${formatSlotTimeZoneName(slotsForSelectedDate[0]?.timezone || allSlots[0]?.timezone)}`}
              </p>
            ) : null}

            <div className="space-y-3">
              {isLoadingSlots ? (
                <div className="grid grid-cols-1 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : slotsForSelectedDate.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <EmptyCard icon={<Clock />} title={t("booking.noAvailability")} description="" showShadow={false} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {slotsForSelectedDate.map((slot) => {
                    const isSelected = isSameSlotInstant(selectedSlot?.start, slot.start)
                    return (
                      <Button
                        key={slot.start}
                        variant="outline"
                        className={cn(
                          "w-full justify-center font-medium transition-all h-12",
                          isSelected
                            ? "ring-primary bg-primary/5 text-primary"
                            : "hover:border-primary/30 hover:bg-accent"
                        )}
                        onClick={() => {
                          setSelectedSlot(slot)
                          if (hideDetailsStep) {
                            onSelect(slot.start, slot.end, {
                              available: slot.available,
                              timezone: slot.timezone,
                            })
                          } else {
                            setActiveStep("details")
                          }
                        }}
                      >
                        {formatSlotTime(slot.start, slot.timezone, display)}
                        {shouldShowSlotLeftover(slot, selectedStartIso) ? (
                          <span className="text-xs opacity-70 ml-2">({slot.available} left)</span>
                        ) : null}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeStep === "details" ? (
          <div className="p-1">
            <div className="flex items-center justify-start mb-4 px-1">
              <Button
                variant="ghost"
                className="h-8 hover:bg-accent hover:text-accent-foreground text-muted-foreground pl-0"
                onClick={() => setActiveStep("time")}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("booking.back")}
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm font-semibold">{t("booking.form.name") || "Name"}</Label>
                <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-semibold">{t("booking.form.email") || "Email"}</Label>
                <Input id="email" type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="guests" className="text-sm font-semibold">{locale === "es" ? "Invitados (separados por coma)" : "Guests (comma separated)"}</Label>
                <Input id="guests" placeholder={locale === "es" ? "correo1@ejemplo.com" : "guest1@example.com"} value={guestsString} onChange={(e) => setGuestsString(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes" className="text-sm font-semibold">{t("booking.form.notes") || "Additional Notes"}</Label>
                <Textarea id="notes" placeholder={t("booking.form.notesPlaceholder") || "Any special requirements?"} className="resize-none min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="pt-4 border-t mt-4">
              <Button onClick={handleConfirm} className="w-full font-semibold shadow-sm" disabled={!selectedSlot}>
                {t("booking.confirm") || "Confirm"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      ) : (
        <ReservationSlotPickerPage
          dateLocale={dateLocale}
          t={t}
          locale={locale}
          currentMonth={currentMonth}
          setCurrentMonth={setCurrentMonth}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          setSelectedSlot={setSelectedSlot}
          setActiveStep={setActiveStep}
          activeStep={activeStep}
          calendarDays={calendarDays}
          monthAvailability={monthAvailability}
          isLoadingSlots={isLoadingSlots}
          slotsForSelectedDate={slotsForSelectedDate}
          selectedStartIso={selectedStartIso}
          selectedSlot={selectedSlot}
          hideDetailsStep={hideDetailsStep}
          onSelect={onSelect}
          handleConfirm={handleConfirm}
          name={name}
          setName={setName}
          email={email}
          setEmail={setEmail}
          guestsString={guestsString}
          setGuestsString={setGuestsString}
          notes={notes}
          setNotes={setNotes}
          timeDisplay={display}
        />
      )}
    </div>
  )
}
