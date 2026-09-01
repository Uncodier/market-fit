"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { ProfileData } from "@/app/services/profile.service";
import type { RoundRobinCalendar } from "@/app/context/SiteContext";
import {
  addMinutes,
  format,
  parseISO,
  startOfDay,
  endOfDay,
  isAfter,
  isBefore,
  setHours,
  setMinutes,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";

import { sendBookingConfirmationEmail } from "./send-booking-email";
import { zonedMeetingRange } from "@/lib/calendar/invite";
import { formatInTimeZone } from "date-fns-tz";

export async function getProfileBySlug(
  slug: string,
): Promise<ProfileData | null> {
  const supabase = await createServiceClient(true);

  // 1. Try to find by explicit calendar slug
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("settings->calendar->>slug", slug)
    .single();

  if (data && data.settings?.calendar?.enabled !== false) {
    return data as unknown as ProfileData;
  }

  // 2. Try to find by ID if it's a valid UUID
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      slug,
    );
  if (isUUID) {
    const { data: dataById } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", slug)
      .single();

    if (dataById) return dataById as unknown as ProfileData;
  }

  // 3. Try to find by email prefix (fallback default slug)
  const { data: dataByEmail } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", `${slug}@%`)
    .limit(1)
    .single();

  if (dataByEmail) return dataByEmail as unknown as ProfileData;

  return null;
}

import { resolveSiteInfoBySlug } from "./site-by-slug";

export async function getSiteInfoBySlug(siteSlug: string) {
  return resolveSiteInfoBySlug(siteSlug);
}

export async function getRRCalendarBySlug(
  slug: string,
  siteId?: string,
): Promise<{ calendar: RoundRobinCalendar; siteId: string } | null> {
  const supabase = await createServiceClient(true);
  let query = supabase
    .from("settings")
    .select("site_id, calendars");

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  const { data, error } = await query
    .filter("calendars", "cs", `[{"slug": "${slug}"}]`)
    .single();

  if (error || !data?.calendars) {
    console.error("Error fetching RR calendar by slug:", error);
    return null;
  }

  const calendar = (data.calendars as RoundRobinCalendar[]).find(
    (c) => c.slug === slug,
  );
  if (!calendar) return null;

  return { calendar, siteId: data.site_id };
}

export async function getRRAvailability(
  memberEmails: string[],
  date: string,
  duration: number,
  buffer: number,
) {
  const supabase = await createServiceClient(true);

  // 1. Get all members' profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, settings")
    .in("email", memberEmails);

  if (!profiles || profiles.length === 0) return [];

  // 2. For each profile, get slots and aggregate
  const allSlotsSet = new Set<string>();

  for (const profile of profiles) {
    const slots = await getAvailableSlots(profile.id, date, duration, buffer);
    slots.forEach((slot) => allSlotsSet.add(slot));
  }

  return Array.from(allSlotsSet).sort();
}

export async function bookRRMeeting(data: {
  calendarId: string;
  siteId: string;
  memberEmails: string[];
  date: string;
  time: string;
  timezone: string;
  name: string;
  email: string;
  guests?: string[];
  notes?: string;
  location?: string;
  title: string;
  duration?: number;
  metadata?: Record<string, string>;
  locale?: string;
}) {
  const supabase = await createServiceClient(true);

  // 1. Find least busy member for that day
  const start = startOfDay(parseISO(data.date)).toISOString();
  const end = endOfDay(parseISO(data.date)).toISOString();

  // Get all members' user IDs
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("email", data.memberEmails);

  if (!profiles || profiles.length === 0) throw new Error("No members found");

  const memberIds = profiles.map((p) => p.id);

  // Count tasks per member for that day
  const { data: taskCounts } = await supabase
    .from("tasks")
    .select("assignee")
    .in("assignee", memberIds)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end);

  const counts: Record<string, number> = {};
  memberIds.forEach((id) => (counts[id] = 0));
  taskCounts?.forEach((t) => {
    if (t.assignee) counts[t.assignee] = (counts[t.assignee] || 0) + 1;
  });

  // Pick member with least tasks
  const leastBusyId = memberIds.reduce((prev, curr) =>
    counts[curr] < counts[prev] ? curr : prev,
  );

  // 2. Book with that member
  return bookMeeting({
    userId: leastBusyId,
    siteId: data.siteId,
    date: data.date,
    time: data.time,
    timezone: data.timezone,
    name: data.name,
    email: data.email,
    guests: data.guests,
    notes: data.notes,
    location: data.location,
    title: data.title,
    duration: data.duration,
    metadata: data.metadata,
    locale: data.locale,
  });
}

