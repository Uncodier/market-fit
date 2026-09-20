import { readFileSync } from "node:fs"
import { join } from "node:path"

const routes = [
  "revenue",
  "ltv",
  "cac",
  "cpl",
  "roi",
  "active-users",
  "active-segments",
  "active-campaigns",
]

describe("dashboard analytics route boundaries", () => {
  it.each(routes)("%s authorizes before elevated analytics work", (route) => {
    const source = readFileSync(
      join(process.cwd(), "app", "api", route, "route.ts"),
      "utf8"
    )
    const handler = source.slice(source.indexOf("export async function GET"))
    const accessIndex = handler.indexOf("requireAnalyticsAccess(request)")

    expect(accessIndex).toBeGreaterThan(-1)
  })

  it.each(routes)("%s does not trust a query-string user ID", (route) => {
    const source = readFileSync(
      join(process.cwd(), "app", "api", route, "route.ts"),
      "utf8"
    )

    expect(source).not.toMatch(
      /(?:searchParams|searchParams\.get)\s*(?:\.get)?\s*\(\s*["']userId["']/
    )
  })
})
