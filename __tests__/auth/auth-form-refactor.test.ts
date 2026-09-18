import fs from "node:fs"
import path from "node:path"

const authFormFiles = [
  "app/components/auth/auth-form.tsx",
  "app/components/auth/AuthFormContent.tsx",
  "app/components/auth/AuthFormFooter.tsx",
  "app/components/auth/auth-form-schema.ts",
]

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("auth form module boundaries", () => {
  it.each(authFormFiles)("%s stays below 500 lines", (relativePath) => {
    expect(read(relativePath).split(/\r?\n/).length).toBeLessThan(500)
  })

  it("retains sign-in, sign-up, MFA, reset, and OAuth flows", () => {
    const source = authFormFiles.map(read).join("\n")

    expect(source).toContain("supabase.auth.signUp")
    expect(source).toContain("supabase.auth.signInWithPassword")
    expect(source).toContain("supabase.auth.mfa.challenge")
    expect(source).toContain("supabase.auth.mfa.verify")
    expect(source).toContain("supabase.auth.resetPasswordForEmail")
    expect(source).toContain("supabase.auth.signInWithOAuth")
  })

  it("does not restore the account-enumeration preflight", () => {
    const source = authFormFiles.map(read).join("\n")

    expect(source).not.toContain("/api/auth/check-email-exists")
    expect(source).not.toContain("emailCheckResult")
  })
})