export async function getMonthAvailability(
  userId: string,
  startDate: string,
  endDate: string,
  duration: number,
  buffer: number,
) {
  const supabase = await createServiceClient(true);

  // 1. Get user profile for availability settings
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  let availabilitySettings = profile?.settings?.calendar?.availability;
  let effectiveDuration =
    duration || profile?.settings?.calendar?.duration || 30;
  let effectiveBuffer = buffer || profile?.settings?.calendar?.buffer || 0;

  // 2. Fallback to site business hours if user hasn't configured availability
  if (!availabilitySettings) {
    const { data: member } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (member) {
      const { data: siteSettings } = await supabase
        .from("settings")
        .select("business_hours")
        .eq("site_id", member.site_id)
        .single();

      if (
        siteSettings?.business_hours &&
        siteSettings.business_hours.length > 0
      ) {
        const bh = siteSettings.business_hours[0];
        availabilitySettings = bh.days;
      }
    }
  }

  if (!availabilitySettings) return {};

  // 3. Get existing tasks for the whole date range
  const start = startOfDay(parseISO(startDate)).toISOString();
  const end = endOfDay(parseISO(endDate)).toISOString();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("scheduled_date")
    .eq("assignee", userId)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .neq("status", "failed");

  const result: Record<string, boolean> = {};

  // 4. Iterate over each day and generate slots
  const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

  for (const dateObj of days) {
    const dateStr = format(dateObj, "yyyy-MM-dd");
    const dayOfWeek = format(dateObj, "eeee").toLowerCase();
    const dayAvailability = availabilitySettings[dayOfWeek];

    if (
      !dayAvailability?.enabled ||
      !dayAvailability.start ||
      !dayAvailability.end ||
      isBefore(startOfDay(dateObj), startOfDay(new Date()))
    ) {
      result[dateStr] = false;
      continue;
    }

    let interval = effectiveDuration;
    if (effectiveDuration > 60) {
      interval = 60;
    }

    const [startH, startM] = dayAvailability.start.split(":").map(Number);
    const [endH, endM] = dayAvailability.end.split(":").map(Number);

    const dayStart = setMinutes(setHours(dateObj, startH), startM);
    const dayEnd = setMinutes(setHours(dateObj, endH), endM);

    // Filter tasks for this day
    const dayTasks = (tasks || []).filter(t => {
      const taskDate = new Date(t.scheduled_date);
      return isSameDay(taskDate, dateObj);
    });

    const busyTasks = dayTasks.map((t) => new Date(t.scheduled_date));
    const busyPeriods = busyTasks.map((busyStart) => ({
      start: busyStart,
      end: addMinutes(busyStart, effectiveDuration + effectiveBuffer),
    }));

    const candidatesSet = new Set<number>();

    // A. Generate standard grid slots
    let current = dayStart;
    while (isBefore(current, dayEnd)) {
      const slotEnd = addMinutes(current, effectiveDuration);
      if (isBefore(slotEnd, dayEnd) || isSameTime(slotEnd, dayEnd)) {
        candidatesSet.add(current.getTime());
      }
      current = addMinutes(current, interval);
    }

    // B. Generate slots immediately after busy periods
    for (const period of busyPeriods) {
      const nextSlot = period.end;
      const slotEnd = addMinutes(nextSlot, effectiveDuration);
      if (
        (isBefore(nextSlot, dayEnd) || isSameTime(nextSlot, dayEnd)) &&
        (isBefore(slotEnd, dayEnd) || isSameTime(slotEnd, dayEnd))
      ) {
        candidatesSet.add(nextSlot.getTime());
      }
    }

    // C. Check if there's at least one available slot
    let hasAvailability = false;
    const sortedCandidates = Array.from(candidatesSet).sort((a, b) => a - b);

    for (const time of sortedCandidates) {
      const slotStart = new Date(time);
      const slotEnd = addMinutes(slotStart, effectiveDuration);

      if (isBefore(slotStart, new Date())) {
        continue;
      }

      let isBusy = false;
      for (const period of busyPeriods) {
        if (isBefore(slotStart, period.end) && isAfter(slotEnd, period.start)) {
          isBusy = true;
          break;
        }
      }

      if (!isBusy) {
        hasAvailability = true;
        break;
      }
    }

    result[dateStr] = hasAvailability;
  }

  return result;
}

export async function getRRMonthAvailability(
  memberEmails: string[],
  startDate: string,
  endDate: string,
  duration: number,
  buffer: number,
) {
  const supabase = await createServiceClient(true);

  // 1. Get all members' profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, settings")
    .in("email", memberEmails);

  if (!profiles || profiles.length === 0) return {};

  const result: Record<string, boolean> = {};

  // For each profile, get month availability and OR them together
  for (const profile of profiles) {
    const profileAvailability = await getMonthAvailability(
      profile.id,
      startDate,
      endDate,
      duration,
      buffer
    );
    
    // Merge into result
    for (const [date, isAvailable] of Object.entries(profileAvailability)) {
      result[date] = result[date] || isAvailable;
    }
  }

  return result;
}

