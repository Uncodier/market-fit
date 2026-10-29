"use client";
import { CalendarIcon, Clock } from "@/app/components/ui/icons";
import { format } from "date-fns";
import type { BookingViewState } from "./booking-view-state";
import { TimezoneField } from "@/app/components/ui/timezone-field";
export function BookingSummary(state: BookingViewState) {
    const { userSlug, t, dateLocale, profile, siteInfo, eventType, selectedDate, selectedSlot, userTimezone, handleTimezoneChange } = state;
    return (<>
    <div className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left">
            {siteInfo && (<div className="flex items-center justify-center md:justify-start gap-3 mb-6 w-full">
                {siteInfo.logo_url ? (<img src={siteInfo.logo_url} alt={siteInfo.name} className="h-10 w-auto max-w-[160px] object-contain"/>) : (<div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      {siteInfo.name.charAt(0)}
                    </span>
                  </div>)}
                <span className="font-semibold text-xl">{siteInfo.name}</span>
              </div>)}
              <div className="space-y-4 flex flex-col items-center md:items-start w-full">
                {profile.avatar_url && (<img src={profile.avatar_url} alt={profile.name} className="h-20 w-20 rounded-full object-cover border-2 border-primary/10 shadow-sm"/>)}
                <div className="w-full">
                  <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest text-center md:text-left">
                    {profile.name || userSlug}
                  </h2>
                  <h1 className="text-2xl font-semibold mt-1 text-center md:text-left">
                    {eventType.title}
                  </h1>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground w-full">
                  <Clock className="h-4 w-4"/>
                  <span className="font-medium text-sm">
                    {eventType.duration} min
                  </span>
                </div>
                {selectedDate && (<div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground w-full">
                    <CalendarIcon className="h-4 w-4"/>
                    <span className="font-medium text-sm">
                      {format(selectedDate, "MMMM do, yyyy", {
                locale: dateLocale,
            })}
                      {selectedSlot ? ` at ${selectedSlot}` : ""}
                    </span>
                  </div>)}
              {eventType.description && (<p className="text-muted-foreground text-sm leading-relaxed text-center md:text-left w-full line-clamp-[8]">
                  {eventType.description}
                </p>)}
              
              <div className="pt-4 mt-2 flex flex-col justify-center md:justify-start w-full">
                <TimezoneField value={userTimezone} onChange={handleTimezoneChange} showHint={false}/>
                <p className="text-muted-foreground text-xs mt-3 text-center md:text-left">
                  {t("booking.details.shared_later")}
                </p>
              </div>
            </div>

          </div>

          
  </>);
}
