import { mergeOutstandIntoSocialMedia } from "@/app/api/social/lib/sync-outstand-accounts"

const linkedinAccount = {
  id: "new-linkedin-id",
  nickname: "makinari",
  network: "linkedin",
  username: "@uncodie",
  profile_picture_url: "https://example.com/pic.png",
}

describe("mergeOutstandIntoSocialMedia", () => {
  it("fills an empty platform stub", () => {
    const { socialMedia, mergedCount } = mergeOutstandIntoSocialMedia(
      [{ platform: "linkedin", isActive: false }],
      [linkedinAccount],
      "linkedin"
    )

    expect(mergedCount).toBe(1)
    expect(socialMedia).toHaveLength(1)
    expect(socialMedia[0]).toMatchObject({
      id: "new-linkedin-id",
      platform: "linkedin",
      username: "@uncodie",
      isActive: true,
    })
  })

  it("reactivates a lost connection with a new Outstand id", () => {
    const { socialMedia, mergedCount } = mergeOutstandIntoSocialMedia(
      [{
        id: "old-linkedin-id",
        platform: "linkedin",
        username: "@uncodie",
        handle: "@uncodie",
        isActive: false,
        initialImport: { status: "completed", jobId: "old-job" },
      }],
      [linkedinAccount],
      "linkedin"
    )

    expect(mergedCount).toBe(1)
    expect(socialMedia).toHaveLength(1)
    expect(socialMedia[0]).toMatchObject({
      id: "new-linkedin-id",
      username: "@uncodie",
      isActive: true,
    })
    expect(socialMedia[0].initialImport).toBeUndefined()
  })

  it("updates an existing account by id without adding a duplicate", () => {
    const { socialMedia, mergedCount } = mergeOutstandIntoSocialMedia(
      [{
        id: "new-linkedin-id",
        platform: "linkedin",
        username: "@uncodie",
        isActive: false,
        initialImport: { status: "completed", jobId: "same-account-job" },
      }],
      [linkedinAccount],
      "linkedin"
    )

    expect(mergedCount).toBe(0)
    expect(socialMedia).toHaveLength(1)
    expect(socialMedia[0].isActive).toBe(true)
    expect(socialMedia[0].initialImport).toEqual({ status: "completed", jobId: "same-account-job" })
  })

  it("never accepts an import flag sent in Outstand account metadata", () => {
    const { socialMedia } = mergeOutstandIntoSocialMedia(
      [{ id: "new-linkedin-id", platform: "linkedin", isActive: false }],
      [{ ...linkedinAccount, initialImport: { status: "completed", jobId: "fake" } }],
      "linkedin"
    )
    expect(socialMedia[0].initialImport).toBeUndefined()
  })
})
