import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"
import { SHARED_MODULE_IMAGE_AREAS } from "@/app/config/shared-module-images"

describe("Profile icon", () => {
  it("uses the shared 3D style with a distinct single-user silhouette", () => {
    const prompt = getModuleImagePrompt("settings", "profile", "Profile")
    expect(prompt).toContain("Front-facing 3D user avatar")
    expect(prompt).toContain("single user account")
    expect(prompt).toContain("smooth glossy plastic and frosted glass texture")
    expect(prompt).toContain("strong legibility at small UI sizes")
    expect(prompt).not.toBe(getModuleImagePrompt("sales", "leads", "Contacts"))
    expect(prompt).toBe(getModuleImagePrompt("settings", "profile", "Alex Morgan"))
    expect(prompt).not.toContain("Alex Morgan")
  })

  it("uses Makinari's fixed shared delivery instead of a tenant-scoped request", () => {
    expect(SHARED_MODULE_IMAGE_AREAS.profile).toBe("settings")
    expect(getModuleImageUrl("settings", "profile", "Profile"))
      .toBe("/api/images/modules/profile")
  })
})