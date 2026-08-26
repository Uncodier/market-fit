"use client"

import {
  format,
  addMonths,
  subMonths,
  addDays,
  startOfMonth,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
} from "date-fns"
import type { Locale } from "date-fns"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Clock, ChevronLeft, ChevronRight } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Card, CardContent } from "@/app/components/ui/card"
import { cn } from "@/lib/utils"
import { isSameSlotInstant, shouldShowSlotLeftover } from "../reservation-slot-utils"

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
  selectedStartIso?: string
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

const cardSurface =
  "bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full"

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
  selectedStartIso,
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
    <div className="relative w-full overflow-visible z-0">
      <style>{`
        @media (min-width: 768px) {
          .card-calendar {
            transform: var(--cal-transform);
            opacity: var(--cal-opacity) !important;
            z-index: var(--cal-z);
            position: absolute;
            left: 0;
            top: 0;
          }
          .card-calendar:hover {
            opacity: var(--cal-opacity-hover, var(--cal-opacity)) !important;
          }
          .card-time {
            transform: var(--time-transform);
            opacity: var(--time-opacity) !important;
            z-index: var(--time-z);
            position: absolute;
            left: 0;
            top: 0;
          }
          .card-time:hover {
            opacity: var(--time-opacity-hover, var(--time-opacity)) !important;
          }
          .card-details {
            transform: var(--det-transform);
            opacity: var(--det-opacity) !important;
            z-index: var(--det-z);
            position: absolute;
            left: 0;
            top: 0;
          }
          .card-details:hover {
            opacity: var(--det-opacity-hover, var(--det-opacity)) !important;
          }
        }
      `}</style>
      <div
        className="flex flex-col md:block gap-6 md:gap-0 pb-4 md:pb-0 relative w-full md:h-[590px] overflow-hidden md:overflow-visible"
        style={{
          "--cal-transform": activeStep === "calendar" ? "translateX(0) scale(1)" : activeStep === "time" ? "translateX(calc(-100% - 360px)) scale(0.95)" : "translateX(calc(-100% - 640px)) scale(0.9)",
          "--cal-opacity": activeStep === "calendar" ? "1" : "0.3",
          "--cal-opacity-hover": "1",
          "--cal-z": activeStep === "calendar" ? "40" : activeStep === "time" ? "30" : "20",

          "--time-transform": activeStep === "calendar" ? "translateX(calc(100% + 2rem)) scale(0.95)" : activeStep === "time" ? "translateX(0) scale(1)" : "translateX(calc(-100% - 360px)) scale(0.95)",
          "--time-opacity": activeStep === "calendar" ? "0.2" : activeStep === "time" ? "1" : "0.3",
          "--time-opacity-hover": "1",
          "--time-z": activeStep === "calendar" ? "30" : activeStep === "time" ? "40" : "30",

          "--det-transform": activeStep === "calendar" ? "translateX(calc(200% + 4rem)) scale(0.9)" : activeStep === "time" ? "translateX(calc(100% + 2rem)) scale(0.95)" : "translateX(0) scale(1)",
          "--det-opacity": activeStep === "calendar" ? "0" : activeStep === "time" ? "0.2" : "1",
          "--det-opacity-hover": "1",
          "--det-z": activeStep === "calendar" ? "20" : activeStep === "time" ? "30" : "40",
        } as React.CSSProperties}
      >
        <Card
          className={cn(
            "card-calendar",
            cardSurface,
            activeStep !== "calendar" && "md:opacity-60 hover:md:opacity-100"
          )}
        >
          {activeStep !== "calendar" && (
            <div
              className="absolute inset-0 z-50 cursor-pointer hidden md:block"
              onClick={() => setActiveStep("calendar")}
            />
          )}
          <CardContent className="p-6 flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col animate-in fade-in duration-300 w-full">
              <div className="flex items-center justify-between mb-6 px-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20"
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
                  className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20"
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

              <div className="grid grid-cols-7 gap-y-5 md:gap-y-6 gap-x-1 mt-4">
                {isLoadingSlots && Object.keys(monthAvailability).length === 0 ? (
                  Array.from({ length: 42 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-11 sm:h-12 sm:w-12 mx-auto rounded-full" />
                  ))
                ) : (
                  calendarDays.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd")
                    const isSelected = selectedDate && isSameDay(date, selectedDate)
                    const isToday = isSameDay(date, new Date())
                    const isPast = isBefore(startOfDay(date), startOfDay(new Date()))
                    const isCurrentMonth = isSameMonth(date, currentMonth)
                    const isAvailable = monthAvailability[dateStr] ?? false
                    const hasLoadedAvailability = Object.keys(monthAvailability).length > 0
                    const shouldDisable = isPast || (hasLoadedAvailability && !isAvailable)

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
                          "h-11 w-11 sm:h-12 sm:w-12 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200 relative z-20",
                          isSelected
                            ? "bg-primary text-primary-foreground font-bold shadow-sm"
                            : "hover:bg-accent hover:text-accent-foreground",
                          isToday && !isSelected && "text-primary font-bold bg-primary/5",
                          !shouldDisable && !isSelected && !isToday && isCurrentMonth && "font-semibold text-foreground bg-accent/20",
                          !shouldDisable && !isSelected && !isToday && !isCurrentMonth && "font-medium text-muted-foreground bg-transparent",
                          shouldDisable && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-inherit font-normal bg-transparent"
                        )}
                      >
                        {format(date, "d")}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "card-time",
            cardSurface,
            activeStep !== "time" && "md:opacity-60 hover:md:opacity-100",
            !selectedDate && "pointer-events-none opacity-50"
          )}
        >
          {activeStep !== "time" && selectedDate && (
            <div
              className="absolute inset-0 z-50 cursor-pointer hidden md:block"
              onClick={() => setActiveStep("time")}
            />
          )}
          <CardContent className="p-6 flex-1 flex flex-col min-h-0">
            {selectedDate && (
              <div className="flex items-center justify-start mb-6 px-1 md:hidden">
                <Button
                  variant="ghost"
                  className="h-8 hover:bg-accent hover:text-accent-foreground relative z-20 text-muted-foreground pl-0"
                  onClick={() => setActiveStep("calendar")}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("booking.back") || "Back"}
                </Button>
              </div>
            )}
            {selectedDate ? (
              <div className="flex-1 flex flex-col h-full animate-in fade-in duration-300 w-full min-h-0">
                <div className="flex items-center justify-between mb-6 px-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20"
                    onClick={() => {
                      const newDate = addDays(selectedDate, -1)
                      setSelectedDate(newDate)
                      if (!isSameMonth(newDate, currentMonth)) setCurrentMonth(startOfMonth(newDate))
                      setSelectedSlot(null)
                    }}
                    disabled={isBefore(startOfDay(addDays(selectedDate, -1)), startOfDay(new Date()))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="font-semibold text-center text-lg flex-1">
                    {format(selectedDate, "eeee, MMMM d", { locale: dateLocale })}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20"
                    onClick={() => {
                      const newDate = addDays(selectedDate, 1)
                      setSelectedDate(newDate)
                      if (!isSameMonth(newDate, currentMonth)) setCurrentMonth(startOfMonth(newDate))
                      setSelectedSlot(null)
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-0 relative z-20">
                  {isLoadingSlots ? (
                    <div className="grid grid-cols-1 gap-3 pb-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-12 w-full rounded-md ring-1 ring-inset ring-input bg-background flex items-center justify-center shadow-sm"
                        >
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : slotsForSelectedDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full pb-8">
                      <EmptyCard icon={<Clock />} title={t("booking.noAvailability")} description="" showShadow={false} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 pb-4">
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
                              if (hideDetailsStep) onSelect(slot.start, slot.end, { available: slot.available })
                              else {
                                setSelectedSlot(slot)
                                setActiveStep("details")
                              }
                            }}
                          >
                            {format(new Date(slot.start), "h:mm a")}
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
            ) : (
              <div className="flex-1 flex flex-col h-full w-full min-h-0 opacity-40 grayscale">
                <div className="flex items-center justify-center mb-6">
                  <Skeleton className="h-7 w-48" />
                </div>
                <div className="flex-1 overflow-hidden space-y-3 pr-2">
                  <div className="grid grid-cols-1 gap-3 pb-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-12 w-full rounded-md ring-1 ring-inset ring-input bg-background flex items-center justify-center shadow-sm"
                      >
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!hideDetailsStep && (
          <Card
            className={cn(
              "card-details",
              cardSurface,
              activeStep !== "details" && "md:opacity-60 hover:md:opacity-100",
              !selectedSlot && "pointer-events-none opacity-50"
            )}
          >
            {activeStep !== "details" && selectedSlot && (
              <div
                className="absolute inset-0 z-50 cursor-pointer hidden md:block"
                onClick={() => setActiveStep("details")}
              />
            )}
            <CardContent className="p-6 space-y-6 flex-1 pt-6 overflow-y-auto relative z-20">
              <div className="flex items-center justify-start mb-2 px-1 md:hidden">
                <Button
                  variant="ghost"
                  className="h-8 hover:bg-accent hover:text-accent-foreground relative z-20 text-muted-foreground pl-0"
                  onClick={() => setActiveStep("time")}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("booking.back") || "Back"}
                </Button>
              </div>
              <div className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm font-semibold">{t("booking.form.name") || "Name"}</Label>
                  <Input id="name" placeholder="John Doe" className="h-12 bg-background" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-sm font-semibold">{t("booking.form.email") || "Email"}</Label>
                  <Input id="email" type="email" placeholder="john@example.com" className="h-12 bg-background" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guests" className="text-sm font-semibold">
                    {locale === "es" ? "Invitados (separados por coma)" : "Guests (comma separated)"}
                  </Label>
                  <Input
                    id="guests"
                    placeholder={locale === "es" ? "correo1@ejemplo.com" : "guest1@example.com"}
                    className="h-12 bg-background"
                    value={guestsString}
                    onChange={(e) => setGuestsString(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes" className="text-sm font-semibold">{t("booking.form.notes") || "Additional Notes"}</Label>
                  <Textarea
                    id="notes"
                    placeholder={t("booking.form.notesPlaceholder") || "Any special requirements?"}
                    className="resize-none min-h-[80px] bg-background"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={handleConfirm} className="w-full font-semibold shadow-sm" disabled={!selectedSlot}>
                  {t("booking.confirm") || "Confirm"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
