import {
  isOAuthConnectablePlatform,
  NEW_ACCOUNT_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORMS,
} from "@/app/components/settings/social-section-config"

describe("social settings platform options", () => {
  it.each(["twitter", "x"])(
    "temporarily hides %s from new account options",
    (value) => {
      expect(NEW_ACCOUNT_SOCIAL_PLATFORMS.some((platform) => platform.value === value)).toBe(false)
    },
  )

  it("makes all eight managed networks available in their original order", () => {
    expect(NEW_ACCOUNT_SOCIAL_PLATFORMS.map((platform) => platform.value)).toEqual([
      "facebook",
      "instagram",
      "threads",
      "linkedin",
      "youtube",
      "tiktok",
      "pinterest",
      "bluesky",
    ])
  })

  it.each(["facebook", "threads", "twitter", "youtube"])(
    "preserves %s metadata and OAuth support for existing accounts",
    (value) => {
      expect(SOCIAL_PLATFORMS.some((platform) => platform.value === value)).toBe(true)
      expect(isOAuthConnectablePlatform(value)).toBe(true)
    },
  )

  it.each(["threads", "linkedin", "youtube", "instagram", "facebook", "tiktok", "pinterest"])(
    "allows selecting and connecting %s via OAuth",
    (value) => {
      expect(NEW_ACCOUNT_SOCIAL_PLATFORMS).toEqual(
        expect.arrayContaining([expect.objectContaining({ value })]),
      )
      expect(isOAuthConnectablePlatform(value)).toBe(true)
    },
  )

  it("allows Bluesky while preserving its dedicated app-password connection flow", () => {
    expect(NEW_ACCOUNT_SOCIAL_PLATFORMS).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: "bluesky", label: "Bluesky" })]),
    )
    expect(isOAuthConnectablePlatform("bluesky")).toBe(false)
  })

  it("keeps Instagram metadata for existing accounts", () => {
    expect(SOCIAL_PLATFORMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "instagram",
          label: "Instagram",
        }),
      ])
    )
  })
})
