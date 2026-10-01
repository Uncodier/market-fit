/** @jest-environment node */

import { browserName, buildBreakdown, deviceName, pageNames, regionName } from "@/lib/traffic/breakdowns"
import type { TrafficSession } from "@/lib/traffic/types"

const session = (fields: Partial<TrafficSession> = {}): TrafficSession => ({ id: "session", ...fields })

describe("honest device classification", () => {
  it.each([
    [null, null], [{}, {}], [{ type: "unknown" }, null], [{ os: { name: "Unrecognized" } }, {}],
    [{ os: 123, model: { bad: true } }, {}], [[], []], [{}, { mobile: false }],
  ])("keeps missing/unknown metadata as Unknown (%j, %j)", (device, browser) => {
    expect(deviceName(session({ device, browser }))).toBe("Unknown")
  })

  it.each([
    [{ os: { name: "Android", version: "14" } }, "Mobile"],
    [{ os: { name: "iOS" }, model: "iPad" }, "Tablet"],
    [{ os: "Windows" }, "Desktop"], [{ os: { name: "macOS" } }, "Desktop"],
    [{ model: "Android TV" }, "Smart TV"], [{ type: "smartphone" }, "Mobile"],
    [{ category: "tablet" }, "Tablet"], [{ device_type: "computer" }, "Desktop"],
    [{ type: "console" }, "console"],
  ])("handles typed or nested OS metadata %j", (device, expected) => {
    expect(deviceName(session({ device }))).toBe(expected)
  })

  it("uses affirmative mobile evidence from the browser fallback", () => {
    expect(deviceName(session({ browser: { mobile: true } }))).toBe("Mobile")
    expect(deviceName(session({ browser: { device_type: "tablet" } }))).toBe("Tablet")
  })
})

describe("browser and region metadata", () => {
  it.each([
    ["Mozilla Chrome/120 Safari/1 Edg/120", "Edge"],
    ["Mozilla Chrome/120 Safari/1 OPR/120", "Opera"],
    ["Mozilla Chrome/120 SamsungBrowser/120", "Samsung Internet"],
    ["Firefox/130", "Firefox"], ["Version/17 Safari/1", "Safari"],
    ["Chrome/120", "Chrome"], ["Mozilla Trident/1", "Internet Explorer"],
  ])("matches specific browsers before Chromium markers (%s)", (userAgent, expected) => {
    expect(browserName(session({ browser: { userAgent } }))).toBe(expected)
  })

  it("handles nested browser names and malformed objects without throwing", () => {
    expect(browserName(session({ device: { browser: { name: "Brave" } } }))).toBe("Brave")
    expect(browserName(session({ browser: { name: { unexpected: true }, userAgent: 123 } }))).toBe("Unknown")
    expect(browserName(session({ browser: "Firefox" }))).toBe("Firefox")
  })

  it.each([
    [{ country: "us" }, "United States"], [{ countryCode: "gb" }, "United Kingdom"],
    [{ country: { name: "Mexico" } }, "Mexico"], [{ region: "Local region" }, "Local region"],
    [{ city: "Local city" }, "Local city"], [{ country: 123 }, "Unknown"], [null, "Unknown"],
    [{ country: "__proto__" }, "__proto__"], [{ country: "constructor" }, "constructor"],
  ])("normalizes region metadata without dropping unknown sessions (%j)", (location, expected) => {
    expect(regionName(session({ location }))).toBe(expected)
  })
})

describe("page URL observations", () => {
  it("counts distinct landing/current URL samples, not fabricated event pageviews", () => {
    expect(pageNames(session({ landing_url: "https://site.test/", current_url: "https://site.test/blog/hello-world" })))
      .toEqual(["Home Page", "Blog > Hello World"])
    expect(pageNames(session({ landing_url: "https://site.test/", current_url: "https://site.test/" })))
      .toEqual(["Home Page"])
  })

  it("includes missing URLs and handles invalid custom title metadata", () => {
    expect(pageNames(session())).toEqual(["Unknown Page"])
    expect(pageNames(session({ landing_url: "https://site.test/hello?secret=not-returned", custom_data: { title: { invalid: true } } })))
      .toEqual(["Hello"])
    expect(pageNames(session({ landing_url: "javascript:bad" }))).toEqual(["Unknown Page"])
    expect(pageNames(session({ landing_url: "/hello", custom_data: { page_title: "Welcome" } }))).toEqual(["Welcome"])
  })
})

describe.each(["pages", "devices", "browsers", "regions"] as const)("%s breakdown denominator", kind => {
  it("retains long tails and escapes the residual bucket's reserved name", () => {
    const rows = Array.from({ length: 25 }, (_, i) => session({
      landing_url: `/page-${i}`, device: { type: `Custom${i}` }, browser: { name: `Custom${i}` }, location: { country: `Custom${i}` },
    }))
    for (let i = 0; i < 5; i++) rows.push(session({
      landing_url: "/other", custom_data: { title: "Other" },
      device: { type: "Other" }, browser: { name: "Other" }, location: { country: "Other" },
    }))
    const result = buildBreakdown(rows, kind)
    expect(result).toHaveLength(11)
    expect(result).toContainEqual({ name: "Recorded: Other", value: 5 })
    expect(result.filter(row => row.name === "Other")).toHaveLength(1)
    expect(result.reduce((sum, row) => sum + row.value, 0)).toBe(30)
  })

  it("returns one unknown vote for a session without metadata", () => {
    expect(buildBreakdown([session()], kind)).toEqual([{ name: kind === "pages" ? "Unknown Page" : "Unknown", value: 1 }])
  })
})