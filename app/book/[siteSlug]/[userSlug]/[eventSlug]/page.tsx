"use client";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/lib/utils";
import { useBooking, type BookingPageProps } from "./use-booking";
import type { BookingViewState } from "./booking-view-state";
import { BookingSummary } from "./booking-summary";
import { BookingSchedule } from "./booking-schedule";
import { BookingConfirmation } from "./booking-confirmation";
import { BookingFooter } from "./booking-footer";
import { BookingLoading } from "./booking-loading";
export default function UserBookingPage(props: BookingPageProps) {
    const booking = useBooking(props);
    const { isEmbed, t, profile, eventType, activeStep, containerRef } = booking;
    if (booking.isLoading)
        return <BookingLoading isEmbed={booking.isEmbed}/>;
    if (!profile || !eventType) {
        return (<div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold">{t("booking.notFound.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("booking.notFound.desc")}
            </p>
          </CardContent>
        </Card>
      </div>);
    }
    const state: BookingViewState = { ...booking, profile, eventType };
    return (<div className={cn("bg-background flex flex-col overflow-hidden", !isEmbed && "min-h-screen")}>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <BookingSummary {...state}/>
    <div className="md:col-span-2 relative w-full overflow-visible z-0">
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
                .card-success {
                  transform: var(--succ-transform);
                  opacity: var(--succ-opacity) !important;
                  z-index: var(--succ-z);
                  position: absolute;
                  left: 0;
                  top: 0;
                }
              }
            `}</style>
            <div ref={containerRef} className="flex flex-col md:block gap-6 md:gap-0 pb-4 md:pb-0 relative w-full md:h-[590px] overflow-hidden md:overflow-visible" style={{
            "--cal-transform": activeStep === "calendar" ? "translateX(0) scale(1)" : activeStep === "time" ? "translateX(calc(-100% - 360px)) scale(0.95)" : activeStep === "details" ? "translateX(calc(-100% - 640px)) scale(0.9)" : "translateX(calc(-100% - 920px)) scale(0.85)",
            "--cal-opacity": activeStep === "calendar" ? "1" : activeStep === "time" ? "0.3" : "0",
            "--cal-opacity-hover": "1",
            "--cal-z": activeStep === "calendar" ? "40" : activeStep === "time" ? "30" : activeStep === "details" ? "20" : "10",
            "--time-transform": activeStep === "calendar" ? "translateX(calc(100% + 2rem)) scale(0.95)" : activeStep === "time" ? "translateX(0) scale(1)" : activeStep === "details" ? "translateX(calc(-100% - 360px)) scale(0.95)" : "translateX(calc(-100% - 640px)) scale(0.9)",
            "--time-opacity": activeStep === "calendar" ? "0.2" : activeStep === "time" ? "1" : activeStep === "details" ? "0.3" : "0",
            "--time-opacity-hover": "1",
            "--time-z": activeStep === "calendar" ? "30" : activeStep === "time" ? "40" : activeStep === "details" ? "30" : "20",
            "--det-transform": activeStep === "calendar" ? "translateX(calc(200% + 4rem)) scale(0.9)" : activeStep === "time" ? "translateX(calc(100% + 2rem)) scale(0.95)" : activeStep === "details" ? "translateX(0) scale(1)" : "translateX(calc(-100% - 360px)) scale(0.95)",
            "--det-opacity": activeStep === "calendar" ? "0" : activeStep === "time" ? "0.2" : activeStep === "details" ? "1" : "0.3",
            "--det-opacity-hover": "1",
            "--det-z": activeStep === "calendar" ? "20" : activeStep === "time" ? "30" : activeStep === "details" ? "40" : "30",
            "--succ-transform": activeStep === "calendar" ? "translateX(calc(300% + 6rem)) scale(0.85)" : activeStep === "time" ? "translateX(calc(200% + 4rem)) scale(0.9)" : activeStep === "details" ? "translateX(calc(100% + 2rem)) scale(0.95)" : "translateX(0) scale(1)",
            "--succ-opacity": activeStep === "calendar" ? "0" : activeStep === "time" ? "0" : activeStep === "details" ? "0.2" : "1",
            "--succ-z": activeStep === "calendar" ? "10" : activeStep === "time" ? "20" : activeStep === "details" ? "30" : "40",
        } as React.CSSProperties}>
            <BookingSchedule {...state}/>
    <BookingConfirmation {...state}/>
            </div>
          </div>
        </div>
      </div>
    </main>

      <BookingFooter {...state}/>
    </div>);
}
