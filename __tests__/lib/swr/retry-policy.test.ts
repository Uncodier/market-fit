import { isTerminalRequestError } from "@/lib/swr/retry-policy"

it.each(["Forbidden", "Unauthorized", "Not authenticated", "Authentication required"])
  ("does not retry %s returned by a Server Action", message => {
    expect(isTerminalRequestError(new Error(message))).toBe(true)
  })
it.each([400, 401, 403, 404, 422])("does not retry HTTP %i", status => {
  expect(isTerminalRequestError({ status })).toBe(true)
})
it.each([408, 429, 500, 502, 503])("permits bounded retries for HTTP %i", status => {
  expect(isTerminalRequestError({ status })).toBe(false)
})
it("allows temporary verification and network failures", () => {
  expect(isTerminalRequestError(new Error("Site access could not be verified. Please try again."))).toBe(false)
  expect(isTerminalRequestError(new TypeError("fetch failed"))).toBe(false)
})