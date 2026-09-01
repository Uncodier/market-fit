import { fromZonedTime } from "date-fns-tz";
import { addMinutes } from "date-fns";

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  uid: string;
  organizer?: string;
  attendees?: string[];
}

export function escapeIcsText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uncodie//Market Fit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.start)}`,
    `DTEND:${formatIcsDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.organizer) {
    lines.push(
      `ORGANIZER;CN=${escapeIcsText(event.organizer)}:mailto:${event.organizer}`,
    );
  }

  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      lines.push(`ATTENDEE;RSVP=FALSE:mailto:${attendee}`);
    }
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  
  const dates = `${formatIcsDate(event.start)}/${formatIcsDate(event.end)}`;
  url.searchParams.set("dates", dates);
  
  if (event.description) {
    url.searchParams.set("details", event.description);
  }
  
  if (event.location) {
    url.searchParams.set("location", event.location);
  }

  return url.toString();
}

export interface ZonedMeetingRangeParams {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMins: number;
  timeZone: string;
}

export function zonedMeetingRange(params: ZonedMeetingRangeParams): { start: Date; end: Date } {
  const { date, time, durationMins, timeZone } = params;
  
  // Combine date and time to ISO format (local in the given timezone)
  const [h = "00", m = "00"] = time.split(":");
  const dateTimeStr = `${date}T${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
  
  const start = fromZonedTime(dateTimeStr, timeZone);
  const end = addMinutes(start, durationMins);
  
  return { start, end };
}
