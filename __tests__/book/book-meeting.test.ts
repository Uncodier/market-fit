import { bookMeeting } from "../../app/book/actions"
import { createServiceClient } from "../../lib/supabase/server"

jest.mock("../../app/book/send-booking-email", () => ({
  sendBookingConfirmationEmail: jest.fn().mockResolvedValue(true)
}))

jest.mock("../../lib/supabase/server", () => ({
  createServiceClient: jest.fn(),
  createClient: jest.fn()
}))

describe("bookMeeting", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "new-task-id" }, error: null }),
    };

    (createServiceClient as jest.Mock).mockResolvedValue(mockSupabase);
  })

  it("reuses existing lead when one email match exists", async () => {
    // Setup mock to return an existing lead
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "existing-lead", name: "Javier Garcia" },
      error: null
    });
    mockSupabase.update.mockResolvedValueOnce({ error: null });
    
    // Default task insert success
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    const result = await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "Javier Garcia",
      email: "javier@improvitz.com",
      title: "Meeting"
    });

    expect(result.success).toBe(true);
    
    // Check it queried leads properly
    expect(mockSupabase.from).toHaveBeenCalledWith("leads");
    expect(mockSupabase.eq).toHaveBeenCalledWith("email", "javier@improvitz.com");
    
    // Check it did not try to insert a lead
    expect(mockSupabase.insert).not.toHaveBeenCalledWith(expect.objectContaining({
      email: "javier@improvitz.com"
    }));
    
    // Check it created the task correctly with the existing lead_id
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      type: "meeting",
      lead_id: "existing-lead"
    }));
  })

  it("when multiple email matches exist, picks the latest and still creates the task", async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "latest-lead", name: "Javier Garcia" },
      error: null,
    });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    const result = await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "Javier",
      email: "javier@improvitz.com",
      title: "Meeting",
    });

    expect(result.success).toBe(true);
    expect(mockSupabase.eq).toHaveBeenCalledWith("email", "javier@improvitz.com");
    expect(mockSupabase.eq).toHaveBeenCalledWith("site_id", "s1");
    expect(mockSupabase.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockSupabase.limit).toHaveBeenCalledWith(1);
    expect(mockSupabase.insert).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: "javier@improvitz.com" }),
    );
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "meeting",
        lead_id: "latest-lead",
      }),
    );
  });

  it("when insert hits unique conflict, recovers via re-fetch", async () => {
    // 1st lead lookup returns null
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    
    // Lead insert returns 23505 unique violation
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" }
    });
    
    // 2nd lead lookup (refetch) returns the concurrently created lead
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "concurrent-lead", name: "Javier" },
      error: null
    });
    
    // Task insert success
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    const result = await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "Javier",
      email: "javier@improvitz.com",
      title: "Meeting"
    });

    expect(result.success).toBe(true);
    
    // Check it recovered and used the concurrent lead ID
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      type: "meeting",
      lead_id: "concurrent-lead"
    }));
  })

  it("empty notes still succeed and uses a default description", async () => {
    // 1st lead lookup returns null
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    
    // Lead insert returns new lead
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "new-lead", name: "Javier" },
      error: null
    });
    
    // Task insert success
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "Javier",
      email: "javier@improvitz.com",
      title: "Meeting" // no notes
    });

    // Check task insert contains the default notes text
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      type: "meeting",
      description: expect.stringContaining("Meeting booked via public page by Javier")
    }));
  })

  it("trims name and email before lookup and default notes", async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "existing-lead", name: "Javier" },
      error: null,
    });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "  Javier  ",
      email: "  javier@improvitz.com  ",
      title: "Meeting",
    });

    expect(mockSupabase.eq).toHaveBeenCalledWith("email", "javier@improvitz.com");
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "meeting",
        lead_id: "existing-lead",
        description: expect.stringContaining("Meeting booked via public page by Javier (javier@improvitz.com)"),
      }),
    );
  });

  it("stores Mexico 16:00 as 22:00Z in scheduled_date and end_time", async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "existing-lead", name: "Javier" },
      error: null,
    });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "Javier",
      email: "javier@improvitz.com",
      title: "Meeting",
      duration: 30,
    });

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_date: "2026-09-02T22:00:00.000Z", // UTC-6
        metadata: expect.objectContaining({
          _calendar_context: expect.objectContaining({
            end_time: "2026-09-02T22:30:00.000Z",
          }),
        }),
      }),
    );
  });

  it("stores Mexico 11:00 as 17:00Z in scheduled_date", async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "existing-lead", name: "Sergio" },
      error: null,
    });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-2" }, error: null });

    await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "11:00",
      timezone: "America/Mexico_City",
      name: "Sergio",
      email: "sergio@example.com",
      title: "Meeting",
    });

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduled_date: "2026-09-02T17:00:00.000Z",
      }),
    );
  });

  it("still succeeds when confirmation email throws", async () => {
    const { sendBookingConfirmationEmail } = require("../../app/book/send-booking-email");
    sendBookingConfirmationEmail.mockRejectedValueOnce(new Error("sendgrid down"));

    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { id: "existing-lead", name: "Javier" },
      error: null,
    });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: "task-1" }, error: null });

    const result = await bookMeeting({
      userId: "u1",
      siteId: "s1",
      date: "2026-09-02",
      time: "16:00",
      timezone: "America/Mexico_City",
      name: "Javier",
      email: "javier@improvitz.com",
      title: "Meeting",
    });

    expect(result.success).toBe(true);
    expect(result.task.id).toBe("task-1");
  });

  describe("getAvailableSlots", () => {
    const { getAvailableSlots } = require("../../app/book/actions");

    it("generates slots based on host timezone and labels them in guest timezone", async () => {
      // Profile has a schedule in Mexico City 09:00 - 17:00
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          settings: {
            calendar: {
              timezone: "America/Mexico_City",
              duration: 60,
              availability: {
                wednesday: { enabled: true, start: "09:00", end: "17:00" },
              },
            },
          },
        },
        error: null,
      });

      // No tasks
      mockSupabase.neq = jest.fn().mockResolvedValue({ data: [], error: null });

      jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:00:00Z"));

      // Aug 12 2026 is Wednesday
      const guestMexicoSlots = await getAvailableSlots(
        "u1",
        "2026-08-12",
        60,
        0,
        "America/Mexico_City"
      );

      // Expect labels like "09:00", "10:00" in Mexico
      expect(guestMexicoSlots).toContain("09:00");
      expect(guestMexicoSlots).toContain("11:00");
      expect(guestMexicoSlots).toContain("16:00");
      expect(guestMexicoSlots).not.toContain("17:00"); // ends at 17:00

      // Re-setup mock for second call
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          settings: {
            calendar: {
              timezone: "America/Mexico_City",
              duration: 60,
              availability: {
                wednesday: { enabled: true, start: "09:00", end: "17:00" },
              },
            },
          },
        },
        error: null,
      });

      // Aug 12 2026 in New York (EDT, UTC-4). Mexico is UTC-6. So NY is 2 hours ahead.
      const guestNewYorkSlots = await getAvailableSlots(
        "u1",
        "2026-08-12",
        60,
        0,
        "America/New_York"
      );

      // The 09:00 Mexico slot is 15:00Z. In NY, that's 11:00.
      expect(guestNewYorkSlots).toContain("11:00");
      expect(guestNewYorkSlots).toContain("13:00");
      expect(guestNewYorkSlots).toContain("18:00");
      expect(guestNewYorkSlots).not.toContain("09:00");

      jest.useRealTimers();
    });
  });
})