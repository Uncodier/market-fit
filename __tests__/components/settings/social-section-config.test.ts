import {
  NEW_ACCOUNT_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORMS,
} from "@/app/components/settings/social-section-config"

describe("social settings platform options", () => {
  it("hides Instagram from new account connections", () => {
    expect(
      NEW_ACCOUNT_SOCIAL_PLATFORMS.map(({ value }) => value)
    ).not.toContain("instagram")
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
