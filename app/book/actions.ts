"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { ProfileData } from "@/app/services/profile.service";
import type { RoundRobinCalendar } from "@/app/context/SiteContext";
import { sendBookingConfirmationEmail } from "./send-booking-email";
import { zonedMeetingRange } from "@/lib/calendar/invite";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

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

export {
  getAvailableSlots,
  getMonthAvailability,
  getRRAvailability,
  getRRMonthAvailability,
} from "./availability";
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

  // 1. Find least busy member for that guest-local day
  const timeZone = data.timezone || "America/Mexico_City";
  const start = fromZonedTime(`${data.date}T00:00:00`, timeZone).toISOString();
  const end = fromZonedTime(`${data.date}T23:59:59`, timeZone).toISOString();

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
  const taskNotes = (data.notes || `Meeting booked via public page by ${safeName} (${safeEmail})`) +
    (data.guests && data.guests.length > 0 ? `\n\nAttendees: ${[safeEmail, ...data.guests].join(', ')}` : '') +
    (data.location ? `\n\nLocation / Meeting Room: ${data.location}` : '');
    
  let durationMins = 30
  if (data.duration) {
     durationMins = data.duration
  } else if (data.metadata?.duration) {
     const minMatch = data.metadata.duration.match(/(\d+)\s*min/i);
     const hrMatch = data.metadata.duration.match(/(\d+)\s*hour/i);
     if (minMatch) durationMins = parseInt(minMatch[1]);
     else if (hrMatch) durationMins = parseInt(hrMatch[1]) * 60;
  }

  const timeZone = data.timezone || "America/Mexico_City";
  const { start, end } = zonedMeetingRange({
    date: data.date,
    time: data.time,
    durationMins,
    timeZone,
  });

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
          end_time: end.toISOString(),
          location: data.location || null,
          ...(data.metadata || {})
        }
      },
      status: "pending",
      scheduled_date: start.toISOString(),
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
