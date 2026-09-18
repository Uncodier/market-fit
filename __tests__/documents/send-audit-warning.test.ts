import fs from "node:fs"
import path from "node:path"

describe("document delivery audit failures", () => {
  it.each([
    "app/orders/send-actions.ts",
    "app/sales/send-actions.ts",
    "app/bills/send-actions.ts",
  ])("%s preserves confirmed delivery success", (relativePath) => {
    const source = fs.readFileSync(
      path.join(process.cwd(), relativePath),
      "utf8"
    )
    const failureBranch = source.match(
      /if \(stampError\) \{([\s\S]*?)\n  \}/
    )?.[1]

    expect(failureBranch).toBeDefined()
    expect(failureBranch).toContain("success: true")
    expect(failureBranch).toContain("emailed: true")
    expect(failureBranch).toContain("auditRecorded: false")
    expect(failureBranch).toContain("Email was delivered")
    expect(failureBranch).not.toMatch(/\berror\s*:/)
  })
})
