/** @jest-environment node */

import { buildAttribution, buildReferrals, classifySessionEntry, sessionSegment } from "@/lib/traffic/attribution"
import type { TrafficSession } from "@/lib/traffic/types"

const session = (fields: Partial<TrafficSession> = {}): TrafficSession => ({ id: "session", ...fields })
const segment = (name: string, site_id = "site-a") => ({ id: name, name, site_id })

describe("session-entry classifier", () => {
  it("prefers recorded UTM per field and falls back to landing URL, never current URL", () => {
    expect(classifySessionEntry(session({
      utm_source: " recorded ", utm_medium: " ", utm_campaign: "saved",
      landing_url: "https://shop.test/?utm_source=url&utm_medium=cpc&utm_campaign=ignored&gclid=click",
      current_url: "https://shop.test/?utm_campaign=current",
      referrer: "https://app.makinari.com/",
    }))).toEqual({ referral: "recorded (cpc) - saved", campaign: "saved", attributed: true })
    expect(classifySessionEntry(session({ current_url: "https://shop.test/?utm_campaign=current" })))
      .toEqual({ referral: "Direct / unknown", campaign: null, attributed: false })
  })

  it.each([
    ["https://shop.test/?utm_campaign=Spring%20sale", "Campaign UTM - Spring sale", "Spring sale", false],
    ["/checkout?utm_source=newsletter&utm_medium=email&utm_campaign=hello", "newsletter (email) - hello", "hello", true],
    ["https://shop.test/?utm_medium=email", "Unknown source (email)", null, false],
    ["https://shop.test/?utm_source=partner", "partner", null, true],
  ])("recognizes landing tags from %s", (landing_url, referral, campaign, attributed) => {
    expect(classifySessionEntry(session({ landing_url }))).toEqual({ referral, campaign, attributed })
  })

  it.each([
    ["gclid=click", "Google Ads", true],
    ["msclkid=click", "Microsoft Ads", true],
    ["fbclid=click", "Direct / unknown", false],
    ["gclid=", "Direct / unknown", false],
  ])("handles click ids without treating fbclid as paid (%s)", (query, referral, attributed) => {
    expect(classifySessionEntry(session({ landing_url: `https://shop.test/?${query}` })))
      .toEqual({ referral, campaign: null, attributed })
  })

  it("keeps Facebook referral organic/unspecified when fbclid is present", () => {
    expect(classifySessionEntry(session({
      landing_url: "https://shop.test/?fbclid=click", referrer: "https://m.facebook.com/story",
    })).referral).toBe("Facebook")
  })

  it.each([
    ["https://shop.test/?utm_campaign=sale&gclid=click", null, "Google Ads - sale", true],
    ["https://shop.test/?utm_campaign=sale", "https://google.com/search", "Google - sale", true],
    ["https://shop.test/?utm_medium=email", null, "Unknown source (email)", false],
  ])("keeps source coverage independent of campaign/medium-only tags", (landing_url, referrer, referral, attributed) => {
    expect(classifySessionEntry(session({ landing_url, referrer }))).toEqual(expect.objectContaining({ referral, attributed }))
  })

  it.each([
    "https://shop.test/?utm_campaign=%00bad",
    "https://shop.test/?utm_campaign=%0Ahello%0A",
    "https://shop.test/?utm_campaign=%C2%80bad",
    "https://shop.test/?utm_campaign=%E0%A4",
    `https://shop.test/?utm_campaign=${"a".repeat(513)}`,
    `https://shop.test/?utm_campaign=${"+".repeat(510)}sale`,
    `https://shop.test/${"a".repeat(8192)}?utm_campaign=bad`,
    "https://shop.test/#utm_campaign=fragment",
    "https://shop.test/?UTM_CAMPAIGN=uppercase",
    "invalid landing?utm_campaign=bad",
  ])("does not recover rejected/malformed landing URL metadata (%s)", landing_url => {
    expect(classifySessionEntry(session({ landing_url })).campaign).toBeNull()
  })

  it("preserves supported decoding, length boundary, and first duplicate semantics", () => {
    expect(classifySessionEntry(session({ landing_url: "https://shop.test/?utm_campaign=%20hello+world%20&utm_campaign=second" })).campaign)
      .toBe("hello world")
    expect(classifySessionEntry(session({ landing_url: `https://shop.test/?utm_campaign=${"a".repeat(512)}` })).campaign)
      .toHaveLength(512)
  })

  it("distinguishes internal Makinari navigation from Makinari referring a customer site", () => {
    expect(classifySessionEntry(session({ referrer: "https://docs.makinari.com/", landing_url: "https://app.makinari.com/" })))
      .toEqual({ referral: "Internal navigation", campaign: null, attributed: false })
    expect(classifySessionEntry(session({ referrer: "https://makinari.com/", landing_url: "https://customer.test/" })))
      .toEqual({ referral: "makinari.com", campaign: null, attributed: true })
  })

  it.each([
    ["https://www.google.com/search", "Google"],
    ["https://news.google.co.uk/search", "Google"],
    ["https://google.com.evil.test/search", "google.com.evil.test"],
    ["https://notgoogle.com/search", "notgoogle.com"],
    ["https://evilfacebook.com/story", "evilfacebook.com"],
    ["https://linkedin.com.evil.test/", "linkedin.com.evil.test"],
    ["https://app.makinari.com/", "app.makinari.com"],
    ["https://makinari.com.evil.test/", "makinari.com.evil.test"],
    ["https://www.shop.test/previous", "Internal navigation"],
  ])("uses hostname boundaries for %s", (referrer, referral) => {
    expect(classifySessionEntry(session({ referrer, landing_url: "https://shop.test/" })).referral).toBe(referral)
  })

  it.each([null, "", "   ", "not a URL", "javascript:alert(1)", "data:text/plain,google.com"])(
    "does not invent a direct or external source for %s", referrer => {
      expect(classifySessionEntry(session({ referrer })))
        .toEqual({ referral: "Direct / unknown", campaign: null, attributed: false })
    }
  )

  it("escapes synthetic labels and the escape prefix without collisions", () => {
    const rows = ["Other", "Recorded: Other", "Direct / unknown", "Internal navigation"]
      .map(utm_source => session({ utm_source }))
    expect(buildReferrals(rows).map(row => row.name)).toEqual(expect.arrayContaining([
      "Recorded: Other", "Recorded: Recorded: Other", "Recorded: Direct / unknown", "Recorded: Internal navigation",
    ]))
  })
})

