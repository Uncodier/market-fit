"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

function eachUtcDateString(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let currentMs = Date.parse(`${startDate}T00:00:00.000Z`);
  const lastMs = Date.parse(`${endDate}T00:00:00.000Z`);
  while (currentMs <= lastMs) {
    dates.push(formatInTimeZone(currentMs, "UTC", "yyyy-MM-dd"));
    currentMs += 24 * 60 * 60 * 1000;
  }
  return dates;
}

function getSlotsForGuestDate(
  date: string, // yyyy-MM-dd
  guestTimezone: string,
  hostTimezone: string,
  availabilitySettings: any,
  effectiveDuration: number,
  effectiveBuffer: number,
  tasks: { scheduled_date: string }[]
): string[] {
  const guestStartUtc = fromZonedTime(`${date}T00:00:00`, guestTimezone);
  const guestEndUtc = fromZonedTime(`${date}T23:59:59`, guestTimezone);

  const hostStartStr = formatInTimeZone(guestStartUtc, hostTimezone, "yyyy-MM-dd");
  const hostEndStr = formatInTimeZone(guestEndUtc, hostTimezone, "yyyy-MM-dd");

  const hostDatesToTest = [hostStartStr];
  if (hostEndStr !== hostStartStr) {
    hostDatesToTest.push(hostEndStr);
  }

  // Pre-process tasks into busy periods in ms
  const busyPeriods = tasks.map((t) => {
    const startMs = new Date(t.scheduled_date).getTime();
    return {
      start: startMs,
      end: startMs + (effectiveDuration + effectiveBuffer) * 60000,
    };
  });

  const interval = effectiveDuration > 60 ? 60 : effectiveDuration;
  const candidatesSet = new Set<number>();
  const nowMs = Date.now();

  for (const hostDate of hostDatesToTest) {
    const dayOfWeek = formatInTimeZone(fromZonedTime(`${hostDate}T12:00:00`, hostTimezone), hostTimezone, "eeee").toLowerCase();
    const dayAvailability = availabilitySettings[dayOfWeek];

    if (!dayAvailability?.enabled || !dayAvailability.start || !dayAvailability.end) {
      continue;
    }

    const hostDayStartUtc = fromZonedTime(`${hostDate}T${dayAvailability.start}:00`, hostTimezone).getTime();
    const hostDayEndUtc = fromZonedTime(`${hostDate}T${dayAvailability.end}:00`, hostTimezone).getTime();

    // A. Generate standard grid slots
    let currentMs = hostDayStartUtc;
    while (currentMs < hostDayEndUtc) {
      const slotEndMs = currentMs + effectiveDuration * 60000;
      if (slotEndMs <= hostDayEndUtc) {
        candidatesSet.add(currentMs);
      }
      currentMs += interval * 60000;
    }

    // B. Generate slots immediately after busy periods
    for (const period of busyPeriods) {
      const nextSlotMs = period.end;
      const slotEndMs = nextSlotMs + effectiveDuration * 60000;
      if (nextSlotMs >= hostDayStartUtc && slotEndMs <= hostDayEndUtc) {
        candidatesSet.add(nextSlotMs);
      }
    }
  }

  // C. Filter candidates
  const slots: string[] = [];
  const sortedCandidates = Array.from(candidatesSet).sort((a, b) => a - b);

  for (const slotStartMs of sortedCandidates) {
    // Must be in the future
    if (slotStartMs < nowMs) continue;

    // Must belong to the guest's requested date
    if (slotStartMs < guestStartUtc.getTime() || slotStartMs > guestEndUtc.getTime()) {
      continue;
    }

    const slotEndMs = slotStartMs + effectiveDuration * 60000;

    let isBusy = false;
    for (const period of busyPeriods) {
      if (slotStartMs < period.end && slotEndMs > period.start) {
        isBusy = true;
        break;
      }
    }

    if (!isBusy) {
      slots.push(formatInTimeZone(slotStartMs, guestTimezone, "HH:mm"));
    }
  }

  return slots;
}

