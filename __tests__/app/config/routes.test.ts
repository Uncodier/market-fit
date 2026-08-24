import { shouldUseLayout } from "@/app/config/routes"

describe("shouldUseLayout", () => {
  it("does not wrap buyer portal screens in workspace chrome", () => {
    expect(shouldUseLayout("/buyer")).toBe(false)
    expect(shouldUseLayout("/buyer/profile")).toBe(false)
  })

  it("uses workspace chrome for the account profile on app", () => {
    expect(shouldUseLayout("/profile")).toBe(true)
  })
})
