/** @jest-environment node */
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createSocialSupabaseClient, SocialLocationAccessError } from "@/app/api/social/supabase-client"
import { DELETE } from "@/app/api/social/accounts/[accountId]/route"
import { NextRequest } from "next/server"

jest.mock("@supabase/ssr", () => ({ createServerClient: jest.fn() }))
jest.mock("next/headers", () => ({ cookies: jest.fn() }))
const rpc = jest.fn(), getUser = jest.fn(), getSession = jest.fn(), set = jest.fn()
const client = { rpc, auth: { getUser, getSession } }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(cookies).mockResolvedValue({ get: jest.fn(), set } as never)
  jest.mocked(createServerClient).mockReturnValue(client as never)
  getUser.mockResolvedValue({ data: { user: { id: "actor" } }, error: null })
  getSession.mockResolvedValue({ data: { session: { user: { id: "actor" } } }, error: null })
  rpc.mockResolvedValue({ data: false, error: null })
})

it("keeps verified unrestricted social access and non-destructive cookie behavior", async () => {
  expect(await createSocialSupabaseClient()).toBe(client)
  const options = jest.mocked(createServerClient).mock.calls[0][2] as {
    cookies: { set: (name: string, value: string, options: { maxAge?: number }) => void; remove: () => void }
  }
  options.cookies.set("session", "", {})
  options.cookies.set("session", "expired", { maxAge: 0 })
  options.cookies.remove()
  expect(set).not.toHaveBeenCalled()
  options.cookies.set("session", "fresh", {})
  expect(set).toHaveBeenCalledWith({ name: "session", value: "fresh" })
})

it.each([true, null, "false"])("denies private social proxy with scope %p before forwarding the service key", async state => {
  rpc.mockResolvedValue({ data: state, error: null })
  const response = await DELETE(new NextRequest("https://app.test/api/social/accounts/private"), {
    params: Promise.resolve({ accountId: "private" }),
  })
  expect(response.status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
  expect(getSession).not.toHaveBeenCalled()
})

it("fails closed on missing predicates and unauthorized sessions", async () => {
  rpc.mockResolvedValue({ data: false, error: { code: "PGRST202" } })
  await expect(createSocialSupabaseClient()).rejects.toBeInstanceOf(SocialLocationAccessError)
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(createSocialSupabaseClient()).rejects.toMatchObject({ status: 401 })
})