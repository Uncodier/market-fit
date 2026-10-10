import { saveOnboardingProgress } from "@/app/components/dashboard/onboarding-progress"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

const siteId = "00000000-0000-4000-8000-000000000001"
const conflict = { code: "23505", message: "duplicate key" }
const denied = { code: "42501", message: "permission denied" }

function setup() {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
  }
  const from = jest.fn().mockReturnValue(builder)
  jest.mocked(createClient).mockReturnValue({ from } as ReturnType<typeof createClient>)
  return { ...builder, from }
}

describe("onboarding progress write recovery", () => {
  it("recovers one concurrent initialization without erasing the winning session's progress", async () => {
    const db = setup()
    db.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { onboarding: { setup_billing: true } }, error: null })
    db.single
      .mockResolvedValueOnce({ data: null, error: conflict })
      .mockResolvedValueOnce({ data: { onboarding: { setup_billing: true, create_workflows: true } }, error: null })

    await saveOnboardingProgress(siteId, { create_workflows: true })

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.insert).toHaveBeenCalledWith({ site_id: siteId, onboarding: { create_workflows: true } })
    expect(db.update).toHaveBeenCalledWith({ onboarding: { setup_billing: true, create_workflows: true } })
    expect(db.eq.mock.calls).toEqual([["site_id", siteId], ["site_id", siteId], ["site_id", siteId]])
    expect(db.select.mock.calls.every(([columns]) => columns === "onboarding")).toBe(true)
    expect(db.from.mock.calls.every(([table]) => table === "settings")).toBe(true)
  })

  it("does not retry denied inserts", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValue({ data: null, error: null })
    db.single.mockResolvedValue({ data: null, error: denied })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(denied)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("bounds initialization retries", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValue({ data: null, error: null })
    db.single.mockResolvedValue({ data: null, error: conflict })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(conflict)
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it("does not treat a write affecting no visible row as success", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValue({ data: { onboarding: {} }, error: null })
    db.single.mockResolvedValue({ data: null, error: null })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true }))
      .rejects.toThrow("Onboarding progress was not saved")
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("does not initialize settings when the read is unauthorized", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValue({ data: null, error: denied })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(denied)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})