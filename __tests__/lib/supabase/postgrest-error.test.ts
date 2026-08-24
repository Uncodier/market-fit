import {
  isAbortError,
  postgrestErrorMessage,
  snapshotPostgrestError,
} from "@/lib/supabase/postgrest-error"

describe("snapshotPostgrestError", () => {
  it("reads message from Error instances that JSON.stringify as {}", () => {
    const error = new Error("JWT expired")
    expect(JSON.stringify(error)).toBe("{}")
    expect(snapshotPostgrestError(error)).toMatchObject({
      name: "Error",
      message: "JWT expired",
    })
  })

  it("reads PostgREST fields from a plain object", () => {
    expect(
      snapshotPostgrestError({
        message: "Could not find the function",
        code: "PGRST202",
        details: "no match",
        hint: "reload schema",
      })
    ).toEqual({
      name: "",
      message: "Could not find the function",
      code: "PGRST202",
      details: "no match",
      hint: "reload schema",
      keys: ["message", "code", "details", "hint"],
    })
  })

  it("does not collapse an empty object to a blank mystery", () => {
    expect(snapshotPostgrestError({}).keys).toEqual([])
    expect(postgrestErrorMessage({}, "Failed to load sites")).toBe("Failed to load sites")
  })
})

describe("isAbortError", () => {
  it("detects aborted fetches", () => {
    expect(isAbortError({ name: "AbortError", message: "The user aborted a request." })).toBe(true)
    expect(isAbortError({ message: "Failed to load sites" })).toBe(false)
  })
})
