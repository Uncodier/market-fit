import {
  isChunkLoadError,
  isStaleClientBundleError,
} from "@/app/components/ChunkErrorGuard"

describe("stale client bundle recovery", () => {
  it("treats missing SiteProvider as a stale bundle, not a generic crash", () => {
    expect(
      isStaleClientBundleError(new Error("useSite must be used within a SiteProvider"))
    ).toBe(true)
    expect(
      isStaleClientBundleError("Error: useSite must be used within a SiteProvider")
    ).toBe(true)
  })

  it("still recognizes chunk load failures", () => {
    const error = new Error("Loading chunk 655872ce8bb342d3 failed")
    error.name = "ChunkLoadError"
    expect(isChunkLoadError(error)).toBe(true)
    expect(isStaleClientBundleError(error)).toBe(true)
  })

  it("does not reload on unrelated application errors", () => {
    expect(isStaleClientBundleError(new Error("Project name is required"))).toBe(false)
    expect(isChunkLoadError(new Error("Project name is required"))).toBe(false)
  })
})
