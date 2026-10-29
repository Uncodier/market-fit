"use client";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Clock, ChevronLeft, ChevronRight } from "@/app/components/ui/icons";
import { EmptyCard } from "@/app/components/ui/empty-card";
import { format, addMonths, subMonths, startOfMonth, isSameMonth, isSameDay, addDays, isBefore, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/app/components/ui/skeleton";
import type { BookingViewState } from "./booking-view-state";
export function BookingSchedule(state: BookingViewState) {
    const { t, dateLocale, isLoadingSlots, currentMonth, setCurrentMonth, selectedDate, setSelectedDate, availableSlots, monthAvailability, selectedSlot, setSelectedSlot, activeStep, setActiveStep, calendarRef, timeRef, calendarDays } = state;
    return (<>
    {/* CALENDAR CARD */}
            <Card ref={calendarRef} className={cn("card-calendar bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full", activeStep !== "calendar" && "md:opacity-60 hover:md:opacity-100")}>
              {activeStep !== "calendar" && activeStep !== "success" && (<div className="absolute inset-0 z-50 cursor-pointer hidden md:block" onClick={() => setActiveStep("calendar")}/>)}
              <CardContent className="p-6 flex-1 flex flex-col min-h-0">
                <div className="flex-1 flex flex-col animate-in fade-in duration-300 w-full">
                  <div className="flex items-center justify-between mb-6 px-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} disabled={isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()))}>
                      <ChevronLeft className="h-4 w-4"/>
                    </Button>
                    <h3 className="font-semibold text-lg text-center flex-1">
                      {format(currentMonth, "MMMM yyyy", {
            locale: dateLocale,
        })}
                    </h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4"/>
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center mb-4">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (<div key={idx} className="text-[11px] font-bold text-muted-foreground uppercase py-2">
                        {d}
                      </div>))}
                  </div>

                  <div className="grid grid-cols-7 gap-y-5 md:gap-y-6 gap-x-1 mt-4">
                    {calendarDays.map((date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isAvailable = monthAvailability[dateStr] ?? false;
            const hasLoadedAvailability = Object.keys(monthAvailability).length > 0;
            const shouldDisable = isPast || (hasLoadedAvailability && !isAvailable);
            return (<button key={date.toISOString()} disabled={shouldDisable} onClick={() => {
                    if (!isCurrentMonth) {
                        setCurrentMonth(startOfMonth(date));
                    }
                    setSelectedDate(date);
                    setSelectedSlot(null);
                    setActiveStep("time");
                }} className={cn("h-11 w-11 sm:h-12 sm:w-12 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200 relative z-20", isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "hover:bg-accent hover:text-accent-foreground", isToday && !isSelected && "text-primary font-bold bg-primary/5", !shouldDisable && !isSelected && !isToday && isCurrentMonth && "font-semibold text-foreground bg-accent/20", !shouldDisable && !isSelected && !isToday && !isCurrentMonth && "font-medium text-muted-foreground bg-transparent", shouldDisable && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-inherit font-normal bg-transparent")}>
                          {format(date, "d")}
                        </button>);
        })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TIME CARD */}
            <Card ref={timeRef} className={cn("card-time bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full", activeStep !== "time" && "md:opacity-60 hover:md:opacity-100", !selectedDate && "pointer-events-none opacity-50")}>
              {activeStep !== "time" && selectedDate && activeStep !== "success" && (<div className="absolute inset-0 z-50 cursor-pointer hidden md:block" onClick={() => setActiveStep("time")}/>)}
              <CardContent className="p-6 flex-1 flex flex-col min-h-0">
                {selectedDate && (<div className="flex items-center justify-start mb-6 px-1 md:hidden">
                    <Button variant="ghost" className="h-8 hover:bg-accent hover:text-accent-foreground relative z-20 text-muted-foreground pl-0" onClick={() => setActiveStep("calendar")}>
                      <ChevronLeft className="h-4 w-4 mr-1"/>
                      {t("booking.back")}
                    </Button>
                  </div>)}
                {selectedDate ? (<div className="flex-1 flex flex-col h-full animate-in fade-in duration-300 w-full min-h-0">
                    <div className="flex items-center justify-between mb-6 px-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20" onClick={() => {
                if (selectedDate) {
                    const newDate = addDays(selectedDate, -1);
                    setSelectedDate(newDate);
                    if (!isSameMonth(newDate, currentMonth)) {
                        setCurrentMonth(startOfMonth(newDate));
                    }
                    setSelectedSlot(null);
                }
            }} disabled={isBefore(startOfDay(addDays(selectedDate || new Date(), -1)), startOfDay(new Date()))}>
                        <ChevronLeft className="h-4 w-4"/>
                      </Button>
                      <h3 className="font-semibold text-center text-lg flex-1">
                        {format(selectedDate, "eeee, MMMM d", { locale: dateLocale })}
                      </h3>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground relative z-20" onClick={() => {
                if (selectedDate) {
                    const newDate = addDays(selectedDate, 1);
                    setSelectedDate(newDate);
                    if (!isSameMonth(newDate, currentMonth)) {
                        setCurrentMonth(startOfMonth(newDate));
                    }
                    setSelectedSlot(null);
                }
            }}>
                        <ChevronRight className="h-4 w-4"/>
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-0 relative z-20">
                      {isLoadingSlots ? (<div className="grid grid-cols-1 gap-3 pb-4">
                          {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="h-12 w-full rounded-md ring-1 ring-inset ring-input bg-background flex items-center justify-center shadow-sm">
                              <Skeleton className="h-4 w-16"/>
                            </div>))}
                        </div>) : availableSlots.length === 0 ? (<div className="flex flex-col items-center justify-center h-full pb-8">
                          <EmptyCard icon={<Clock />} title={t("booking.noAvailability")} description="" showShadow={false}/>
                        </div>) : (<div className="grid grid-cols-1 gap-3 pb-4">
                          {availableSlots.map((slot) => (<Button key={slot} variant="outline" className={cn("w-full justify-center font-medium transition-all h-12", selectedSlot === slot
                        ? "ring-primary bg-primary/5 text-primary"
                        : "hover:border-primary/30 hover:bg-accent")} onClick={() => {
                        setSelectedSlot(slot);
                        setActiveStep("details");
                    }}>
                              {slot}
                            </Button>))}
                        </div>)}
                    </div>
                  </div>) : (<div className="flex-1 flex flex-col h-full w-full min-h-0 opacity-40 grayscale">
                    <div className="flex items-center justify-center mb-6">
                      <Skeleton className="h-7 w-48"/>
                    </div>
                    <div className="flex-1 overflow-hidden space-y-3 pr-2">
                      <div className="grid grid-cols-1 gap-3 pb-4">
                        {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="h-12 w-full rounded-md ring-1 ring-inset ring-input bg-background flex items-center justify-center shadow-sm">
                            <Skeleton className="h-4 w-16"/>
                          </div>))}
                      </div>
                    </div>
                  </div>)}
              </CardContent>
            </Card>

            
  </>);
}
