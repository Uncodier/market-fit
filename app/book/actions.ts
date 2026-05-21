"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { ProfileData } from "@/app/services/profile.service"
import { RoundRobinCalendar } from "@/app/context/SiteContext"
import { addMinutes, format, parseISO, startOfDay, endOfDay, isAfter, isBefore, setHours, setMinutes } from "date-fns"

export async function getProfileBySlug(slug: string): Promise<ProfileData | null> {
  const supabase = await createServiceClient()
  
  // 1. Try to find by explicit calendar slug
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('settings->calendar->>slug', slug)
    .single()

  if (data && data.settings?.calendar?.enabled !== false) {
    return data as unknown as ProfileData
  }

  // 2. Try to find by ID if it's a valid UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  if (isUUID) {
    const { data: dataById } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', slug)
      .single()
    
    if (dataById) return dataById as unknown as ProfileData
  }

  // 3. Try to find by email prefix (fallback default slug)
  const { data: dataByEmail } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', `${slug}@%`)
    .limit(1)
    .single()

  if (dataByEmail) return dataByEmail as unknown as ProfileData

  return null
}

export async function getSiteInfoBySlug(siteSlug: string): Promise<{ id: string, name: string, logo_url: string | null } | null> {
  const supabase = await createServiceClient()
  
  // Search settings/sites for a name that matches the slug
  const { data: settings } = await supabase
    .from('settings')
    .select('site_id')
    .limit(100) // This is a bit inefficient but sites don't have slugs yet

  // Try to find by ID if it's a valid UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteSlug)
  
  const { data: sites } = await supabase
    .from('sites')
    .select('id, name, logo_url')
  
  if (isUUID) {
    const site = sites?.find(s => s.id === siteSlug)
    if (site) return site
  }

  // Fallback to searching by name
  const site = sites?.find(s => s.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') === siteSlug)
  return site || null
}

export async function getRRCalendarBySlug(slug: string, siteId?: string): Promise<{ calendar: RoundRobinCalendar, siteId: string } | null> {
  const supabase = await createServiceClient()
  let query = supabase
    .from('settings')
    .select('site_id, round_robin_calendars')
  
  if (siteId) {
    query = query.eq('site_id', siteId)
  }

  const { data, error } = await query.filter('round_robin_calendars', 'cs', `[{"slug": "${slug}"}]`).single()

  if (error || !data?.round_robin_calendars) {
    console.error('Error fetching RR calendar by slug:', error)
    return null
  }

  const calendar = (data.round_robin_calendars as RoundRobinCalendar[]).find(c => c.slug === slug)
  if (!calendar) return null

  return { calendar, siteId: data.site_id }
}

export async function getRRAvailability(memberEmails: string[], date: string, duration: number, buffer: number) {
  const supabase = await createServiceClient()
  
  // 1. Get all members' profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, settings')
    .in('email', memberEmails)
  
  if (!profiles || profiles.length === 0) return []
  
  // 2. For each profile, get slots and aggregate
  const allSlotsSet = new Set<string>()
  
  for (const profile of profiles) {
    const slots = await getAvailableSlots(profile.id, date, duration, buffer)
    slots.forEach(slot => allSlotsSet.add(slot))
  }
  
  return Array.from(allSlotsSet).sort()
}

export async function bookRRMeeting(data: {
  calendarId: string,
  siteId: string,
  memberEmails: string[],
  date: string,
  time: string,
  name: string,
  email: string,
  notes?: string,
  title: string
}) {
  const supabase = await createServiceClient()
  
  // 1. Find least busy member for that day
  const start = startOfDay(parseISO(date)).toISOString()
  const end = endOfDay(parseISO(date)).toISOString()
  
  // Get all members' user IDs
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', data.memberEmails)
  
  if (!profiles || profiles.length === 0) throw new Error("No members found")
  
  const memberIds = profiles.map(p => p.id)
  
  // Count tasks per member for that day
  const { data: taskCounts } = await supabase
    .from('tasks')
    .select('assignee')
    .in('assignee', memberIds)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
  
  const counts: Record<string, number> = {}
  memberIds.forEach(id => counts[id] = 0)
  taskCounts?.forEach(t => {
    if (t.assignee) counts[t.assignee] = (counts[t.assignee] || 0) + 1
  })
  
  // Pick member with least tasks
  const leastBusyId = memberIds.reduce((prev, curr) => counts[curr] < counts[prev] ? curr : prev)
  
  // 2. Book with that member
  return bookMeeting({
    userId: leastBusyId,
    siteId: data.siteId,
    date: data.date,
    time: data.time,
    name: data.name,
    email: data.email,
    notes: data.notes,
    title: data.title
  })
}

export async function getAvailableSlots(userId: string, date: string, duration: number, buffer: number) {
  const supabase = await createServiceClient()
  
  // 1. Get user profile for availability settings
  const { data: profile } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single()
  
  let availabilitySettings = profile?.settings?.calendar?.availability
  let effectiveDuration = duration || profile?.settings?.calendar?.duration || 30
  let effectiveBuffer = buffer || profile?.settings?.calendar?.buffer || 0

  // 2. Fallback to site business hours if user hasn't configured availability
  if (!availabilitySettings) {
    const { data: member } = await supabase
      .from('site_members')
      .select('site_id')
      .eq('user_id', userId)
      .limit(1)
      .single()
    
    if (member) {
      const { data: siteSettings } = await supabase
        .from('settings')
        .select('business_hours')
        .eq('site_id', member.site_id)
        .single()
      
      if (siteSettings?.business_hours && siteSettings.business_hours.length > 0) {
        // Use the first business hours found
        const bh = siteSettings.business_hours[0]
        availabilitySettings = bh.days
      }
    }
  }

  if (!availabilitySettings) return []
  
  const dayOfWeek = format(parseISO(date), 'eeee').toLowerCase()
  const dayAvailability = availabilitySettings[dayOfWeek]
  
  if (!dayAvailability?.enabled || !dayAvailability.start || !dayAvailability.end) return []
  
  // 3. Get existing tasks for that day
  const start = startOfDay(parseISO(date)).toISOString()
  const end = endOfDay(parseISO(date)).toISOString()
  
  const { data: tasks } = await supabase
    .from('tasks')
    .select('scheduled_date')
    .eq('assignee', userId)
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .neq('status', 'failed')
  
  // 4. Generate slots
  let interval = effectiveDuration
  if (effectiveDuration > 60) {
    interval = 60
  }
  
  const [startH, startM] = dayAvailability.start.split(':').map(Number)
  const [endH, endM] = dayAvailability.end.split(':').map(Number)
  
  const dayStart = setMinutes(setHours(parseISO(date), startH), startM)
  const dayEnd = setMinutes(setHours(parseISO(date), endH), endM)
  
  const busyTasks = (tasks || []).map(t => new Date(t.scheduled_date))
  const busyPeriods = busyTasks.map(busyStart => ({
    start: busyStart,
    end: addMinutes(busyStart, effectiveDuration + effectiveBuffer)
  }))
  
  const candidatesSet = new Set<number>()
  
  // A. Generate standard grid slots
  let current = dayStart
  while (isBefore(current, dayEnd)) {
    const slotEnd = addMinutes(current, effectiveDuration)
    if (isBefore(slotEnd, dayEnd) || isSameTime(slotEnd, dayEnd)) {
      candidatesSet.add(current.getTime())
    }
    current = addMinutes(current, interval)
  }
  
  // B. Generate slots immediately after busy periods
  for (const period of busyPeriods) {
    const nextSlot = period.end
    const slotEnd = addMinutes(nextSlot, effectiveDuration)
    if ((isBefore(nextSlot, dayEnd) || isSameTime(nextSlot, dayEnd)) &&
        (isBefore(slotEnd, dayEnd) || isSameTime(slotEnd, dayEnd))) {
      candidatesSet.add(nextSlot.getTime())
    }
  }
  
  // C. Filter candidates
  const slots: string[] = []
  const sortedCandidates = Array.from(candidatesSet).sort((a, b) => a - b)
  
  for (const time of sortedCandidates) {
    const slotStart = new Date(time)
    const slotEnd = addMinutes(slotStart, effectiveDuration)
    
    // Check if slot is in the past (if date is today)
    if (isBefore(slotStart, new Date())) {
      continue
    }
    
    // Check for overlap with busy periods
    let isBusy = false
    for (const period of busyPeriods) {
      // Overlap condition: slotStart < period.end && slotEnd > period.start
      if (isBefore(slotStart, period.end) && isAfter(slotEnd, period.start)) {
        isBusy = true
        break
      }
    }
    
    if (!isBusy) {
      slots.push(format(slotStart, "HH:mm"))
    }
  }
  
  return slots
}

function isSameTime(d1: Date, d2: Date) {
  return d1.getTime() === d2.getTime()
}

export async function bookMeeting(data: {
  userId: string,
  siteId: string,
  date: string, // YYYY-MM-DD
  time: string, // HH:mm
  name: string,
  email: string,
  notes?: string,
  title: string
}) {
  const supabase = await createServiceClient()
  
  // 1. Find Site if default
  let siteId = data.siteId
  if (siteId === "default") {
    const { data: member } = await supabase
      .from('site_members')
      .select('site_id')
      .eq('user_id', data.userId)
      .limit(1)
      .single()
    
    if (member) {
      siteId = member.site_id
    } else {
      // Fallback: search for any site where this user might be an owner or admin
      const { data: site } = await supabase
        .from('settings')
        .select('site_id')
        .limit(1)
        .single()
      siteId = site?.site_id || ""
    }
  }

  // 2. Find or Create Lead
  let { data: lead } = await supabase
    .from('leads')
    .select('id')
    .eq('email', data.email)
    .eq('site_id', siteId)
    .single()
  
  if (!lead) {
    const { data: newLead, error: leadError } = await supabase
      .from('leads')
      .insert({
        name: data.name,
        email: data.email,
        site_id: siteId,
        user_id: data.userId, // Attributed to the calendar owner
        status: 'new',
        origin: 'Public Booking'
      })
      .select('id')
      .single()
    
    if (leadError) throw leadError
    lead = newLead
  }
  
  // 3. Create Task
  const scheduledDate = parseISO(`${data.date}T${data.time}:00`)
  
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      title: data.title,
      description: data.notes || `Meeting booked via public page by ${data.name} (${data.email})`,
      status: 'pending',
      scheduled_date: scheduledDate.toISOString(),
      assignee: data.userId,
      site_id: siteId,
      lead_id: lead?.id,
      user_id: data.userId
    })
    .select()
    .single()
  
  if (taskError) throw taskError
  
  return { success: true, task }
}
