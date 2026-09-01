import React, { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { CalendarIcon } from "@/app/components/ui/icons";
import { buildGoogleCalendarUrl, buildIcs, CalendarEvent } from "@/lib/calendar/invite";
import { useLocalization } from "@/app/context/LocalizationContext";

export interface AddToCalendarButtonsProps {
  event: CalendarEvent;
}

export function AddToCalendarButtons({ event }: AddToCalendarButtonsProps) {
  const { t } = useLocalization();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadCalendar = () => {
    setDownloading(true);
    const icsContent = buildIcs(event);
    const blob = new Blob([icsContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Formatting filename
    const dateStr = event.start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    link.download = `meeting-${dateStr}.ics`;
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloading(false);
    }, 100);
  };

  const googleUrl = buildGoogleCalendarUrl(event);

  return (
    <div className="pt-6 mt-2 w-full max-w-[280px] space-y-3">
      <Button 
        onClick={handleDownloadCalendar} 
        disabled={downloading}
        className="w-full font-semibold shadow-sm flex items-center justify-center gap-2"
        variant="outline"
      >
        <CalendarIcon className="h-4 w-4" />
        {t("booking.addToCalendar") || "Add to calendar"}
      </Button>
      <Button 
        asChild
        className="w-full font-semibold shadow-sm flex items-center justify-center gap-2 bg-[#111111] hover:bg-[#111111]/90 text-white border-0"
        variant="outline"
      >
        <a href={googleUrl} target="_blank" rel="noreferrer">
          <CalendarIcon className="h-4 w-4" />
          {t("booking.addToGoogleCalendar") || "Add to Google Calendar"}
        </a>
      </Button>
    </div>
  );
}
