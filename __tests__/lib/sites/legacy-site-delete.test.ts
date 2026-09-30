import { deleteSite } from "@/lib/services/site-service"
import { deleteSiteRecord } from "@/app/context/site-crud"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/sites/logo-cache", () => ({ saveLogoToCache: jest.fn() }))
jest.mock("@/app/agents/voice-sync", () => ({ requestVoiceAgentResync: jest.fn() }))

it("rejects legacy service deletion instead of issuing a destructive RPC", async () => {
  await expect(deleteSite("site-id")).rejects.toThrow("Site deletion is disabled")
  expect(createClient).not.toHaveBeenCalled()
})

it("rejects legacy context deletion without changing sites or using Supabase", async () => {
  const deps = { setError: jest.fn(), supabase: { rpc: jest.fn() }, setSites: jest.fn() }
  await expect(deleteSiteRecord("site-id", deps as any)).rejects.toThrow("Site deletion is disabled")
  expect(deps.setError).toHaveBeenCalledWith(expect.any(Error))
  expect(deps.supabase.rpc).not.toHaveBeenCalled()
  expect(deps.setSites).not.toHaveBeenCalled()
})