export async function getAvailableSlots(
  userId: string,
  date: string,
  duration: number,
  buffer: number,
) {
  const supabase = await createServiceClient(true);

  // 1. Get user profile for availability settings
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  let availabilitySettings = profile?.settings?.calendar?.availability;
  let effectiveDuration =
    duration || profile?.settings?.calendar?.duration || 30;
  let effectiveBuffer = buffer || profile?.settings?.calendar?.buffer || 0;

  // 2. Fallback to site business hours if user hasn't configured availability
  if (!availabilitySettings) {
    const { data: member } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (member) {
      const { data: siteSettings } = await supabase
        .from("settings")
        .select("business_hours")
        .eq("site_id", member.site_id)
        .single();

      if (
        siteSettings?.business_hours &&
        siteSettings.business_hours.length > 0
      ) {
        // Use the first business hours found
        const bh = siteSettings.business_hours[0];
        availabilitySettings = bh.days;
      }
    }
  }

  if (!availabilitySettings) return [];

  const dayOfWeek = format(parseISO(date), "eeee").toLowerCase();
  const dayAvailability = availabilitySettings[dayOfWeek];

  if (
    !dayAvailability?.enabled ||
    !dayAvailability.start ||
    !dayAvailability.end
  )
    return [];

  // 3. Get existing tasks for that day
  const start = startOfDay(parseISO(date)).toISOString();
  const end = endOfDay(parseISO(date)).toISOString();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("scheduled_date")
    .eq("assignee", userId)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .neq("status", "failed");

  // 4. Generate slots
  let interval = effectiveDuration;
  if (effectiveDuration > 60) {
    interval = 60;
  }

  const [startH, startM] = dayAvailability.start.split(":").map(Number);
  const [endH, endM] = dayAvailability.end.split(":").map(Number);

  const dayStart = setMinutes(setHours(parseISO(date), startH), startM);
  const dayEnd = setMinutes(setHours(parseISO(date), endH), endM);

  const busyTasks = (tasks || []).map((t) => new Date(t.scheduled_date));
  const busyPeriods = busyTasks.map((busyStart) => ({
    start: busyStart,
    end: addMinutes(busyStart, effectiveDuration + effectiveBuffer),
  }));

  const candidatesSet = new Set<number>();

  // A. Generate standard grid slots
  let current = dayStart;
  while (isBefore(current, dayEnd)) {
    const slotEnd = addMinutes(current, effectiveDuration);
    if (isBefore(slotEnd, dayEnd) || isSameTime(slotEnd, dayEnd)) {
      candidatesSet.add(current.getTime());
    }
    current = addMinutes(current, interval);
  }

  // B. Generate slots immediately after busy periods
  for (const period of busyPeriods) {
    const nextSlot = period.end;
    const slotEnd = addMinutes(nextSlot, effectiveDuration);
    if (
      (isBefore(nextSlot, dayEnd) || isSameTime(nextSlot, dayEnd)) &&
      (isBefore(slotEnd, dayEnd) || isSameTime(slotEnd, dayEnd))
    ) {
      candidatesSet.add(nextSlot.getTime());
    }
  }

  // C. Filter candidates
  const slots: string[] = [];
  const sortedCandidates = Array.from(candidatesSet).sort((a, b) => a - b);

  for (const time of sortedCandidates) {
    const slotStart = new Date(time);
    const slotEnd = addMinutes(slotStart, effectiveDuration);

    // Check if slot is in the past (if date is today)
    if (isBefore(slotStart, new Date())) {
      continue;
    }

    // Check for overlap with busy periods
    let isBusy = false;
    for (const period of busyPeriods) {
      // Overlap condition: slotStart < period.end && slotEnd > period.start
      if (isBefore(slotStart, period.end) && isAfter(slotEnd, period.start)) {
        isBusy = true;
        break;
      }
    }

    if (!isBusy) {
      slots.push(format(slotStart, "HH:mm"));
    }
  }

  return slots;
}

function isSameTime(d1: Date, d2: Date) {
  return d1.getTime() === d2.getTime();
}

