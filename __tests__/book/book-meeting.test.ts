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
})