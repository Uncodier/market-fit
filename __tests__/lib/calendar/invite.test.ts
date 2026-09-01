import { buildIcs, buildGoogleCalendarUrl, zonedMeetingRange, escapeIcsText } from "@/lib/calendar/invite";

describe("calendar invite helpers", () => {
  describe("escapeIcsText", () => {
    it("escapes special characters", () => {
      expect(escapeIcsText("Hello, World; This is\\ a test\nNew line")).toBe(
        "Hello\\, World\\; This is\\\\ a test\\nNew line"
      );
    });
  });

  describe("zonedMeetingRange", () => {
    it("parses local date and time in a specific timezone to UTC", () => {
      const { start, end } = zonedMeetingRange({
        date: "2026-09-02",
        time: "16:00",
        durationMins: 30,
        timeZone: "America/Mexico_City",
      });

      // Mexico City is typically UTC-6 or UTC-5. In Sep 2026, it's UTC-6.
      // So 16:00 UTC-6 is 22:00 UTC.
      expect(start.toISOString()).toBe("2026-09-02T22:00:00.000Z");
      expect(end.toISOString()).toBe("2026-09-02T22:30:00.000Z");
    });
  });

  describe("buildIcs", () => {
    it("generates a valid ICS string with UTC times", () => {
      const start = new Date("2026-09-02T22:00:00.000Z");
      const end = new Date("2026-09-02T22:30:00.000Z");
      
      const ics = buildIcs({
        title: "Test Meeting",
        description: "Notes\nLine 2",
        location: "https://zoom.us/test",
        start,
        end,
        uid: "task-123@uncodie.com",
        organizer: "host@example.com",
        attendees: ["guest@example.com"],
      });

      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("METHOD:PUBLISH");
      expect(ics).toContain("UID:task-123@uncodie.com");
      expect(ics).toContain("DTSTART:20260902T220000Z");
      expect(ics).toContain("DTEND:20260902T223000Z");
      expect(ics).toContain("SUMMARY:Test Meeting");
      expect(ics).toContain("DESCRIPTION:Notes\\nLine 2");
      expect(ics).toContain("LOCATION:https://zoom.us/test");
      expect(ics).toContain("ORGANIZER;CN=host@example.com:mailto:host@example.com");
      expect(ics).toContain("ATTENDEE;RSVP=FALSE:mailto:guest@example.com");
    });
  });

  describe("buildGoogleCalendarUrl", () => {
    it("generates a valid Google Calendar URL", () => {
      const start = new Date("2026-09-02T22:00:00.000Z");
      const end = new Date("2026-09-02T22:30:00.000Z");

      const url = buildGoogleCalendarUrl({
        title: "Test Meeting",
        description: "Notes",
        location: "https://zoom.us/test",
        start,
        end,
        uid: "task-123@uncodie.com",
      });

      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://calendar.google.com");
      expect(parsed.pathname).toBe("/calendar/render");
      expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
      expect(parsed.searchParams.get("text")).toBe("Test Meeting");
      expect(parsed.searchParams.get("dates")).toBe("20260902T220000Z/20260902T223000Z");
      expect(parsed.searchParams.get("details")).toBe("Notes");
      expect(parsed.searchParams.get("location")).toBe("https://zoom.us/test");
    });
  });
});