export async function bookMeeting(data: {
  userId: string;
  siteId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timezone?: string; // e.g. America/Mexico_City
  name: string;
  email: string;
  guests?: string[];
  notes?: string;
  location?: string;
  title: string;
  duration?: number;
  metadata?: Record<string, string>;
  locale?: string;
}) {
  const supabase = await createServiceClient(true);

  // 1. Find Site if default
  let siteId = data.siteId;
  if (siteId === "default") {
    const { data: member } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("user_id", data.userId)
      .limit(1)
      .single();

    if (member) {
      siteId = member.site_id;
    } else {
      // Fallback: search for any site where this user might be an owner or admin
      const { data: site } = await supabase
        .from("settings")
        .select("site_id")
        .limit(1)
        .single();
      siteId = site?.site_id || "";
    }
  }

  // 2. Find or Create Lead
  const safeEmail = data.email.trim();
  const safeName = data.name.trim();

  let { data: lead } = await supabase
    .from("leads")
    .select("id, metadata, name")
    .eq("email", safeEmail)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lead) {
    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: safeName,
        email: safeEmail,
        site_id: siteId,
        user_id: data.userId, // Attributed to the calendar owner
        status: "new",
        origin: "Public Booking",
        metadata: data.metadata || {},
      })
      .select("id, metadata, name")
      .maybeSingle();

    if (leadError) {
      if (leadError.code === "23505") { // Unique violation
        // Refetch in case it was created concurrently
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id, metadata, name")
          .eq("email", safeEmail)
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (existingLead) {
          lead = existingLead;
        } else {
          throw new Error(leadError.message || "Failed to book meeting. Please try again.");
        }
      } else {
        throw new Error(leadError.message || "Failed to book meeting. Please try again.");
      }
    } else {
      lead = newLead;
    }
  }
  
  if (lead) {
    const updates: any = {};
    let needsUpdate = false;
    
    if (data.metadata && Object.keys(data.metadata).length > 0) {
      const existingMetadata = lead.metadata || {};
      updates.metadata = { ...existingMetadata, ...data.metadata };
      needsUpdate = true;
    }

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", lead.id);
        
      if (updateError) console.error("Error updating lead metadata:", updateError);
    }
  }

  // 3. Create Task
  const scheduledDate = parseISO(`${data.date}T${data.time}:00`);

  const taskNotes = (data.notes || `Meeting booked via public page by ${safeName} (${safeEmail})`) +
    (data.guests && data.guests.length > 0 ? `\n\nAttendees: ${[safeEmail, ...data.guests].join(', ')}` : '') +
    (data.location ? `\n\nLocation / Meeting Room: ${data.location}` : '');
    
  let endDateIso = undefined
  let durationMins = 30
  if (data.duration) {
     durationMins = data.duration
  } else if (data.metadata?.duration) {
     const minMatch = data.metadata.duration.match(/(\d+)\s*min/i);
     const hrMatch = data.metadata.duration.match(/(\d+)\s*hour/i);
     if (minMatch) durationMins = parseInt(minMatch[1]);
     else if (hrMatch) durationMins = parseInt(hrMatch[1]) * 60;
  }
  
  const endObj = new Date(scheduledDate.getTime() + (durationMins * 60000))
  endDateIso = endObj.toISOString()

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: data.title,
      type: "meeting",
      stage: "decision",
      description: taskNotes,
      metadata: {
        _calendar_context: {
          origin: "book",
          catalog_item_name: data.title,
          duration: `${durationMins} min`,
          end_time: endDateIso,
          location: data.location || null,
          ...(data.metadata || {})
        }
      },
      status: "pending",
      scheduled_date: scheduledDate.toISOString(),
      assignee: data.userId,
      site_id: siteId,
      lead_id: lead?.id,
      user_id: data.userId,
    })
    .select()
    .single();

  if (taskError) throw new Error(taskError.message || "Failed to book meeting. Please try again.");

  // Send confirmation email (never fail the booking if mail fails)
  try {
    const timeZone = data.timezone || "America/Mexico_City";
    const { start, end } = zonedMeetingRange({
      date: data.date,
      time: data.time,
      durationMins,
      timeZone,
    });

    const { data: hostProfile } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", data.userId)
      .maybeSingle();
    const { data: siteInfo } = await supabase
      .from("sites")
      .select("name, logo_url")
      .eq("id", siteId)
      .maybeSingle();

    const dateStr = formatInTimeZone(start, timeZone, "MMMM d, yyyy");
    const timeStr = formatInTimeZone(start, timeZone, "HH:mm");

    await sendBookingConfirmationEmail({
      toEmail: safeEmail,
      toName: safeName,
      ccEmails: data.guests,
      bccEmail: hostProfile?.email,
      hostName: hostProfile?.name || hostProfile?.email || "Host",
      siteName: siteInfo?.name || "Makinari",
      siteLogoUrl: siteInfo?.logo_url,
      eventName: data.title,
      dateStr,
      timeStr,
      timezone: timeZone,
      location: data.location,
      calendarEvent: {
        title: data.title,
        description: taskNotes,
        location: data.location,
        start,
        end,
        uid: `${task.id}@uncodie.com`,
        organizer: hostProfile?.email,
        attendees: [safeEmail, ...(data.guests || [])],
      },
      locale: data.locale,
    });
  } catch (error) {
    console.error("[bookMeeting] Error sending confirmation email:", error);
  }

  return { success: true, task };
}
