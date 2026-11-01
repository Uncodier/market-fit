import { createDemoMockClient } from "@/lib/demo-data/mock-client";
import { demoHasLocationRestrictions, demoHasSiteLocationRestrictions } from "@/lib/demo-data/location-restrictions";
import { AbortableDemoRpc } from "@/lib/demo-data/abortable-rpc";

const demos = ["demo-habituall", "demo-saas-en-123", "demo-ecom-es-456"];

describe("demo POS permission RPC contract", () => {
  it.each(demos)("verifies the seeded unrestricted owner of %s with cancellation", async siteId => {
    const client = createDemoMockClient(siteId);
    const signal = new AbortController().signal;
    await expect(client.rpc("current_user_site_role", { p_site_id: siteId }).abortSignal(signal))
      .resolves.toEqual({ data: "owner", error: null });
    await expect(client.rpc("current_user_has_site_location_restrictions", { p_site_id: siteId }).abortSignal(signal))
      .resolves.toEqual({ data: false, error: null });
    await expect(client.rpc("current_user_has_location_restrictions").abortSignal(signal))
      .resolves.toEqual({ data: false, error: null });
  });

  it.each([undefined, null, {}, { p_site_id: 123 }, { p_site_id: "demo-ecom-es-456" },
    { p_site_id: "11111111-1111-4111-8111-111111111111" }])("denies foreign or malformed scope %p", async params => {
    await expect(createDemoMockClient("demo-habituall").rpc("current_user_has_site_location_restrictions", params))
      .resolves.toEqual({ data: true, error: null });
  });

  it("does not grant an unknown demo", async () => {
    const client = createDemoMockClient("demo-missing");
    await expect(client.rpc("current_user_has_location_restrictions")).resolves.toEqual({ data: true, error: null });
    await expect(client.rpc("current_user_has_site_location_restrictions", { p_site_id: "demo-missing" }))
      .resolves.toEqual({ data: true, error: null });
  });

  it("retains member exclusions, owner exemptions and revoked membership denial", () => {
    const data = {
      sites: [{ id: "demo-members", user_id: "owner", archived_at: null as string | null }],
      site_members: [{ id: "m", site_id: "demo-members", user_id: "member", role: "collaborator", status: "active" }],
      site_member_location_restrictions: [{ site_id: "demo-members", site_member_id: "m" }],
    };
    expect(demoHasSiteLocationRestrictions(data, "demo-members", "member", "demo-members")).toBe(true);
    expect(demoHasLocationRestrictions(data, "demo-members", "member")).toBe(true);
    expect(demoHasSiteLocationRestrictions(data, "demo-members", "owner", "demo-members")).toBe(false);
    data.site_member_location_restrictions = [];
    expect(demoHasSiteLocationRestrictions(data, "demo-members", "member", "demo-members")).toBe(false);
    data.site_members[0].status = "inactive";
    expect(demoHasSiteLocationRestrictions(data, "demo-members", "member", "demo-members")).toBe(true);
    data.sites[0].archived_at = new Date().toISOString();
    expect(demoHasSiteLocationRestrictions(data, "demo-members", "owner", "demo-members")).toBe(true);
    expect(demoHasSiteLocationRestrictions(data, "demo-members", undefined, "demo-members")).toBe(true);
  });

  it("rejects pre-aborted RPCs without starting work", async () => {
    const controller = new AbortController();
    controller.abort();
    const run = jest.fn(async () => "value");
    await expect(new AbortableDemoRpc(run).abortSignal(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(run).not.toHaveBeenCalled();
  });

  it("settles cancellation while fixture work is pending and ignores late completion", async () => {
    const controller = new AbortController();
    let resolve!: (value: string) => void;
    const work = new Promise<string>(done => { resolve = done; });
    const request = new AbortableDemoRpc(() => work).abortSignal(controller.signal);
    const result = Promise.resolve(request);
    await Promise.resolve();
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    resolve("late success");
  });
});