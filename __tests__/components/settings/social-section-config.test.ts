import {
  isOAuthConnectablePlatform,
  NEW_ACCOUNT_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORMS,
} from "@/app/components/settings/social-section-config"

describe("social settings platform options", () => {
  it.each(["facebook", "threads", "twitter", "x", "youtube"])(
    "temporarily hides %s from new account options",
    (value) => {
      expect(NEW_ACCOUNT_SOCIAL_PLATFORMS.some((platform) => platform.value === value)).toBe(false)
    },
  )

  it("keeps the remaining networks available in their original order", () => {
    expect(NEW_ACCOUNT_SOCIAL_PLATFORMS.map((platform) => platform.value)).toEqual([
      "instagram",
      "linkedin",
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

  it("allows Instagram for new account connections", () => {
    expect(
      NEW_ACCOUNT_SOCIAL_PLATFORMS.map(({ value }) => value)
    ).toContain("instagram")
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
