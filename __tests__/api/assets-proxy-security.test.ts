import { GET as getAssetProxy } from "@/app/api/assets/proxy/route"
import { GET as getZipProxy } from "@/app/api/assets/proxy-zip/route"
import {
  fetchValidatedAsset,
  readLimitedBody,
} from "@/app/api/assets/proxy-security"
import { createClient } from "@/lib/supabase/server"
import { lookup } from "node:dns/promises"

jest.mock("node:dns/promises", () => ({
  lookup: jest.fn(),
}))

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

jest.mock("next/server", () => ({
  NextResponse: class MockNextResponse {
    status: number
    body: unknown
    headers: Record<string, string>

    constructor(
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = init?.headers ?? {}
    }

    static json(body: unknown, init?: { status?: number }) {
      return {
        status: init?.status ?? 200,
        json: async () => body,
      }
    }
  },
}))

function request(assetUrl: string) {
  return {
    url: `http://localhost:3000/api/assets/proxy?url=${encodeURIComponent(assetUrl)}`,
    nextUrl: new URL(
      `http://localhost:3000/api/assets/proxy?url=${encodeURIComponent(assetUrl)}`
    ),
    headers: { get: jest.fn().mockReturnValue(null) },
  } as any
}

describe("asset proxy URL boundary", () => {
  const originalRepositoryKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY
  const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalRepositoriesUrl =
    process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.REPOSITORIES_SUPABASE_SECRET_KEY = "test-only-secret"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co"
    process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL =
      "https://repositories.supabase.co"
    ;(lookup as jest.Mock).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ])
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    })
  })

  afterAll(() => {
    if (originalRepositoryKey === undefined) {
      delete process.env.REPOSITORIES_SUPABASE_SECRET_KEY
    } else {
      process.env.REPOSITORIES_SUPABASE_SECRET_KEY = originalRepositoryKey
    }
    if (originalSupabaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl
    }
    if (originalRepositoriesUrl === undefined) {
      delete process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL =
        originalRepositoriesUrl
    }
  })

  it.each([
    "https://supabase.co.attacker.test/private.pdf",
    "https://attacker.test/file?next=https://db.makinari.com",
    "http://project.supabase.co/private.pdf",
  ])("rejects an unsafe allowlist bypass without fetching it: %s", async (assetUrl) => {
    const response = await getAssetProxy(request(assetUrl))

    expect(response.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("rejects an unrelated host without fetching it", async () => {
    const response = await getAssetProxy(request("https://example.com/file.pdf"))

    expect(response.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([
    "https://supabase.co.attacker.test/private.zip",
    "https://attacker.test/file?next=https://db.makinari.com",
    "http://project.supabase.co/private.zip",
  ])("does not forward service credentials to an unsafe ZIP target: %s", async (assetUrl) => {
    const response = await getZipProxy(request(assetUrl))

    expect(response.status).toBe(403)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("rejects an allowed hostname when DNS resolves to a private address", async () => {
    ;(lookup as jest.Mock).mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ])

    const response = await getAssetProxy(
      request("https://project.supabase.co/private.pdf")
    )

    expect(response.status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("validates redirect destinations before following them", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 302,
      headers: {
        get: jest.fn((name: string) =>
          name.toLowerCase() === "location"
            ? "https://attacker.test/private.pdf"
            : null
        ),
      },
    })

    const response = await getAssetProxy(
      request("https://project.supabase.co/file.pdf")
    )

    expect(response.status).toBe(400)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("rejects oversized upstream responses", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: jest.fn((name: string) =>
          name.toLowerCase() === "content-length"
            ? String(101 * 1024 * 1024)
            : null
        ),
      },
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    })

    const response = await getAssetProxy(
      request("https://project.supabase.co/file.pdf")
    )

    expect(response.status).toBe(413)
  })

  it("enforces the byte limit when content-length is absent", async () => {
    const cancel = jest.fn()
    const read = jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(3) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array(3) })

    await expect(
      readLimitedBody(
        {
          headers: { get: jest.fn().mockReturnValue(null) },
          body: { getReader: () => ({ read, cancel }) },
        } as any,
        5
      )
    ).rejects.toMatchObject({ status: 413 })
    expect(cancel).toHaveBeenCalled()
  })

  it("keeps the timeout active after upstream headers arrive", async () => {
    jest.useFakeTimers()
    let signal: AbortSignal | undefined
    ;(global.fetch as jest.Mock).mockImplementationOnce(
      async (_url: URL, init: RequestInit) => {
        signal = init.signal as AbortSignal
        return {
          ok: true,
          status: 200,
          headers: { get: jest.fn().mockReturnValue(null) },
        }
      }
    )

    try {
      const fetched = await fetchValidatedAsset(
        new URL("https://project.supabase.co/file.pdf"),
        {}
      )

      expect(signal?.aborted).toBe(false)
      jest.advanceTimersByTime(15_000)
      expect(signal?.aborted).toBe(true)
      fetched.dispose()
    } finally {
      jest.useRealTimers()
    }
  })

  it("requires authentication before fetching a ZIP asset", async () => {
    const response = await getZipProxy(
      request("https://project.supabase.co/private.zip")
    )

    expect(response.status).toBe(401)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("proxies an allowed public asset within the configured limits", async () => {
    const response = await getAssetProxy(
      request("https://project.supabase.co/file.pdf")
    )

    expect(response.status).toBe(200)
    expect((response as any).headers["Cache-Control"]).toBe("private, no-store")
    expect(global.fetch).toHaveBeenCalledWith(
      new URL("https://project.supabase.co/file.pdf"),
      expect.objectContaining({ redirect: "manual" })
    )
  })

  it("allows public caching only for explicit public storage objects", async () => {
    const response = await getAssetProxy(
      request(
        "https://project.supabase.co/storage/v1/object/public/media/file.pdf"
      )
    )

    expect(response.status).toBe(200)
    expect((response as any).headers["Cache-Control"]).toBe(
      "public, max-age=31536000"
    )
  })

  it("never adds service credentials to an authenticated ZIP request", async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    })

    const response = await getZipProxy(
      request(
        "https://project.supabase.co/storage/v1/object/public/repos/private.zip"
      )
    )

    expect(response.status).toBe(200)
    expect((response as any).headers["Cache-Control"]).toBe("private, no-store")
    expect(global.fetch).toHaveBeenCalledWith(
      new URL(
        "https://project.supabase.co/storage/v1/object/public/repos/private.zip"
      ),
      expect.objectContaining({
        headers: {},
        redirect: "manual",
      })
    )
  })

  it("does not send Supabase credentials to the separate asset host", async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    })

    const response = await getZipProxy(
      request("https://db.makinari.com/archive.zip")
    )

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      new URL("https://db.makinari.com/archive.zip"),
      expect.objectContaining({
        headers: {},
        redirect: "manual",
      })
    )
  })
})
