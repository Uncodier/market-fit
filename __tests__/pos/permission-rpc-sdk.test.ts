import { createClient } from "@supabase/supabase-js";
import { wrapSupabaseClient } from "@/lib/permissions/mutation-guard";

describe("real POS permission RPC cancellation", () => {
  it("preserves SDK abortable RPCs after applying the browser mutation guard", async () => {
    const transport = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true, status: 200, statusText: "OK", headers: new Headers(),
      text: async () => JSON.stringify(String(_input).includes("current_user_site_role") ? "owner" : false),
      signal: init?.signal,
    } as unknown as Response));
    const client = wrapSupabaseClient(createClient("https://pos-sdk-test.invalid", "test-public-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: transport },
    }));
    const signal = new AbortController().signal;
    const siteId = "11111111-1111-4111-8111-111111111111";
    const requests = [
      client.rpc("current_user_site_role", { p_site_id: siteId }).abortSignal(signal),
      client.rpc("current_user_has_site_location_restrictions", { p_site_id: siteId }).abortSignal(signal),
      client.rpc("current_user_has_location_restrictions").abortSignal(signal),
    ];
    expect(transport).not.toHaveBeenCalled();
    const results = await Promise.all(requests);
    expect(results.map(result => result.data)).toEqual(["owner", false, false]);
    expect(results.every(result => result.error === null)).toBe(true);
    expect(transport).toHaveBeenCalledTimes(3);
    for (const [, init] of transport.mock.calls) expect(init?.signal).toBe(signal);
  });
});