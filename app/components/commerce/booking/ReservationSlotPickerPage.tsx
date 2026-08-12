"use client"

import { format, addMonths, subMonths, startOfMonth, isSameMonth, isSameDay, isBefore, startOfDay } from "date-fns"
import type { Locale } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { CalendarIcon, Clock, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ReservationSlotPickerPageProps {
  dateLocale: Locale
  t: (key: string) => string
  locale: string
  currentMonth: Date
  setCurrentMonth: (date: Date) => void
  selectedDate: Date | null
  setSelectedDate: (date: Date | null) => void
  setSelectedSlot: (slot: { start: string; end: string } | null) => void
  setActiveStep: (step: "calendar" | "time" | "details") => void
  activeStep: "calendar" | "time" | "details"
  calendarDays: Date[]
  monthAvailability: Record<string, boolean>
  isLoadingSlots: boolean
  slotsForSelectedDate: { start: string; end: string; available: number }[]
  selectedSlot: { start: string; end: string } | null
  hideDetailsStep: boolean
  onSelect: (startIso: string, endIso: string, additionalData?: any) => void
  handleConfirm: () => void
  name: string
  setName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  guestsString: string
  setGuestsString: (v: string) => void
  notes: string
  setNotes: (v: string) => void
}

export function ReservationSlotPickerPage({
  dateLocale,
  t,
  locale,
  currentMonth,
  setCurrentMonth,
  selectedDate,
  setSelectedDate,
  setSelectedSlot,
  setActiveStep,
  activeStep,
  calendarDays,
  monthAvailability,
  isLoadingSlots,
  slotsForSelectedDate,
  selectedSlot,
  hideDetailsStep,
  onSelect,
  handleConfirm,
  name,
  setName,
  email,
  setEmail,
  guestsString,
  setGuestsString,
  notes,
  setNotes,
}: ReservationSlotPickerPageProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-stretch gap-8 lg:gap-12 w-full mt-4">
      <div className="w-full md:w-[350px] lg:w-[400px] shrink-0 flex">
        <div className="bg-card border rounded-3xl p-6 shadow-sm w-full h-full">
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-accent hover:text-accent-foreground"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              disabled={isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h3 className="font-semibold text-xl text-center flex-1">
              {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-accent hover:text-accent-foreground"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-4">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
              <div key={idx} className="text-sm font-bold text-muted-foreground uppercase py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-3 gap-x-2 mt-4">
            {isLoadingSlots && Object.keys(monthAvailability).length === 0 ? (
              Array.from({ length: 42 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-12 mx-auto rounded-full" />
              ))
            ) : (
              calendarDays.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd")
                const isSelected = selectedDate && isSameDay(date, selectedDate)
                const isToday = isSameDay(date, new Date())
                const isPast = isBefore(startOfDay(date), startOfDay(new Date()))
                const isCurrentMonth = isSameMonth(date, currentMonth)
                const isAvailable = monthAvailability[dateStr] ?? false
                const shouldDisable = isPast || !isAvailable

                return (
                  <button
                    key={date.toISOString()}
                    disabled={shouldDisable}
                    onClick={() => {
                      if (!isCurrentMonth) setCurrentMonth(startOfMonth(date))
                      setSelectedDate(date)
                      setSelectedSlot(null)
                      setActiveStep("time")
                    }}
                    className={cn(
                      "h-12 w-12 mx-auto rounded-full flex items-center justify-center text-base transition-all duration-200",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-md transform scale-110"
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
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-card border rounded-3xl p-6 shadow-sm flex-1 flex flex-col h-full">
          {!selectedDate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
              <CalendarIcon className="h-16 w-16 mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium">{t("booking.selectDate") || "Select a date"}</h3>
              <p className="text-sm mt-2">
                {t("booking.selectDateDesc") || "Choose a date from the calendar to see available times."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6 border-b pb-4">
                <h3 className="font-semibold text-xl">
                  {format(selectedDate, "eeee, MMMM d, yyyy", { locale: dateLocale })}
                </h3>
              </div>

              {activeStep === "time" || hideDetailsStep ? (
                <div className="flex-1">
                  {isLoadingSlots ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="h-14 w-full rounded-xl bg-accent/50 flex items-center justify-center">
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : slotsForSelectedDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <EmptyCard icon={<Clock />} title={t("booking.noAvailability")} description="" showShadow={false} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {slotsForSelectedDate.map((slot) => {
                        const isSelected = selectedSlot?.start === slot.start
                        return (
                          <Button
                            key={slot.start}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                              "w-full justify-center font-medium transition-all h-14 text-base rounded-xl",
                              isSelected ? "shadow-md" : "hover:border-primary/40 hover:bg-accent/50 border-border/60"
                            )}
                            onClick={() => {
                              if (hideDetailsStep) onSelect(slot.start, slot.end, {})
                              else {
                                setSelectedSlot(slot)
                                setActiveStep("details")
                              }
                            }}
                          >
                            {format(new Date(slot.start), "h:mm a")}
                            <span className="text-xs opacity-70 ml-2 block">({slot.available} left)</span>
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-4 mb-6 bg-muted/30 p-4 rounded-2xl">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full hover:bg-background"
                      onClick={() => setActiveStep("time")}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t("booking.changeTime") || "Change Time"}
                    </Button>
                    <div className="font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      {selectedSlot && format(new Date(selectedSlot.start), "h:mm a")}
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="name" className="text-sm font-semibold">{t("booking.form.name") || "Name"}</Label>
                        <Input id="name" placeholder="John Doe" className="h-12 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email" className="text-sm font-semibold">{t("booking.form.email") || "Email"}</Label>
                        <Input id="email" type="email" placeholder="john@example.com" className="h-12 rounded-xl" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="guests" className="text-sm font-semibold">
                        {locale === "es" ? "Invitados (separados por coma)" : "Guests (comma separated)"}
                      </Label>
                      <Input
                        id="guests"
                        placeholder={locale === "es" ? "correo1@ejemplo.com" : "guest1@example.com"}
                        className="h-12 rounded-xl"
                        value={guestsString}
                        onChange={(e) => setGuestsString(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes" className="text-sm font-semibold">{t("booking.form.notes") || "Additional Notes"}</Label>
                      <Textarea
                        id="notes"
                        placeholder={t("booking.form.notesPlaceholder") || "Any special requirements?"}
                        className="resize-none min-h-[120px] rounded-xl"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-8 mt-auto">
                    <Button
                      onClick={handleConfirm}
                      className="w-full sm:w-auto px-10 h-12 text-base font-bold rounded-xl shadow-md"
                      disabled={!selectedSlot}
                    >
                      {t("booking.confirm") || "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
