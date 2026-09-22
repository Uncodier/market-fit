import {
  NEW_ACCOUNT_SOCIAL_PLATFORMS,
  SOCIAL_PLATFORMS,
} from "@/app/components/settings/social-section-config"

describe("social settings platform options", () => {
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
