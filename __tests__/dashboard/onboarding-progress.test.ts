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
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
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
      .mockResolvedValueOnce({ data: null, error: conflict })
      .mockResolvedValueOnce({ data: { onboarding: { setup_billing: true } }, error: null })
      .mockResolvedValueOnce({ data: { onboarding: { setup_billing: true, create_workflows: true } }, error: null })

    await saveOnboardingProgress(siteId, { create_workflows: true })

    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.insert).toHaveBeenCalledWith({ site_id: siteId, onboarding: { create_workflows: true } })
    expect(db.update).toHaveBeenCalledWith({ onboarding: { setup_billing: true, create_workflows: true } })
    expect(db.eq.mock.calls).toEqual([
      ["site_id", siteId], ["site_id", siteId], ["site_id", siteId],
      ["onboarding", JSON.stringify({ setup_billing: true })],
    ])
    expect(db.select.mock.calls.every(([columns]) => columns === "onboarding")).toBe(true)
    expect(db.from.mock.calls.every(([table]) => table === "settings")).toBe(true)
  })

  it("does not retry denied inserts", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: denied })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(denied)
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.update).not.toHaveBeenCalled()
  })

  it("bounds initialization retries", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: conflict })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: conflict })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(conflict)
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it("does not treat a write affecting no visible row as success", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValueOnce({ data: { onboarding: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { onboarding: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { onboarding: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true }))
      .rejects.toThrow("Onboarding progress was not saved")
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).toHaveBeenCalledTimes(3)
  })

  it("does not initialize settings when the read is unauthorized", async () => {
    const db = setup()
    db.maybeSingle.mockResolvedValue({ data: null, error: denied })
    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(denied)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })

  it("re-reads a changed snapshot and preserves other tasks when reopening a task", async () => {
    const db = setup()
    db.maybeSingle
      .mockResolvedValueOnce({ data: { onboarding: { create_workflows: true } }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { onboarding: { create_workflows: true, setup_branding: true } }, error: null })
      .mockResolvedValueOnce({ data: { onboarding: { create_workflows: false, setup_branding: true } }, error: null })

    await saveOnboardingProgress(siteId, { create_workflows: false })

    expect(db.update).toHaveBeenLastCalledWith({ onboarding: { create_workflows: false, setup_branding: true } })
    expect(db.eq).toHaveBeenLastCalledWith("onboarding", JSON.stringify({ create_workflows: true, setup_branding: true }))
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("uses an IS NULL snapshot filter for existing settings without onboarding", async () => {
    const db = setup()
    db.maybeSingle
      .mockResolvedValueOnce({ data: { onboarding: null }, error: null })
      .mockResolvedValueOnce({ data: { onboarding: { create_workflows: true } }, error: null })

    await saveOnboardingProgress(siteId, { create_workflows: true })

    expect(db.is).toHaveBeenCalledWith("onboarding", null)
    expect(db.update).toHaveBeenCalledWith({ onboarding: { create_workflows: true } })
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("does not retry unauthorized updates", async () => {
    const db = setup()
    db.maybeSingle
      .mockResolvedValueOnce({ data: { onboarding: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: denied })

    await expect(saveOnboardingProgress(siteId, { create_workflows: true })).rejects.toEqual(denied)
    expect(db.update).toHaveBeenCalledTimes(1)
  })

  it("does not claim success when the returned progress omits requested tasks", async () => {
    const db = setup()
    db.maybeSingle
      .mockResolvedValueOnce({ data: { onboarding: {} }, error: null })
      .mockResolvedValueOnce({ data: { onboarding: {} }, error: null })

    await expect(saveOnboardingProgress(siteId, { create_workflows: true }))
      .rejects.toThrow("Onboarding progress was not saved")
    expect(db.update).toHaveBeenCalledTimes(1)
  })
})