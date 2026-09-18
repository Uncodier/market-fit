import { createClient } from "@/lib/supabase/client"
import { profileService } from "@/app/services/profile.service"

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
    from: jest.fn(),
  })),
}))

const profileClient = (createClient as jest.Mock).mock.results[0].value
const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
const consoleLog = jest.spyOn(console, "log").mockImplementation(() => {})

function client() {
  return profileClient
}

function query(result: unknown) {
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(result)
  return builder
}

describe("profile phone updates", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    consoleError.mockRestore()
    consoleLog.mockRestore()
  })

  it("propagates authenticated updateUser failures before profile persistence", async () => {
    client().auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "buyer@example.com",
          user_metadata: {},
        },
      },
      error: null,
    })
    client().auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth update failed" },
    })

    await expect(
      profileService.upsertProfile("user-1", { phone: "+15555550100" })
    ).rejects.toThrow("Auth update failed")

    expect(client().auth.updateUser).toHaveBeenCalledWith({
      data: { phone: "+15555550100" },
    })
    expect(client().from).not.toHaveBeenCalled()
  })

  it("rejects a profile identity mismatch", async () => {
    client().auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "buyer@example.com",
          user_metadata: {},
        },
      },
      error: null,
    })

    await expect(
      profileService.upsertProfile("victim-user", { phone: "+15555550100" })
    ).rejects.toThrow("Not authenticated")
    expect(client().auth.updateUser).not.toHaveBeenCalled()
  })

  it("returns the phone from the updated local auth user", async () => {
    const authenticatedUser = {
      id: "user-1",
      email: "buyer@example.com",
      phone: null,
      user_metadata: {},
    }
    client().auth.getUser.mockResolvedValue({
      data: { user: authenticatedUser },
      error: null,
    })
    client().auth.updateUser.mockResolvedValue({
      data: {
        user: {
          ...authenticatedUser,
          user_metadata: { phone: "+15555550100" },
        },
      },
      error: null,
    })
    const read = query({
      data: {
        id: "user-1",
        email: "buyer@example.com",
        name: "Buyer",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    })
    const update = query({
      data: {
        id: "user-1",
        email: "buyer@example.com",
        name: "Updated Buyer",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-09-17T00:00:00.000Z",
      },
      error: null,
    })
    client().from
      .mockReturnValueOnce(read)
      .mockReturnValueOnce(update)

    const result = await profileService.upsertProfile("user-1", {
      name: "Updated Buyer",
      phone: "+1 (555) 555-0100",
    })

    expect(result?.phone).toBe("+15555550100")
    expect(client().auth.updateUser).toHaveBeenCalledWith({
      data: { phone: "+1 (555) 555-0100" },
    })
  })
})
