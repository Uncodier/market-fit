import { shouldUseLayout } from "@/app/config/routes"

describe("shouldUseLayout", () => {
  it("does not wrap buyer portal screens in workspace chrome", () => {
    expect(shouldUseLayout("/buyer")).toBe(false)
    expect(shouldUseLayout("/buyer/profile")).toBe(false)
  })

  it("uses workspace chrome for the account profile on app", () => {
    expect(shouldUseLayout("/profile")).toBe(true)
  })

  it("does not wrap billing success in workspace chrome, but wraps other billing paths", () => {
    expect(shouldUseLayout("/billing/success")).toBe(false)
    expect(shouldUseLayout("/billing/success?credits=10")).toBe(false)
    expect(shouldUseLayout("/billing")).toBe(true)
    expect(shouldUseLayout("/billing?tab=history")).toBe(true)
  })
})
