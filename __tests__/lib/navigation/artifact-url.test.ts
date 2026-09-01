import {
  appendArtifactIfNeeded,
  rememberArtifactSession,
  shouldPreserveArtifact,
} from "@/lib/navigation/artifact-url"

describe("artifact-url", () => {
  beforeEach(() => {
    // Clear global state between tests
    delete (window as any)._isArtifactSession
    
    // Mock window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        search: "",
      },
    })
  })

  describe("rememberArtifactSession", () => {
    it("sets _isArtifactSession flag on window", () => {
      expect((window as any)._isArtifactSession).toBeUndefined()
      rememberArtifactSession()
      expect((window as any)._isArtifactSession).toBe(true)
    })
  })

  describe("shouldPreserveArtifact", () => {
    it("returns false if there is no flag and no session", () => {
      window.location.search = "?other=true"
      expect(shouldPreserveArtifact()).toBe(false)
    })

    it("returns true and sets session if URL has flag", () => {
      window.location.search = "?artifact=true&other=1"
      expect(shouldPreserveArtifact()).toBe(true)
      expect((window as any)._isArtifactSession).toBe(true)
    })

    it("returns true if session was previously set even without URL flag", () => {
      (window as any)._isArtifactSession = true
      window.location.search = "?other=true"
      expect(shouldPreserveArtifact()).toBe(true)
    })
  })

  describe("appendArtifactIfNeeded", () => {
    it("returns unmodified URL when artifact should not be preserved", () => {
      expect(appendArtifactIfNeeded("/foo?bar=1")).toBe("/foo?bar=1")
    })

    describe("when artifact should be preserved", () => {
      beforeEach(() => {
        (window as any)._isArtifactSession = true
      })

      it("returns original href if it's not a relative path", () => {
        expect(appendArtifactIfNeeded("https://example.com/foo")).toBe("https://example.com/foo")
        expect(appendArtifactIfNeeded("mailto:test@example.com")).toBe("mailto:test@example.com")
      })

      it("appends flag to path without query", () => {
        expect(appendArtifactIfNeeded("/dashboard")).toBe("/dashboard?artifact=true")
      })

      it("appends flag to path with existing query", () => {
        expect(appendArtifactIfNeeded("/dashboard?tab=1")).toBe("/dashboard?tab=1&artifact=true")
      })

      it("appends flag keeping hash intact", () => {
        expect(appendArtifactIfNeeded("/dashboard#section1")).toBe("/dashboard?artifact=true#section1")
        expect(appendArtifactIfNeeded("/dashboard?tab=1#section1")).toBe("/dashboard?tab=1&artifact=true#section1")
      })

      it("does not append flag if it is already present", () => {
        expect(appendArtifactIfNeeded("/dashboard?artifact=true")).toBe("/dashboard?artifact=true")
        expect(appendArtifactIfNeeded("/dashboard?a=1&artifact=true&b=2")).toBe("/dashboard?a=1&artifact=true&b=2")
      })

      it("handles null/undefined hrefs gracefully", () => {
        expect(appendArtifactIfNeeded(null)).toBe("")
        expect(appendArtifactIfNeeded(undefined)).toBe("")
      })
    })
  })
})