describe("current same-site segment membership", () => {
  it("gives the session lead precedence over visitor and never votes twice", () => {
    const row = session({ lead: { site_id: "site-a", segment: segment("Lead segment") }, visitor: { segment: segment("Visitor segment") } })
    expect(sessionSegment(row, "site-a")).toBe("Lead segment")
    expect(buildAttribution([row], "site-a").segments).toEqual([{ name: "Lead segment", value: 1 }])
  })

  it.each([
    { lead: { site_id: "site-b", segment: segment("Leaked lead segment") } },
    { lead: { site_id: "site-a", segment: segment("Leaked segment", "site-b") } },
    { visitor: { segment: segment("Leaked visitor segment", "site-b") } },
  ])("excludes cross-tenant relations defensively (%j)", fields => {
    const result = buildAttribution([session(fields)], "site-a")
    expect(result.segments).toEqual([{ name: "Unassigned segment", value: 1 }])
    expect(result.coverage.segmentedSessions).toBe(0)
    expect(JSON.stringify(result)).not.toContain("Leaked")
  })

  it("falls back to a safe visitor segment when lead relation is unavailable or foreign", () => {
    expect(sessionSegment(session({
      lead: { site_id: "other", segment: segment("No") }, visitor: { segment: segment("Visitor") },
    }), "site-a")).toBe("Visitor")
  })
})

describe("attribution coverage and aggregation", () => {
  it("accounts for every session once per dimension with independent coverage", () => {
    const rows = [
      session({ utm_source: "email", utm_campaign: "launch", lead: { site_id: "site-a", segment: segment("Buyers") } }),
      session({ landing_url: "/?utm_campaign=launch" }),
      session({ referrer: "https://google.com/", visitor: { segment: segment("Buyers") } }),
      session({ referrer: "https://app.makinari.com/" }),
      session(),
    ]
    const result = buildAttribution(rows, "site-a")
    expect(result).toEqual({
      segments: [{ name: "Unassigned segment", value: 3 }, { name: "Buyers", value: 2 }],
      campaigns: [{ name: "No campaign", value: 3 }, { name: "launch", value: 2 }],
      coverage: { totalSessions: 5, attributedSessions: 2, unattributedSessions: 3, segmentedSessions: 2, campaignSessions: 2 },
      model: "session_entry", segmentMembership: "current",
    })
  })

  it("does not confuse literal placeholder campaign/segment names with missing membership", () => {
    const result = buildAttribution([
      session(), session({ utm_campaign: "No campaign", visitor: { segment: segment("Unassigned segment") } }),
      session({ utm_campaign: "Recorded: No campaign" }),
    ], "site-a")
    expect(result.campaigns.map(row => row.name)).toEqual(expect.arrayContaining([
      "No campaign", "Recorded: No campaign", "Recorded: Recorded: No campaign",
    ]))
    expect(result.segments).toContainEqual({ name: "Recorded: Unassigned segment", value: 1 })
  })

  it("returns zero coverage, not invented placeholder votes for an empty range", () => {
    const result = buildAttribution([], "site-a")
    expect(result.segments).toEqual([])
    expect(result.campaigns).toEqual([])
    expect(Object.values(result.coverage)).toEqual([0, 0, 0, 0, 0])
  })

  it("preserves the full referral denominator in top ten plus Other", () => {
    const rows = Array.from({ length: 20 }, (_, i) => session({ utm_source: `source-${i}` }))
    rows.push(session({ utm_source: "Other" }), session(), session({ referrer: "https://docs.makinari.com/" }))
    const result = buildReferrals(rows)
    expect(result).toHaveLength(11)
    expect(result.find(row => row.name === "Other")?.value).toBe(13)
    expect(result.reduce((total, row) => total + row.value, 0)).toBe(23)
    expect(new Set(result.map(row => row.name)).size).toBe(11)
  })

  it("bounds large segment/campaign distributions while retaining missing buckets", () => {
    const rows = Array.from({ length: 20 }, (_, i) => session({
      utm_campaign: `campaign-${i}`, visitor: { segment: segment(`segment-${i}`) },
    }))
    rows.push(session())
    for (let i = 0; i < 3; i++) rows.push(session({ utm_campaign: "Other", visitor: { segment: segment("Other") } }))
    const result = buildAttribution(rows, "site-a")
    for (const distribution of [result.segments, result.campaigns]) {
      expect(distribution).toHaveLength(8)
      expect(distribution.reduce((sum, row) => sum + row.value, 0)).toBe(24)
      expect(distribution).toContainEqual({ name: "Recorded: Other", value: 3 })
      expect(distribution.filter(row => row.name === "Other")).toHaveLength(1)
    }
    expect(result.segments).toContainEqual({ name: "Unassigned segment", value: 1 })
    expect(result.campaigns).toContainEqual({ name: "No campaign", value: 1 })
  })
})