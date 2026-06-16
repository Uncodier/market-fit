"use client";

import { useState, useEffect, use, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  getRRCalendarBySlug,
  getRRAvailability,
  bookRRMeeting,
  getSiteInfoBySlug,
  getRRMonthAvailability,
} from "@/app/book/actions";
import { RoundRobinCalendar } from "@/app/context/SiteContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { ActionFooter } from "@/app/components/ui/card-footer";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Users,
  Globe,
  Sun,
  Moon,
} from "@/app/components/ui/icons";
import { EmptyCard } from "@/app/components/ui/empty-card";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
  isBefore,
  startOfDay,
  parseISO,
} from "date-fns";
import { es, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/app/components/ui/skeleton";
import { toast } from "sonner";
import { useTheme } from "@/app/context/ThemeContext";
import {
  useLocalization,
  SupportedLocale,
} from "@/app/context/LocalizationContext";

export default function RoundRobinBookingPage(props: {
  params: Promise<{ siteSlug: string; eventSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(props.params);
  const searchParamsPromise = use(props.searchParams); // unwrap to prevent Next.js 15 warning
  const searchParams = useSearchParams();
  const siteSlug = params.siteSlug;
  const eventSlug = params.eventSlug;
  const isEmbed = searchParams.get("embed") === "true";

  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocalization();
  const dateLocale = locale === "es" ? es : enUS;

  const [calendar, setCalendar] = useState<RoundRobinCalendar | null>(null);
  const [siteInfo, setSiteInfo] = useState<{
    id: string;
    name: string;
    logo_url: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [monthAvailability, setMonthAvailability] = useState<Record<string, boolean>>({});
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<"calendar" | "time" | "details" | "success">("calendar");
  const [userTimezone, setUserTimezone] = useState<string>("America/Mexico_City");

  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      if (activeStep === "calendar") {
        calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (activeStep === "time") {
        timeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (activeStep === "details") {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (activeStep === "success") {
        successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [activeStep]);

  useEffect(() => {
    const urlTz = searchParams.get("tz") || searchParams.get("timezone") || searchParams.get("region");
    if (urlTz) {
      setUserTimezone(urlTz);
    } else if (typeof Intl !== "undefined") {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [searchParams]);

  useEffect(() => {
    const urlTheme = searchParams.get("theme") || searchParams.get("tema");
    if (urlTheme === "dark" || urlTheme === "light") {
      setTheme(urlTheme);
    }
    const urlLocale = searchParams.get("locale") || searchParams.get("lang") || searchParams.get("idioma");
    if (urlLocale === "en" || urlLocale === "es") {
      setLocale(urlLocale as SupportedLocale);
    }
  }, [searchParams, setTheme, setLocale]);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guestsString, setGuestsString] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      const sInfo = await getSiteInfoBySlug(siteSlug);
      if (sInfo) {
        setSiteInfo(sInfo);
        const data = await getRRCalendarBySlug(eventSlug, sInfo.id);
        if (data) {
          setCalendar(data.calendar);
        }
      }
      setIsLoading(false);
    }
    loadData();
  }, [siteSlug, eventSlug]);

  useEffect(() => {
    if (selectedDate && calendar) {
      async function loadSlots() {
        setIsLoadingSlots(true);
        const slots = await getRRAvailability(
          calendar!.member_ids,
          format(selectedDate!, "yyyy-MM-dd"),
          calendar!.duration,
          calendar!.buffer,
        );
        setAvailableSlots(slots);
        setIsLoadingSlots(false);
      }
      loadSlots();
    }
  }, [selectedDate, calendar]);

  useEffect(() => {
    if (calendar && currentMonth) {
      async function loadMonthAvailability() {
        const firstDayOfMonth = startOfMonth(currentMonth).getDay();
        const startDate = addDays(startOfMonth(currentMonth), -firstDayOfMonth);
        const start = format(startDate, "yyyy-MM-dd");
        const end = format(addDays(startDate, 41), "yyyy-MM-dd");
        const availability = await getRRMonthAvailability(
          calendar!.member_ids,
          start,
          end,
          calendar!.duration,
          calendar!.buffer,
        );
        setMonthAvailability(availability);
      }
      loadMonthAvailability();
    }
  }, [currentMonth, calendar]);

  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-background flex flex-col",
          !isEmbed && "min-h-screen",
        )}
      >
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left bg-background relative z-10 md:-mr-8 md:pr-8">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-6 w-full">
                <Skeleton className="h-10 w-10 rounded" />
                <Skeleton className="h-8 w-32" />
              </div>
                <div className="space-y-4 flex flex-col items-center md:items-start w-full">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="w-full flex flex-col items-center md:items-start">
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-8 w-48" />
                  </div>
                  <div className="flex items-center justify-center md:justify-start gap-2 w-full">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="space-y-2 w-full flex flex-col items-center md:items-start">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 relative w-full overflow-visible z-0">
                <Card className="card-calendar bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col w-full md:w-[590px] md:max-w-full">
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex-1 flex flex-col w-full">
                      <div className="flex items-center justify-between mb-6 px-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-7 w-32 mx-auto" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>

                      <div className="grid grid-cols-7 gap-1 mb-4">
                        {Array.from({ length: 7 }).map((_, i) => (
                          <Skeleton key={i} className="h-4 w-4 mx-auto my-2" />
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-5 md:gap-y-6 gap-x-1 mt-4">
                        {Array.from({ length: 42 }).map((_, i) => (
                          <Skeleton
                            key={i}
                            className="h-11 w-11 sm:h-12 sm:w-12 mx-auto rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold">{t("booking.notFound.title")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("booking.notFound.desc")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstDayOfMonth = startOfMonth(currentMonth).getDay();
  const startDate = addDays(startOfMonth(currentMonth), -firstDayOfMonth);
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: addDays(startDate, 41),
  });

  const handleBook = async () => {
    if (!name || !email || !selectedDate || !selectedSlot) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await bookRRMeeting({
        calendarId: calendar.id,
        siteId: siteInfo?.id || "default",
        memberEmails: calendar.member_ids,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedSlot,
        name,
        email,
        guests: guestsString
          ? guestsString
              .split(",")
              .map((e) => e.trim())
              .filter((e) => e)
          : undefined,
        notes,
        location: calendar.location,
        title: `${calendar.name} with ${name}`,
      });
      setActiveStep("success");
    } catch (error) {
      console.error(error);
      toast.error("Failed to book meeting. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadCalendar = () => {
    if (!selectedDate || !selectedSlot || !calendar) return;

    const [hours, minutes] = selectedSlot.split(":").map(Number);
    const startDate = new Date(selectedDate);
    startDate.setHours(hours, minutes, 0, 0);

    const endDate = new Date(startDate.getTime() + calendar.duration * 60000);

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Uncodie//Market Fit//EN",
      "BEGIN:VEVENT",
      `UID:${new Date().getTime()}@uncodie.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${calendar.name} with ${name}`,
      `DESCRIPTION:${notes || ""}`,
      calendar.location ? `LOCATION:${calendar.location}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const blob = new Blob([icsContent], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-${format(startDate, "yyyyMMdd-HHmm")}.ics`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up with a small delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div
      className={cn(
        "bg-background flex flex-col overflow-hidden",
        !isEmbed && "min-h-screen",
      )}
    >
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6 flex flex-col justify-center items-center md:items-start text-center md:text-left bg-background relative z-10 md:-mr-8 md:pr-8">
            {siteInfo && (
              <div className="flex items-center justify-center md:justify-start gap-3 mb-6 w-full">
                {siteInfo.logo_url ? (
                  <img
                    src={siteInfo.logo_url}
                    alt={siteInfo.name}
                    className="h-10 w-auto max-w-[160px] object-contain"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      {siteInfo.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="font-semibold text-xl">{siteInfo.name}</span>
              </div>
            )}
              <div className="space-y-4 flex flex-col items-center md:items-start w-full">
                <div className="h-16 w-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                  <Users className="h-7 w-7 text-primary/80" />
                </div>
                <div className="w-full">
                  <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest text-center md:text-left">
                    Team Meeting
                  </h2>
                  <h1 className="text-2xl font-semibold mt-1 text-center md:text-left">{calendar.name}</h1>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground w-full">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    {calendar.duration} min
                  </span>
                </div>
                {selectedDate && (
                  <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground w-full">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="font-medium text-sm">
                      {format(selectedDate, "MMMM do, yyyy", {
                        locale: dateLocale,
                      })}
                      {selectedSlot ? ` at ${selectedSlot}` : ""}
                    </span>
                  </div>
                )}
              {calendar.description && (
                <p className="text-muted-foreground text-sm leading-relaxed text-center md:text-left w-full">
                  {calendar.description}
                </p>
              )}
              
              <div className="pt-4 mt-2 flex flex-col justify-center md:justify-start w-full">
                <Select value={userTimezone} onValueChange={setUserTimezone}>
                  <SelectTrigger className="w-fit bg-transparent border-none shadow-none focus:ring-0 px-0 h-auto text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <SelectValue placeholder={t("booking.timezone.select")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Set([
                        "America/Los_Angeles",
                        "America/Denver",
                        "America/Chicago",
                        "America/New_York",
                        "America/Mexico_City",
                        "Europe/London",
                        "Europe/Madrid",
                        "Asia/Tokyo",
                        userTimezone,
                      ]),
                    ).map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs mt-3 text-center md:text-left">
                  {t("booking.details.shared_later")}
                </p>
              </div>
            </div>

          </div>

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
            <div
              ref={containerRef}
              className="flex flex-col md:block gap-6 md:gap-0 pb-4 md:pb-0 relative w-full md:h-[590px] overflow-hidden md:overflow-visible"
              style={{
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
              } as React.CSSProperties}
            >
            {/* CALENDAR CARD */}
            <Card
              ref={calendarRef}
              className={cn(
                "card-calendar bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full",
                activeStep !== "calendar" && "md:opacity-60 hover:md:opacity-100"
              )}
            >
              {activeStep !== "calendar" && activeStep !== "success" && (
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
                      {format(currentMonth, "MMMM yyyy", {
                        locale: dateLocale,
                      })}
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
                      <div
                        key={idx}
                        className="text-[11px] font-bold text-muted-foreground uppercase py-2"
                      >
                        {d}
                      </div>
                    ))}
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

                      return (
                        <button
                          key={date.toISOString()}
                          disabled={shouldDisable}
                          onClick={() => {
                            if (!isCurrentMonth) {
                              setCurrentMonth(startOfMonth(date));
                            }
                            setSelectedDate(date);
                            setSelectedSlot(null);
                            setActiveStep("time");
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
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TIME CARD */}
            <Card
              ref={timeRef}
              className={cn(
                "card-time bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full",
                activeStep !== "time" && "md:opacity-60 hover:md:opacity-100",
                !selectedDate && "pointer-events-none opacity-50"
              )}
            >
              {activeStep !== "time" && selectedDate && activeStep !== "success" && (
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
                      {t("booking.back")}
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
                          if (selectedDate) {
                            const newDate = addDays(selectedDate, -1);
                            setSelectedDate(newDate);
                            if (!isSameMonth(newDate, currentMonth)) {
                              setCurrentMonth(startOfMonth(newDate));
                            }
                            setSelectedSlot(null);
                          }
                        }}
                        disabled={isBefore(startOfDay(addDays(selectedDate || new Date(), -1)), startOfDay(new Date()))}
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
                          if (selectedDate) {
                            const newDate = addDays(selectedDate, 1);
                            setSelectedDate(newDate);
                            if (!isSameMonth(newDate, currentMonth)) {
                              setCurrentMonth(startOfMonth(newDate));
                            }
                            setSelectedSlot(null);
                          }
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
                      ) : availableSlots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full pb-8">
                          <EmptyCard
                            icon={<Clock />}
                            title={t("booking.noAvailability")}
                            description=""
                            showShadow={false}
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 pb-4">
                          {availableSlots.map((slot) => (
                            <Button
                              key={slot}
                              variant={selectedSlot === slot ? "default" : "outline"}
                              className={cn(
                                "w-full justify-center font-medium transition-all h-12",
                                selectedSlot === slot ? "shadow-md" : "hover:border-primary/30 hover:bg-accent",
                              )}
                              onClick={() => {
                                setSelectedSlot(slot);
                                setActiveStep("details");
                              }}
                            >
                              {slot}
                            </Button>
                          ))}
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

            {/* DETAILS CARD */}
            <Card
              ref={detailsRef}
              className={cn(
                "card-details bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full",
                activeStep !== "details" && "md:opacity-60 hover:md:opacity-100",
                !selectedSlot && "pointer-events-none opacity-50"
              )}
            >
              {activeStep !== "details" && selectedSlot && activeStep !== "success" && (
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
                    {t("booking.back")}
                  </Button>
                </div>
                <div className="space-y-5">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-semibold">
                      {t("booking.form.name")}
                    </Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      className="h-12 bg-background"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-semibold">
                      {t("booking.form.email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      className="h-12 bg-background"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="guests" className="text-sm font-semibold">
                      {locale === "es" ? "Invitados (separados por coma)" : "Guests (comma separated)"}
                    </Label>
                    <Input
                      id="guests"
                      type="text"
                      placeholder={
                        locale === "es"
                          ? "correo1@ejemplo.com, correo2@ejemplo.com"
                          : "guest1@example.com, guest2@example.com"
                      }
                      className="h-12 bg-background"
                      value={guestsString}
                      onChange={(e) => setGuestsString(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notes" className="text-sm font-semibold">
                      {t("booking.form.notes")}
                    </Label>
                    <Textarea
                      id="notes"
                      placeholder={t("booking.form.notesPlaceholder")}
                      className="resize-none min-h-[80px] bg-background"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <ActionFooter className="flex-col sm:flex-row items-center justify-end relative z-20">
                <Button
                  onClick={handleBook}
                  disabled={isSubmitting}
                  className="w-full font-semibold shadow-sm"
                >
                  {isSubmitting ? t("booking.booking") : t("booking.confirm")}
                </Button>
              </ActionFooter>
            </Card>
            <Card
              ref={successRef}
              className={cn(
                "card-success bg-black/[0.005] dark:bg-white/[0.005] border dark:border-white/5 border-black/5 shadow-sm h-[590px] flex flex-col transition-all duration-500 ease-in-out w-full md:w-[590px] md:max-w-full",
                activeStep !== "success" && "md:opacity-60 hover:md:opacity-100",
                activeStep !== "success" && "pointer-events-none opacity-50"
              )}
            >
              <CardContent className="p-6 space-y-6 flex-1 pt-10 overflow-y-auto relative z-20 flex flex-col items-center justify-center text-center">
                {activeStep === "success" ? (
                  <>
                    <div className="flex justify-center mb-4">
                      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
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
                      {calendar.location && (
                        <p className="text-sm">
                          <strong>Location:</strong>{" "}
                          {calendar.location.startsWith("http") ? (
                            <a href={calendar.location} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {calendar.location}
                            </a>
                          ) : (
                            calendar.location
                          )}
                        </p>
                      )}
                    </div>
                    <div className="pt-6 mt-2 w-full max-w-[280px]">
                      <Button 
                        onClick={handleDownloadCalendar} 
                        className="w-full font-semibold shadow-sm flex items-center justify-center gap-2"
                        variant="outline"
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {t("booking.addToCalendar")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
                    <h2 className="text-xl font-semibold text-muted-foreground">{t("booking.success.pending")}</h2>
                    <p className="text-sm text-muted-foreground">{t("booking.success.pendingDesc")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </div>
    </main>

      {!isEmbed && (
        <footer className="w-full py-4 px-4 sm:px-6 bg-background mt-auto">
          <div className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              <div className="h-3 w-[1px] bg-border/40" />

              <Select
                value={locale}
                onValueChange={(v) => setLocale(v as SupportedLocale)}
              >
                <SelectTrigger className="w-fit bg-transparent border-none shadow-none focus:ring-0 px-0 h-auto text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
                  <div className="flex items-center gap-1">
                    <SelectValue placeholder={t("booking.language")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="es">ES</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
