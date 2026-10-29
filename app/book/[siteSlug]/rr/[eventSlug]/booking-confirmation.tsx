"use client";
import { Card, CardContent } from "@/app/components/ui/card";
import { ActionFooter } from "@/app/components/ui/card-footer";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { ChevronLeft, CheckCircle2 } from "@/app/components/ui/icons";
import { AddToCalendarButtons } from "@/app/components/commerce/booking/AddToCalendarButtons";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { BookingViewState } from "./booking-view-state";
export function BookingConfirmation(state: BookingViewState) {
    const { locale, t, dateLocale, calendar, selectedDate, selectedSlot, activeStep, setActiveStep, detailsRef, successRef, name, setName, email, setEmail, guestsString, setGuestsString, notes, setNotes, isSubmitting, createdTaskId, calendarUid, handleBook, meetingRange } = state;
    return (<>
    {/* DETAILS CARD */}
            <Card ref={detailsRef} className={cn("card-details bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full", activeStep !== "details" && "md:opacity-60 hover:md:opacity-100", !selectedSlot && "pointer-events-none opacity-50")}>
              {activeStep !== "details" && selectedSlot && activeStep !== "success" && (<div className="absolute inset-0 z-50 cursor-pointer hidden md:block" onClick={() => setActiveStep("details")}/>)}
              <CardContent className="p-6 space-y-6 flex-1 pt-6 overflow-y-auto relative z-20">
                <div className="flex items-center justify-start mb-2 px-1 md:hidden">
                  <Button variant="ghost" className="h-8 hover:bg-accent hover:text-accent-foreground relative z-20 text-muted-foreground pl-0" onClick={() => setActiveStep("time")}>
                    <ChevronLeft className="h-4 w-4 mr-1"/>
                    {t("booking.back")}
                  </Button>
                </div>
                <div className="space-y-5">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-semibold">
                      {t("booking.form.name")}
                    </Label>
                    <Input id="name" placeholder="John Doe" className="h-12 bg-background" value={name} onChange={(e) => setName(e.target.value)}/>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                      {t("booking.form.email")}
                    </Label>
                    <Input id="email" type="email" placeholder="john@example.com" className="h-12 bg-background" value={email} onChange={(e) => setEmail(e.target.value)}/>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="guests" className="text-sm font-semibold">
                      {locale === "es" ? "Invitados (separados por coma)" : "Guests (comma separated)"}
                    </Label>
                    <Input id="guests" type="text" placeholder={locale === "es"
            ? "correo1@ejemplo.com, correo2@ejemplo.com"
            : "guest1@example.com, guest2@example.com"} className="h-12 bg-background" value={guestsString} onChange={(e) => setGuestsString(e.target.value)}/>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes" className="text-sm font-semibold">
                      {t("booking.form.notes")}
                    </Label>
                    <Textarea id="notes" placeholder={t("booking.form.notesPlaceholder")} className="resize-none min-h-[80px] bg-background" value={notes} onChange={(e) => setNotes(e.target.value)}/>
                  </div>
                </div>
              </CardContent>
              <ActionFooter className="flex-col sm:flex-row items-center justify-end relative z-20">
                <Button onClick={handleBook} disabled={isSubmitting} className="w-full font-semibold shadow-sm">
                  {isSubmitting ? t("booking.booking") : t("booking.confirm")}
                </Button>
              </ActionFooter>
            </Card>
            <Card ref={successRef} className={cn("card-success bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full", activeStep !== "success" && "md:opacity-60 hover:md:opacity-100", activeStep !== "success" && "pointer-events-none opacity-50")}>
              <CardContent className="p-6 space-y-6 flex-1 pt-10 overflow-y-auto relative z-20 flex flex-col items-center justify-center text-center">
                {activeStep === "success" ? (<>
                    <div className="flex justify-center mb-4">
                      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600"/>
                      </div>
                    </div>
                    <h1 className="text-2xl font-bold">{t("booking.success.title")}</h1>
                    <p className="text-muted-foreground max-w-[280px]">
                      {t("booking.success.descRR")}
                    </p>
                    <div className="pt-4 border-t border-border mt-6 text-left space-y-2 w-full max-w-[280px]">
                      <p className="text-sm">
                        <strong>{t("booking.details.date")}:</strong>{" "}
                        {selectedDate && format(selectedDate, "MMMM do, yyyy", { locale: dateLocale })}
                      </p>
                      <p className="text-sm">
                        <strong>{t("booking.details.time")}:</strong> {selectedSlot}
                      </p>
                      <p className="text-sm">
                        <strong>{t("booking.details.type")}:</strong> {calendar.name}
                      </p>
                      {calendar.location && (<p className="text-sm">
                          <strong>Location:</strong>{" "}
                          {calendar.location.startsWith("http") ? (<a href={calendar.location} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {calendar.location}
                            </a>) : (calendar.location)}
                        </p>)}
                    </div>
                    {meetingRange && (<AddToCalendarButtons event={{
                    title: `${calendar.name} with ${name}`,
                    description: notes || "",
                    location: calendar.location,
                    start: meetingRange.start,
                    end: meetingRange.end,
                    uid: createdTaskId ? `${createdTaskId}@uncodie.com` : calendarUid,
                }}/>)}
                  </>) : (<div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground"/>
                    <h2 className="text-xl font-semibold text-muted-foreground">{t("booking.success.pending")}</h2>
                    <p className="text-sm text-muted-foreground">{t("booking.success.pendingDesc")}</p>
                  </div>)}
              </CardContent>
            </Card>

  </>);
}
