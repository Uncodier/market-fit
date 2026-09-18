import {
  DEFAULT_PUBLIC_ACCESS_TOKEN_TTL_DAYS,
  getPublicAccessTokenExpiresAt,
  resolvePublicAccessTokenTtlDays,
} from "@/app/documents/public-token"
import { ensurePublicAccessTokenForRecord } from "@/app/documents/public-token-store"

function query(result: unknown) {
  const builder: any = {}
  builder.select = jest.fn(() => builder)
  builder.update = jest.fn(() => builder)
  builder.eq = jest.fn(() => builder)
  builder.is = jest.fn(() => builder)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  return builder
}

describe("public token issuance", () => {
  const now = new Date("2026-09-17T12:00:00.000Z")
  const oldToken = "aaaaaaaaaaaaaaaaaaaaaaaa"
  const winningToken = "bbbbbbbbbbbbbbbbbbbbbbbb"

  it("uses a bounded configurable TTL", () => {
    expect(resolvePublicAccessTokenTtlDays(undefined)).toBe(
      DEFAULT_PUBLIC_ACCESS_TOKEN_TTL_DAYS
    )
    expect(resolvePublicAccessTokenTtlDays("7")).toBe(7)
    expect(resolvePublicAccessTokenTtlDays("9999")).toBe(365)
    expect(getPublicAccessTokenExpiresAt(now, 30)).toBe(
      "2026-10-17T12:00:00.000Z"
    )
  })

  it("returns an existing active token without writing", async () => {
    const read = query({
      data: {
        id: "doc-1",
        public_access_token: oldToken,
        public_access_token_expires_at: "2026-10-01T00:00:00.000Z",
        public_access_token_revoked_at: null,
      },
      error: null,
    })
    const client = { from: jest.fn(() => read) }

    const result = await ensurePublicAccessTokenForRecord(
      client,
      "quotations",
      "doc-1",
      { now }
    )

    expect(result).toEqual({
      token: oldToken,
      expiresAt: "2026-10-01T00:00:00.000Z",
    })
    expect(read.update).not.toHaveBeenCalled()
  })

  it("returns the winning token when a concurrent compare-and-set wins", async () => {
    const initial = query({
      data: {
        id: "doc-1",
        public_access_token: oldToken,
        public_access_token_expires_at: "2026-09-16T00:00:00.000Z",
        public_access_token_revoked_at: null,
      },
      error: null,
    })
    const update = query({ data: null, error: null })
    const winner = query({
      data: {
        id: "doc-1",
        public_access_token: winningToken,
        public_access_token_expires_at: "2026-10-17T12:00:00.000Z",
        public_access_token_revoked_at: null,
      },
      error: null,
    })
    const client = {
      from: jest
        .fn()
        .mockReturnValueOnce(initial)
        .mockReturnValueOnce(update)
        .mockReturnValueOnce(winner),
    }

    const result = await ensurePublicAccessTokenForRecord(
      client,
      "quotations",
      "doc-1",
      { now }
    )

    expect(result).toEqual({
      token: winningToken,
      expiresAt: "2026-10-17T12:00:00.000Z",
    })
    expect(update.update).toHaveBeenCalledWith({
      public_access_token: expect.any(String),
      public_access_token_expires_at: "2026-10-17T12:00:00.000Z",
      public_access_token_revoked_at: null,
    })
    expect(update.eq).toHaveBeenCalledWith("public_access_token", oldToken)
    expect(update.eq).toHaveBeenCalledWith(
      "public_access_token_expires_at",
      "2026-09-16T00:00:00.000Z"
    )
    expect(update.is).toHaveBeenCalledWith(
      "public_access_token_revoked_at",
      null
    )
  })
})
