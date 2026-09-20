import {
  getApiKeyFromRequest,
  isValidApiKey,
} from "@/app/lib/api-keys-config"

describe("API key configuration", () => {
  const originalApiKey = process.env.API_KEY
  const originalApiKeys = process.env.API_KEYS

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.API_KEY
    else process.env.API_KEY = originalApiKey
    if (originalApiKeys === undefined) delete process.env.API_KEYS
    else process.env.API_KEYS = originalApiKeys
  })

  it("does not include a built-in development key", () => {
    delete process.env.API_KEY
    delete process.env.API_KEYS

    expect(isValidApiKey("market-fit-dev-api-key")).toBe(false)
  })

  it("accepts configured keys using a constant-time comparison", () => {
    process.env.API_KEY = "primary-secret"
    process.env.API_KEYS = "rotating-secret,next-secret"

    expect(isValidApiKey("primary-secret")).toBe(true)
    expect(isValidApiKey("rotating-secret")).toBe(true)
    expect(isValidApiKey("invalid-secret")).toBe(false)
  })

  it("reads keys from headers but never from query parameters", () => {
    const headers = new Headers({ "x-api-key": "header-secret" })

    expect(getApiKeyFromRequest(headers)).toBe("header-secret")
    expect(getApiKeyFromRequest(new Headers())).toBeNull()
  })
})