export async function getAvailableSlots(
  userId: string,
  date: string,
  duration: number,
  buffer: number,
  guestTimezone: string = "America/Mexico_City"
) {
  const supabase = await createServiceClient(true);

  // 1. Get user profile for availability settings
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  let availabilitySettings = profile?.settings?.calendar?.availability;
  let effectiveDuration = duration || profile?.settings?.calendar?.duration || 30;
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

      if (siteSettings?.business_hours && siteSettings.business_hours.length > 0) {
        // Use the first business hours found
        const bh = siteSettings.business_hours[0];
        availabilitySettings = bh.days;
      }
    }
  }

  if (!availabilitySettings) return [];

  // 3. Get existing tasks for that day
  const guestStartUtc = fromZonedTime(`${date}T00:00:00`, guestTimezone);
  const guestEndUtc = fromZonedTime(`${date}T23:59:59`, guestTimezone);
  const start = guestStartUtc.toISOString();
  const end = guestEndUtc.toISOString();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("scheduled_date")
    .eq("assignee", userId)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .neq("status", "failed");

  // 4. Generate slots
  const hostTimezone = profile?.settings?.calendar?.timezone || "America/Mexico_City";
  return getSlotsForGuestDate(
    date,
    guestTimezone,
    hostTimezone,
    availabilitySettings,
    effectiveDuration,
    effectiveBuffer,
    tasks || []
  );
}

export async function getMonthAvailability(
  userId: string,
  startDate: string,
  endDate: string,
  duration: number,
  buffer: number,
  guestTimezone: string = "America/Mexico_City"
) {
  const supabase = await createServiceClient(true);

  // 1. Get user profile for availability settings
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", userId)
    .single();

  let availabilitySettings = profile?.settings?.calendar?.availability;
  let effectiveDuration = duration || profile?.settings?.calendar?.duration || 30;
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

      if (siteSettings?.business_hours && siteSettings.business_hours.length > 0) {
        const bh = siteSettings.business_hours[0];
        availabilitySettings = bh.days;
      }
    }
  }

  if (!availabilitySettings) return {};

  // 3. Get existing tasks for the whole date range
  const guestStartUtc = fromZonedTime(`${startDate}T00:00:00`, guestTimezone);
  const guestEndUtc = fromZonedTime(`${endDate}T23:59:59`, guestTimezone);
  const start = guestStartUtc.toISOString();
  const end = guestEndUtc.toISOString();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("scheduled_date")
    .eq("assignee", userId)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .neq("status", "failed");

  const result: Record<string, boolean> = {};

  // 4. Iterate over each day and generate slots
  const hostTimezone = profile?.settings?.calendar?.timezone || "America/Mexico_City";

  for (const dateStr of eachUtcDateString(startDate, endDate)) {
    const slots = getSlotsForGuestDate(
      dateStr,
      guestTimezone,
      hostTimezone,
      availabilitySettings,
      effectiveDuration,
      effectiveBuffer,
      tasks || []
    );
    result[dateStr] = slots.length > 0;
  }

  return result;
}

export async function getRRAvailability(
  memberEmails: string[],
  date: string,
  duration: number,
  buffer: number,
  guestTimezone: string = "America/Mexico_City"
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
    const slots = await getAvailableSlots(profile.id, date, duration, buffer, guestTimezone);
    slots.forEach((slot) => allSlotsSet.add(slot));
  }

  return Array.from(allSlotsSet).sort();
}

export async function getRRMonthAvailability(
  memberEmails: string[],
  startDate: string,
  endDate: string,
  duration: number,
  buffer: number,
  guestTimezone: string = "America/Mexico_City"
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
      buffer,
      guestTimezone
    );
    
    // Merge into result
    for (const [date, isAvailable] of Object.entries(profileAvailability)) {
      result[date] = result[date] || isAvailable;
    }
  }

  return result;
}
