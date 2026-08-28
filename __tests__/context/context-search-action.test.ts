import { resolveContextSearchAction } from "@/app/components/context/context-search-action"

describe("resolveContextSearchAction", () => {
  it("does nothing while the modal is closed", () => {
    expect(resolveContextSearchAction({
      open: false,
      wasOpen: false,
      searchTerm: "",
      previousSearchTerm: "",
      hasInitialized: false
    })).toBe("idle")
  })

  it("loads initial data when the modal opens with an empty query", () => {
    expect(resolveContextSearchAction({
      open: true,
      wasOpen: false,
      searchTerm: "",
      previousSearchTerm: "",
      hasInitialized: false
    })).toBe("load-initial")
  })

  it("does not reload after initial data arrives with an empty query", () => {
    expect(resolveContextSearchAction({
      open: true,
      wasOpen: true,
      searchTerm: "",
      previousSearchTerm: "",
      hasInitialized: true
    })).toBe("idle")
  })

  it("restores initial data when the query is cleared", () => {
    expect(resolveContextSearchAction({
      open: true,
      wasOpen: true,
      searchTerm: "",
      previousSearchTerm: "acme",
      hasInitialized: true
    })).toBe("load-initial")
  })

  it("searches when the query is non-empty", () => {
    expect(resolveContextSearchAction({
      open: true,
      wasOpen: true,
      searchTerm: "acme",
      previousSearchTerm: "acm",
      hasInitialized: true
    })).toBe("search")
  })
})
