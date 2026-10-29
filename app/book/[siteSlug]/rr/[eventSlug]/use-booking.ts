"use client";
import { useState, useEffect, use, useRef, useSyncExternalStore, useId } from "react";
import { useSearchParams } from "next/navigation";
import { getRRCalendarBySlug, bookRRMeeting, getSiteInfoBySlug } from "@/app/book/actions";
import { getRRAvailability, getRRMonthAvailability } from "@/app/book/availability";
import { RoundRobinCalendar } from "@/app/context/SiteContext";
import { zonedMeetingRange } from "@/lib/calendar/invite";
import { format, startOfMonth, eachDayOfInterval, addDays } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { useTheme } from "@/app/context/ThemeContext";
import { useLocalization, SupportedLocale } from "@/app/context/LocalizationContext";
import { browserTimeZone, validTimeZone } from "@/lib/calendar/timezone";
const subscribeTimezone = () => () => { };
const serverTimezone = () => "America/Mexico_City";
export type BookingPageProps = {
    params: Promise<{
        siteSlug: string;
        eventSlug: string;
    }>;
    searchParams: Promise<{
        [key: string]: string | string[] | undefined;
    }>;
};
export function useBooking(props: BookingPageProps) {
    const params = use(props.params);
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
    const browserTimezone = useSyncExternalStore(subscribeTimezone, browserTimeZone, serverTimezone);
    const urlTz = searchParams.get("tz") || searchParams.get("timezone") || searchParams.get("region");
    const [timezoneOverride, setTimezoneOverride] = useState<{
        query: string | null;
        value: string;
    } | null>(null);
    const userTimezone = timezoneOverride?.query === urlTz
        ? timezoneOverride.value
        : validTimeZone(urlTz) ? urlTz : browserTimezone;
    const containerRef = useRef<HTMLDivElement>(null);
    const calendarRef = useRef<HTMLDivElement>(null);
    const timeRef = useRef<HTMLDivElement>(null);
    const detailsRef = useRef<HTMLDivElement>(null);
    const successRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth < 768) {
            if (activeStep === "calendar") {
                calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            else if (activeStep === "time") {
                timeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            else if (activeStep === "details") {
                detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            else if (activeStep === "success") {
                successRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    }, [activeStep]);
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
    const calendarUid = `${useId()}@uncodie.com`;
    const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
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
            let cancelled = false;
            async function loadSlots() {
                setIsLoadingSlots(true);
                const slots = await getRRAvailability(calendar!.member_ids, format(selectedDate!, "yyyy-MM-dd"), calendar!.duration, calendar!.buffer, userTimezone);
                if (cancelled)
                    return;
                setAvailableSlots(slots);
                setSelectedSlot((slot) => slot && slots.includes(slot) ? slot : null);
                setIsLoadingSlots(false);
            }
            loadSlots();
            return () => { cancelled = true; };
        }
    }, [selectedDate, calendar, userTimezone]);
    useEffect(() => {
        if (calendar && currentMonth) {
            let cancelled = false;
            async function loadMonthAvailability() {
                const firstDayOfMonth = startOfMonth(currentMonth).getDay();
                const startDate = addDays(startOfMonth(currentMonth), -firstDayOfMonth);
                const start = format(startDate, "yyyy-MM-dd");
                const end = format(addDays(startDate, 41), "yyyy-MM-dd");
                const availability = await getRRMonthAvailability(calendar!.member_ids, start, end, calendar!.duration, calendar!.buffer, userTimezone);
                if (!cancelled)
                    setMonthAvailability(availability);
            }
            loadMonthAvailability();
            return () => { cancelled = true; };
        }
    }, [currentMonth, calendar, userTimezone]);
    const firstDayOfMonth = startOfMonth(currentMonth).getDay();
    const startDate = addDays(startOfMonth(currentMonth), -firstDayOfMonth);
    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: addDays(startDate, 41),
    });
    const handleBook = async () => {
        if (!name || !email || !selectedDate || !selectedSlot || !calendar) {
            toast.error("Please fill in all required fields");
            return;
        }
        setIsSubmitting(true);
        try {
            // Extract custom URL parameters
            const metadata: Record<string, string> = {};
            const standardParams = ["embed", "tz", "timezone", "region", "theme", "tema", "locale", "lang", "idioma"];
            searchParams.forEach((value, key) => {
                if (!standardParams.includes(key)) {
                    metadata[key] = value;
                }
            });
            const result = await bookRRMeeting({
                calendarId: calendar.id,
                siteId: siteInfo?.id || "default",
                memberEmails: calendar.member_ids,
                date: format(selectedDate, "yyyy-MM-dd"),
                time: selectedSlot,
                timezone: userTimezone,
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
                duration: calendar.duration,
                metadata,
                locale,
            });
            if (result.task?.id) {
                setCreatedTaskId(result.task.id);
            }
            setActiveStep("success");
        }
        catch (error: unknown) {
            console.error(error);
            toast.error((error instanceof Error ? error.message : null) || "Failed to book meeting. Please try again.");
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const meetingRange = selectedDate && selectedSlot && calendar
        ? zonedMeetingRange({
            date: format(selectedDate, "yyyy-MM-dd"),
            time: selectedSlot,
            durationMins: calendar.duration,
            timeZone: userTimezone,
        })
        : null;
    const handleTimezoneChange = (timezone: string) => {
        if (!validTimeZone(timezone) || timezone === userTimezone)
            return;
        setTimezoneOverride({ query: urlTz, value: timezone });
        setSelectedSlot(null);
        setAvailableSlots([]);
        setIsLoadingSlots(Boolean(selectedDate));
        setActiveStep(selectedDate ? "time" : "calendar");
    };
    return { searchParams, siteSlug, eventSlug, isEmbed, theme, setTheme, locale, setLocale, t, dateLocale, calendar, setCalendar, siteInfo, setSiteInfo, isLoading, setIsLoading, isLoadingSlots, setIsLoadingSlots, currentMonth, setCurrentMonth, selectedDate, setSelectedDate, availableSlots, setAvailableSlots, monthAvailability, setMonthAvailability, selectedSlot, setSelectedSlot, activeStep, setActiveStep, userTimezone, containerRef, calendarRef, timeRef, detailsRef, successRef, name, setName, email, setEmail, guestsString, setGuestsString, notes, setNotes, isSubmitting, setIsSubmitting, createdTaskId, setCreatedTaskId, calendarUid, calendarDays, handleBook, meetingRange, handleTimezoneChange };
}
