import fs from "node:fs"
import path from "node:path"

describe("signup phone handling", () => {
  it("keeps contact phone as unverified metadata during email signup", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/components/auth/auth-form.tsx"),
      "utf8"
    )

    expect(source).toContain("phone: phoneResult.phone")
    expect(source).not.toContain("signupPayload.phone")
    expect(source).not.toMatch(/phone_confirm\s*:\s*true/)
  })

  it("does not preflight account existence from the browser", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app/components/auth/auth-form.tsx"),
      "utf8"
    )

    expect(source).not.toContain("/api/auth/check-email-exists")
    expect(source).not.toContain("emailCheckResult")
  })
})
