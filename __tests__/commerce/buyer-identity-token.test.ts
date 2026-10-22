/** @jest-environment node */
jest.mock("server-only", () => ({}))
import { issueBuyerIdentityToken, verifyBuyerIdentityToken } from "@/app/commerce/buyer-identity-token"

const buyer = "d62a5c4c-8543-4b58-978d-103f2d735b28"
const now = 1_790_000_000_000
const originalSecret = process.env.SUPABASE_SERVICE_ROLE_KEY

beforeEach(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated-test-key-never-a-real-credential" })
afterAll(() => {
  if (originalSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSecret
})

it("issues distinct short-lived proofs and verifies identity", () => {
  const result = issueBuyerIdentityToken(buyer, now)
  expect(result.code).toMatch(/^mf:buyer:/)
  expect(result.expiresAt).toBe(now + 300_000)
  expect(verifyBuyerIdentityToken(result.code, now)).toBe(buyer)
  expect(issueBuyerIdentityToken(buyer, now).code).not.toBe(result.code)
})

it("rejects raw account IDs, tampering, invalid shapes and expiry", () => {
  const { code } = issueBuyerIdentityToken(buyer, now)
  for (const value of [null, {}, `mf:user:${buyer}`, code + ".extra", code.slice(0, -2) + "aa", "mf:buyer:invalid.invalid"]) {
    expect(verifyBuyerIdentityToken(value, now)).toBeNull()
  }
  expect(verifyBuyerIdentityToken(code, now + 300_000)).toBeNull()
  expect(verifyBuyerIdentityToken(code, now - 1000)).toBeNull()
})

it("revokes proofs on signing-key rotation and fails closed without a key", () => {
  const { code } = issueBuyerIdentityToken(buyer, now)
  process.env.SUPABASE_SERVICE_ROLE_KEY = "rotated-isolated-test-key"
  expect(verifyBuyerIdentityToken(code, now)).toBeNull()
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  expect(() => verifyBuyerIdentityToken(code, now)).toThrow("unavailable")
  expect(() => issueBuyerIdentityToken(buyer, now)).toThrow("unavailable")
})