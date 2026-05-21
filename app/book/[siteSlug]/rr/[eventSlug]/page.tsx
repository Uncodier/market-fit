"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { getRRCalendarBySlug, getRRAvailability, bookRRMeeting, getSiteInfoBySlug } from "@/app/book/actions"
import { RoundRobinCalendar } from "@/app/context/SiteContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { CalendarIcon, Clock, ChevronLeft, ChevronRight, CheckCircle2, Users, Globe, Sun, Moon } from "@/app/components/ui/icons"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addDays, isBefore, startOfDay, parseISO } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization, SupportedLocale } from "@/app/context/LocalizationContext"

export default function RoundRobinBookingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const siteSlug = params.siteSlug as string
  const eventSlug = params.eventSlug as string
  const isEmbed = searchParams.get('embed') === 'true'

  const { theme, setTheme } = useTheme()
  const { locale, setLocale, t } = useLocalization()
  const dateLocale = locale === 'es' ? es : enUS

  const [calendar, setCalendar] = useState<RoundRobinCalendar | null>(null)
  const [siteInfo, setSiteInfo] = useState<{ id: string, name: string, logo_url: string | null } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [step, setStep] = useState<'calendar' | 'details' | 'success'>('calendar')
  const [userTimezone, setUserTimezone] = useState<string>("America/Mexico_City")

  useEffect(() => {
    if (typeof Intl !== 'undefined') {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    }
  }, [])
  
  // Form state
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      const sInfo = await getSiteInfoBySlug(siteSlug)
      if (sInfo) {
        setSiteInfo(sInfo)
        const data = await getRRCalendarBySlug(eventSlug, sInfo.id)
        if (data) {
          setCalendar(data.calendar)
        }
      }
      setIsLoading(false)
    }
    loadData()
  }, [siteSlug, eventSlug])

  useEffect(() => {
    if (selectedDate && calendar) {
      async function loadSlots() {
        setIsLoadingSlots(true)
        const slots = await getRRAvailability(
          calendar!.member_ids, 
          format(selectedDate!, "yyyy-MM-dd"),
          calendar!.duration,
          calendar!.buffer
        )
        setAvailableSlots(slots)
        setIsLoadingSlots(false)
      }
      loadSlots()
    }
  }, [selectedDate, calendar])

  if (isLoading) {
    return (
      <div className={cn("bg-background", !isEmbed && "min-h-screen flex items-center justify-center p-4")}>
        <div className="max-w-4xl w-full mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-20 w-20 rounded-full" />
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
                        <Skeleton key={i} className="h-11 w-11 mx-auto rounded-full" />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!calendar) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold">{t('booking.notFound.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('booking.notFound.desc')}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const firstDayOfMonth = startOfMonth(currentMonth).getDay()
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => {
    return addDays(startOfMonth(currentMonth), - (firstDayOfMonth - i))
  })

  const handleBook = async () => {
    if (!name || !email || !selectedDate || !selectedSlot) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    try {
      await bookRRMeeting({
        calendarId: calendar.id,
        siteId: siteInfo?.id || "default",
        memberEmails: calendar.member_ids,
        date: format(selectedDate, "yyyy-MM-dd"),
        time: selectedSlot,
        name,
        email,
        notes,
        title: `${calendar.name} with ${name}`
      })
      setStep('success')
    } catch (error) {
      console.error(error)
      toast.error("Failed to book meeting. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (step === 'success') {
    return (
      <div className={cn("flex items-center justify-center", !isEmbed && "min-h-screen p-4")}>
        <Card className="max-w-md w-full">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">{t('booking.success.title')}</h1>
            <p className="text-muted-foreground">
              {t('booking.success.descRR')}
            </p>
            <div className="pt-4 border-t border-border mt-6 text-left space-y-2">
              <p className="text-sm"><strong>{t('booking.details.date')}:</strong> {format(selectedDate!, "MMMM do, yyyy", { locale: dateLocale })}</p>
              <p className="text-sm"><strong>{t('booking.details.time')}:</strong> {selectedSlot}</p>
              <p className="text-sm"><strong>{t('booking.details.type')}:</strong> {calendar.name}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("bg-background", !isEmbed && "min-h-screen flex items-center justify-center p-4")}>
      <div className="max-w-4xl w-full mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6 flex flex-col justify-center">
            {siteInfo && (
              <div className="flex items-center gap-3 mb-4">
                {siteInfo.logo_url ? (
                  <img src={siteInfo.logo_url} alt={siteInfo.name} className="h-8 w-8 object-contain" />
                ) : (
                  <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">{siteInfo.name.charAt(0)}</span>
                  </div>
                )}
                <span className="font-semibold text-lg">{siteInfo.name}</span>
              </div>
            )}
            <div className="space-y-4">
              <div className="h-16 w-16 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                <Users className="h-7 w-7 text-primary/80" />
              </div>
              <div>
                <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  Team Meeting
                </h2>
                <h1 className="text-2xl font-semibold mt-1">
                  {calendar.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-medium text-sm">{calendar.duration} min</span>
              </div>
              {calendar.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {calendar.description}
                </p>
              )}
            </div>

            <div className="pt-4 border-t dark:border-white/5 border-black/5 flex items-center justify-between">
              <Select value={userTimezone} onValueChange={setUserTimezone}>
                <SelectTrigger className="w-fit bg-transparent border-none shadow-none focus:ring-0 px-0 h-auto text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <SelectValue placeholder={t('booking.timezone.select')} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([
                    "America/Los_Angeles",
                    "America/Denver",
                    "America/Chicago",
                    "America/New_York",
                    "America/Mexico_City",
                    "Europe/London",
                    "Europe/Madrid",
                    "Asia/Tokyo",
                    userTimezone
                  ])).map(tz => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>

                <div className="h-3 w-[1px] bg-border/40" />

                <Select value={locale} onValueChange={(v) => setLocale(v as SupportedLocale)}>
                  <SelectTrigger className="w-fit bg-transparent border-none shadow-none focus:ring-0 px-0 h-auto text-sm font-medium hover:text-foreground text-muted-foreground transition-colors">
                    <div className="flex items-center gap-1">
                      <SelectValue placeholder={t('booking.language')} />
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

          <div className="md:col-span-2">
            <Card className="border dark:border-white/5 border-black/5 shadow-sm overflow-hidden h-[540px] flex flex-col">
              {step === 'calendar' ? (
                <div className="flex-1 flex flex-col min-h-0">
                <CardContent className="p-6 flex-1 flex flex-col min-h-0">
                  {!selectedDate ? (
                    <div className="flex-1 flex flex-col animate-in fade-in duration-300 max-w-md mx-auto w-full">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg">{format(currentMonth, "MMMM yyyy", { locale: dateLocale })}</h3>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center mb-4">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                          <div key={idx} className="text-[11px] font-bold text-muted-foreground uppercase py-2">
                            {d}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-4 gap-x-1">
                        {paddingDays.map((date, i) => (
                          <div key={`padding-${i}`} className="h-11" />
                        ))}
                        {days.map((date) => {
                          const isSelected = selectedDate && isSameDay(date, selectedDate)
                          const isToday = isSameDay(date, new Date())
                          const isPast = isBefore(startOfDay(date), startOfDay(new Date()))
                          
                          return (
                            <button
                              key={date.toISOString()}
                              disabled={isPast}
                              onClick={() => {
                                setSelectedDate(date)
                                setSelectedSlot(null)
                              }}
                              className={cn(
                                "h-11 w-11 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200",
                                isSelected ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "hover:bg-accent hover:text-accent-foreground",
                                isToday && !isSelected && "text-primary font-bold bg-primary/5",
                                isPast && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-inherit font-normal"
                              )}
                            >
                              {format(date, "d")}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right-4 duration-300 max-w-md mx-auto w-full min-h-0">
                      <div className="flex items-center gap-2 mb-4">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(null); setSelectedSlot(null); }} className="-ml-2 hover:bg-accent">
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          {t('booking.back')}
                        </Button>
                      </div>
                      
                      <h3 className="font-semibold mb-6 text-center text-lg">
                        {format(selectedDate, "eeee, MMMM d", { locale: dateLocale })}
                      </h3>
                      
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-0">
                        {isLoadingSlots ? (
                          <div className="grid grid-cols-2 gap-3 pb-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <Skeleton key={i} className="h-12 w-full rounded-xl" />
                            ))}
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 pb-8">
                            <Clock className="h-8 w-8 text-muted-foreground/30" />
                            <p className="text-muted-foreground">{t('booking.noAvailability')}</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 pb-4">
                            {availableSlots.map(slot => (
                              <Button
                                key={slot}
                                variant="outline"
                                className={cn(
                                  "w-full justify-center font-medium transition-all rounded-xl border h-12",
                                  selectedSlot === slot 
                                    ? "border-primary bg-primary/5 text-primary shadow-sm" 
                                    : "hover:border-primary/30"
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
                {selectedDate && step === 'calendar' && (
                  <ActionFooter className="flex-col sm:flex-row items-center justify-between">
                    <div className="text-sm text-muted-foreground font-medium hidden sm:block">
                      {format(selectedDate, "MMMM do, yyyy", { locale: dateLocale })}
                      {selectedSlot ? ` at ${selectedSlot}` : ''}
                    </div>
                    <Button 
                      onClick={() => setStep('details')}
                      disabled={!selectedSlot}
                      className="w-full sm:w-auto font-semibold shadow-sm"
                    >
                      {t('booking.next')}
                    </Button>
                  </ActionFooter>
                )}
              </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <CardContent className="p-6 space-y-6 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep('calendar')} className="-ml-2 hover:bg-accent">
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {t('booking.back')}
                    </Button>
                  </div>
                  
                  <div className="space-y-5">
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-sm font-semibold">{t('booking.form.name')}</Label>
                      <Input 
                        id="name" 
                        placeholder="John Doe" 
                        className="h-12 bg-background"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-sm font-semibold">{t('booking.form.email')}</Label>
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
                      <Label htmlFor="notes" className="text-sm font-semibold">{t('booking.form.notes')}</Label>
                      <Textarea 
                        id="notes" 
                        placeholder={t('booking.form.notesPlaceholder')}
                        className="resize-none min-h-[100px] bg-background"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
                <ActionFooter className="flex-col sm:flex-row items-center justify-between">
                  <div className="text-sm text-muted-foreground font-medium hidden sm:block">
                    {format(selectedDate!, "MMMM do, yyyy", { locale: dateLocale })} at {selectedSlot}
                  </div>
                  <Button 
                    onClick={handleBook}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto font-semibold shadow-sm"
                  >
                    {isSubmitting ? t('booking.booking') : t('booking.confirm')}
                  </Button>
                </ActionFooter>
              </div>
            )}
          </Card>
        </div>
        </div>
      </div>
    </div>
  )
}
