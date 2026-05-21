"use client";

import { useState, useEffect, use } from "react";
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
  const [step, setStep] = useState<"calendar" | "details" | "success">(
    "calendar",
  );
  const [userTimezone, setUserTimezone] = useState<string>(
    "America/Mexico_City",
  );

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
        const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
        const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
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
          "bg-background",
          !isEmbed && "min-h-screen flex items-center justify-center p-4",
        )}
      >
        <div className="max-w-4xl w-full mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div>
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-8 w-48" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <Card className="border dark:border-white/5 border-black/5 shadow-sm overflow-hidden h-[540px] flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
                    <div className="flex items-center justify-between mb-6">
                      <Skeleton className="h-7 w-32" />
                      <div className="flex gap-1">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-4 w-4 mx-auto my-2" />
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <Skeleton
                          key={i}
                          className="h-11 w-11 mx-auto rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
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

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfMonth = startOfMonth(currentMonth).getDay();
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => {
    return addDays(startOfMonth(currentMonth), -(firstDayOfMonth - i));
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
        title: `${calendar.name} with ${name}`,
      });
      setStep("success");
    } catch (error) {
      console.error(error);
      toast.error("Failed to book meeting. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "success") {
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
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\n");

      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `meeting-${format(startDate, "yyyyMMdd-HHmm")}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    return (
      <div
        className={cn(
          "flex items-center justify-center",
          !isEmbed && "min-h-screen p-4",
        )}
      >
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">{t("booking.success.title")}</h1>
            <p className="text-muted-foreground">
              {t("booking.success.descRR")}
            </p>
            <div className="pt-4 border-t border-border mt-6 text-left space-y-2">
              <p className="text-sm">
                <strong>{t("booking.details.date")}:</strong>{" "}
                {format(selectedDate!, "MMMM do, yyyy", { locale: dateLocale })}
              </p>
              <p className="text-sm">
                <strong>{t("booking.details.time")}:</strong> {selectedSlot}
              </p>
              <p className="text-sm">
                <strong>{t("booking.details.type")}:</strong> {calendar.name}
              </p>
            </div>
            <div className="pt-6 mt-2">
              <Button 
                onClick={handleDownloadCalendar} 
                className="w-full font-semibold shadow-sm flex items-center justify-center gap-2"
                variant="outline"
              >
                <CalendarIcon className="h-4 w-4" />
                {t("booking.addToCalendar")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-background",
        !isEmbed && "min-h-screen flex items-center justify-center p-4",
      )}
    >
      <div className="max-w-4xl w-full mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6 flex flex-col justify-center">
            {siteInfo && (
              <div className="flex items-center gap-3 mb-4">
                {siteInfo.logo_url ? (
                  <img
                    src={siteInfo.logo_url}
                    alt={siteInfo.name}
                    className="h-8 w-8 object-contain"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">
                      {siteInfo.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="font-semibold text-lg">{siteInfo.name}</span>
              </div>
            )}
            <div className="space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                <Users className="h-7 w-7 text-primary/80" />
              </div>
              <div>
                <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  Team Meeting
                </h2>
                <h1 className="text-2xl font-semibold mt-1">{calendar.name}</h1>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {calendar.duration} min
                </span>
              </div>
              {calendar.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {calendar.description}
                </p>
              )}
            </div>

          </div>

          <div className="md:col-span-2 flex flex-col">
            <Card className="border dark:border-white/5 border-black/5 shadow-sm overflow-hidden h-[540px] flex flex-col mb-4">
              {step === "calendar" ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <CardContent className="p-6 flex-1 flex flex-col min-h-0">
                    {!selectedDate ? (
                      <div className="flex-1 flex flex-col animate-in fade-in duration-300 max-w-md mx-auto w-full">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg">
                            {format(currentMonth, "MMMM yyyy", {
                              locale: dateLocale,
                            })}
                          </h3>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                              onClick={() =>
                                setCurrentMonth(subMonths(currentMonth, 1))
                              }
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                              onClick={() =>
                                setCurrentMonth(addMonths(currentMonth, 1))
                              }
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
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

                        <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                          {paddingDays.map((date, i) => (
                            <div key={`padding-${i}`} className="h-11" />
                          ))}
                          {days.map((date) => {
                            const dateStr = format(date, "yyyy-MM-dd");
                            const isSelected =
                              selectedDate && isSameDay(date, selectedDate);
                            const isToday = isSameDay(date, new Date());
                            const isPast = isBefore(
                              startOfDay(date),
                              startOfDay(new Date()),
                            );
                            const isAvailable = monthAvailability[dateStr] ?? false;
                            const hasLoadedAvailability = Object.keys(monthAvailability).length > 0;
                            const shouldDisable = isPast || (hasLoadedAvailability && !isAvailable);

                            return (
                              <button
                                key={date.toISOString()}
                                disabled={shouldDisable}
                                onClick={() => {
                                  setSelectedDate(date);
                                  setSelectedSlot(null);
                                }}
                                className={cn(
                                  "h-11 w-11 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200",
                                  isSelected
                                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                    : "hover:bg-accent hover:text-accent-foreground",
                                  isToday &&
                                    !isSelected &&
                                    "text-primary font-bold bg-primary/5",
                                  !shouldDisable && !isSelected && !isToday && "font-semibold text-foreground bg-accent/20",
                                  shouldDisable &&
                                    "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-inherit font-normal bg-transparent",
                                )}
                              >
                                {format(date, "d")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right-4 duration-300 max-w-md mx-auto w-full min-h-0">
                        <div className="flex items-center justify-between mb-6">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              if (selectedDate) {
                                const newDate = addDays(selectedDate, -1);
                                setSelectedDate(newDate);
                                setCurrentMonth(startOfMonth(newDate));
                                setSelectedSlot(null);
                              }
                            }}
                            disabled={isBefore(
                              startOfDay(
                                addDays(selectedDate || new Date(), -1),
                              ),
                              startOfDay(new Date()),
                            )}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <h3 className="font-semibold text-center text-lg">
                            {format(selectedDate, "eeee, MMMM d", {
                              locale: dateLocale,
                            })}
                          </h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              if (selectedDate) {
                                const newDate = addDays(selectedDate, 1);
                                setSelectedDate(newDate);
                                setCurrentMonth(startOfMonth(newDate));
                                setSelectedSlot(null);
                              }
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-0">
                          {isLoadingSlots ? (
                            <div className="grid grid-cols-2 gap-3 pb-4">
                              {Array.from({ length: 8 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="h-12 w-full rounded-full ring-1 ring-inset ring-input bg-background flex items-center justify-center shadow-sm"
                                >
                                  <Skeleton className="h-4 w-12 rounded-full" />
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
                            <div className="grid grid-cols-2 gap-3 pb-4">
                              {availableSlots.map((slot) => (
                                <Button
                                  key={slot}
                                  variant={
                                    selectedSlot === slot
                                      ? "default"
                                      : "outline"
                                  }
                                  className={cn(
                                    "w-full justify-center font-medium transition-all h-12",
                                    selectedSlot === slot
                                      ? "shadow-md"
                                      : "hover:border-primary/30 hover:bg-accent",
                                  )}
                                  onClick={() => setSelectedSlot(slot)}
                                >
                                  {slot}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  {selectedDate && step === "calendar" && (
                    <ActionFooter className="flex-col sm:flex-row items-center justify-between">
                      <div className="text-sm text-muted-foreground font-medium hidden sm:block">
                        {format(selectedDate, "MMMM do, yyyy", {
                          locale: dateLocale,
                        })}
                        {selectedSlot ? ` at ${selectedSlot}` : ""}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedDate(null);
                          setSelectedSlot(null);
                        }}
                        className="w-full sm:w-auto font-semibold shadow-sm"
                      >
                        {t("booking.back")}
                      </Button>
                      <Button
                          onClick={() => setStep("details")}
                          disabled={!selectedSlot}
                          className="w-full sm:w-auto font-semibold shadow-sm"
                        >
                          {t("booking.next")}
                        </Button>
                      </div>
                    </ActionFooter>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <CardContent className="p-6 space-y-6 flex-1 pt-4">
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
                        <Label
                          htmlFor="email"
                          className="text-sm font-semibold"
                        >
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
                        <Label
                          htmlFor="guests"
                          className="text-sm font-semibold"
                        >
                          {locale === "es"
                            ? "Invitados (separados por coma)"
                            : "Guests (comma separated)"}
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
                        <Label
                          htmlFor="notes"
                          className="text-sm font-semibold"
                        >
                          {t("booking.form.notes")}
                        </Label>
                        <Textarea
                          id="notes"
                          placeholder={t("booking.form.notesPlaceholder")}
                          className="resize-none min-h-[100px] bg-background"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                  <ActionFooter className="flex-col sm:flex-row items-center justify-between">
                    <div className="text-sm text-muted-foreground font-medium hidden sm:block">
                      {format(selectedDate!, "MMMM do, yyyy", {
                        locale: dateLocale,
                      })}{" "}
                      at {selectedSlot}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                      <Button
                        variant="outline"
                        onClick={() => setStep("calendar")}
                        className="w-full sm:w-auto font-semibold shadow-sm"
                        disabled={isSubmitting}
                        type="button"
                      >
                        {t("booking.back")}
                      </Button>
                      <Button
                        onClick={handleBook}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto font-semibold shadow-sm"
                      >
                        {isSubmitting
                          ? t("booking.booking")
                          : t("booking.confirm")}
                      </Button>
                    </div>
                  </ActionFooter>
                </div>
              )}
            </Card>

            <div className="flex items-center justify-between px-2">
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
          </div>
        </div>
      </div>
    </div>
  );
}
