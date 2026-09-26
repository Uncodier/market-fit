import { readFileSync } from "node:fs"
import { join } from "node:path"

const robotsNavSource = readFileSync(
  join(process.cwd(), "app/components/navigation/RobotsNavItems.tsx"),
  "utf8",
)

describe("Robots sidebar navigation", () => {
  it("keeps the original Home visual for AI Workspace access", () => {
    expect(robotsNavSource).toContain(
      'moduleImage={{ area: "automation", itemKey: "salesHome" }}',
    )
  })
})