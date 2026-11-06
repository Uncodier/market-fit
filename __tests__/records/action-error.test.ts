import { getRecordActionError } from "@/app/records/lib/action-error"

describe("record action errors", () => {
  it("preserves Error and database error messages", () => {
    expect(getRecordActionError(new Error("Not authenticated"), "Fallback"))
      .toBe("Not authenticated")
    expect(getRecordActionError({ message: "Access denied", code: "42501" }, "Fallback"))
      .toBe("Access denied")
  })

  it.each([null, undefined, "failure", 42, {}, { message: "" }, { message: 42 }])(
    "uses a string fallback for unexpected thrown value %p",
    (error) => {
      expect(getRecordActionError(error, "Failed to fetch records"))
        .toBe("Failed to fetch records")
    },
  )
})