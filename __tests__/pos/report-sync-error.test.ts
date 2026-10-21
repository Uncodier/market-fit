/** @jest-environment node */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformSync } from "next/dist/build/swc";
import { reportPosSyncError } from "@/app/pos/actions/report-sync-error";
import { checkRateLimit, hashRedisKeyPart } from "@/lib/redis/control-plane";
import { executeRedisCommand } from "@/lib/redis/upstash-rest";
import { createClient } from "@/lib/supabase/server";
import type { PosSyncErrorReport } from "@/app/pos/sync-error-report";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/redis/upstash-rest", () => ({ executeRedisCommand: jest.fn() }));
jest.mock("@/lib/redis/control-plane", () => {
  const actual = jest.requireActual<typeof import("@/lib/redis/control-plane")>("@/lib/redis/control-plane");
  return { ...actual, checkRateLimit: jest.fn(actual.checkRateLimit), hashRedisKeyPart: jest.fn() };
});

const siteId = "d273a47a-7b20-4bbb-8e77-9d6701e8b9f0";
const otherSiteId = "51c1609a-621e-4a18-9ef9-140ec73e9948";
const userId = "37cd48af-9242-4f06-b661-03c8f178de89";
const report: PosSyncErrorReport = {
  siteId, operation: "catalog", error: "Failed to load POS catalog data",
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const envKeys = ["POS_SYNC_ERROR_EMAIL", "SENDGRID_API_KEY", "SENDGRID_FROM_EMAIL", "SENDGRID_FROM_NAME"] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const getUser = jest.fn();
const rpc = jest.fn();
const counters = new Map<string, number>();
const fetchMock = jest.mocked(fetch);

function sentEmail() {
  const options = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(options?.body)) as {
    personalizations: { to: { email: string }[] }[];
    from: { email: string; name?: string };
    subject: string;
    content: { type: string; value: string }[];
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  counters.clear();
  process.env.POS_SYNC_ERROR_EMAIL = "pos-diagnostics@example.test";
  process.env.SENDGRID_API_KEY = "test-provider-key";
  process.env.SENDGRID_FROM_EMAIL = "sender@example.test";
  process.env.SENDGRID_FROM_NAME = "POS diagnostics";
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  rpc.mockImplementation(async (name: string) => ({ data: name === "current_user_site_role" ? "owner" : false, error: null }));
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as never);
  jest.mocked(hashRedisKeyPart).mockImplementation(async (value) => hash(value));
  jest.mocked(executeRedisCommand).mockImplementation(async (command) => {
    const key = String(command[3]);
    const count = (counters.get(key) ?? 0) + 1;
    counters.set(key, count);
    return { configured: true, result: [count, 900_000] } as never;
  });
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 202 } as Response);
});

afterEach(() => {
  jest.useRealTimers();
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("POS sync error report authorization", () => {
  it("requires a valid authenticated identity before admission or email", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await reportPosSyncError(report)).toEqual({ error: "Not authenticated" });
    expect(rpc).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("denies another site using the session-scoped role check", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await reportPosSyncError({ ...report, siteId: otherSiteId })).toEqual({ error: "Forbidden" });
    expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: otherSiteId });
    expect(hashRedisKeyPart).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not reveal session or role-provider exceptions", async () => {
    getUser.mockRejectedValue(new Error("Bearer private-auth-secret"));
    expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error reporting is temporarily unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POS sync error report validation", () => {
  it.each([
    null, [], "error", {},
    { ...report, siteId: "demo-site" },
    { ...report, siteId: "00000000-0000-0000-0000-000000000000" },
    { ...report, operation: "send_email" },
    { ...report, error: "   " },
    { ...report, error: "x".repeat(2001) },
    { ...report, error: { message: "failed" } },
    { ...report, attempts: -1 },
    { ...report, attempts: 1.5 },
    { ...report, attempts: "2" },
    { ...report, attempts: 1_000_001 },
    { ...report, clientMutationId: "" },
    { ...report, clientMutationId: " \t" },
    { ...report, clientMutationId: "mutation\nrecipient@example.test" },
    { ...report, clientMutationId: "x".repeat(129) },
    { ...report, payload: { email: "customer@example.test" } },
    { ...report, recipient: "attacker@example.test" },
    { ...report, userId: "attacker" },
  ])("rejects malformed or extra input %# without sending", async (input) => {
    expect(await reportPosSyncError(input)).toEqual({ error: "Invalid POS sync error report" });
    expect(createClient).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["catalog", "orders", "outbox", "checkout", "check_in", "create_lead", "update_order_notes"])(
    "accepts the %s operation with a bounded local mutation ID", async (operation) => {
      expect(await reportPosSyncError({ ...report, operation, clientMutationId: "local_mutation-12", attempts: 0 })).toEqual({ ok: true });
      expect(sentEmail().subject).toBe(`POS sync error: ${operation}`);
      expect(sentEmail().content[0].value).toContain("Attempts: 0");
    },
  );
});

describe("server-owned recipient and privacy", () => {
  it("reuses SendGrid config and sends only to the configured mailbox using a fixed secure request", async () => {
    expect(await reportPosSyncError(report)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("https://api.sendgrid.com/v3/mail/send", expect.objectContaining({
      method: "POST", redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
      headers: { Authorization: "Bearer test-provider-key", "Content-Type": "application/json" },
    }));
    expect(sentEmail().personalizations).toEqual([{ to: [{ email: "pos-diagnostics@example.test" }] }]);
    expect(sentEmail().from).toEqual({ email: "sender@example.test", name: "POS diagnostics" });
    expect(sentEmail().content[0].type).toBe("text/plain");
    expect(rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId });
  });

  it.each(envKeys.filter((key) => key !== "SENDGRID_FROM_NAME"))("explicitly rejects missing %s", async (key) => {
    delete process.env[key];
    expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error email is not configured" });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["a@example.test,b@example.test", "Name <a@example.test>", "a@example.test\r\nBcc: b@example.test"])(
    "rejects an invalid or multiple configured recipient %#", async (recipient) => {
      process.env.POS_SYNC_ERROR_EMAIL = recipient;
      expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error email is not configured" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid server sender and allows an omitted display name", async () => {
    process.env.SENDGRID_FROM_EMAIL = "invalid-mailbox";
    expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error email is not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.SENDGRID_FROM_EMAIL = "sender@example.test";
    delete process.env.SENDGRID_FROM_NAME;
    expect(await reportPosSyncError(report)).toEqual({ ok: true });
    expect(sentEmail().from).toEqual({ email: "sender@example.test" });
  });

  it("drops arbitrary PII, credentials, HTML, URLs and serialized payloads rather than forwarding prose", async () => {
    const mutation = "customer@example.test / local secret";
    const error = 'Customer Jane Doe customer@example.test +1 555 123 4567, 25 Private Street, Bearer token123 api_key=private-key <img src=x> https://private.test/?token=secret {"notes":"private notes","password":"secret"}';
    expect(await reportPosSyncError({ ...report, error, clientMutationId: mutation, attempts: 3 })).toEqual({ ok: true });
    const email = sentEmail();
    const serialized = JSON.stringify(email);
    for (const privateText of ["Jane Doe", "customer@example.test", "555", "Private Street", "token123", "private-key", "<img", "private.test", "private notes", mutation]) {
      expect(serialized).not.toContain(privateText);
    }
    expect(email.content).toHaveLength(1);
    expect(email.content[0].value).toContain("Error details were redacted for privacy");
    expect(email.content[0].value).toContain(`Mutation fingerprint (SHA-256): ${hash(mutation)}`);
    expect(email.content[0].value).toContain("Attempts: 3");
  });

  it.each([
    ["Timeout: Jane Doe private@example.test", "The sync operation timed out."],
    ["Failed to fetch https://private.test?token=secret", "A sync network request failed."],
    ["Forbidden for customer@example.test", "Sync authentication or authorization failed."],
    ["Waiting for local lead to sync Jane Doe", "A local sync dependency is not ready."],
    ["Open orders are being refreshed private payload", "Sync data is being refreshed."],
    ["Insufficient stock for Private Product customer@example.test", "Sync inventory availability validation failed."],
    ["Order has changed for Jane Doe", "Sync encountered a changed order or version conflict."],
    ["Invalid ticket code PRIVATE-CODE customer@example.test", "Sync ticket check-in validation failed."],
    ["duplicate key violates constraint: private@example.test", "A sync storage operation failed."],
  ])("keeps only a fixed diagnostic category for %#", async (error, diagnostic) => {
    await reportPosSyncError({ ...report, error });
    expect(sentEmail().content[0].value).toContain(`Error: ${diagnostic}`);
    expect(sentEmail().content[0].value).not.toContain(error);
  });
});

describe("server rate limits", () => {
  it("hashes identities and applies fail-closed site, user and same-report limits", async () => {
    await reportPosSyncError({ ...report, clientMutationId: "local_12" });
    expect(checkRateLimit).toHaveBeenNthCalledWith(1, `rl:v1:pos-sync-error:report:${hash(siteId)}:catalog:${hash("local_12")}`, { limit: 1, windowSeconds: 900, failureMode: "closed" });
    expect(checkRateLimit).toHaveBeenNthCalledWith(2, `rl:v1:pos-sync-error:site:${hash(siteId)}`, { limit: 10, windowSeconds: 900, failureMode: "closed" });
    expect(checkRateLimit).toHaveBeenNthCalledWith(3, `rl:v1:pos-sync-error:user:${hash(userId)}`, { limit: 10, windowSeconds: 900, failureMode: "closed" });
    expect(executeRedisCommand).toHaveBeenCalledWith(expect.arrayContaining([900_000]));
  });

  it("suppresses repeats even if errors, attempts or UUID letter case change", async () => {
    expect(await reportPosSyncError(report)).toEqual({ ok: true });
    expect(await reportPosSyncError({ ...report, siteId: siteId.toUpperCase(), error: "new error", attempts: 5 })).toEqual({ error: "POS sync error report limit reached. Try again later." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(counters.get(`rl:v1:pos-sync-error:site:${hash(siteId)}`)).toBe(1);
    expect(counters.get(`rl:v1:pos-sync-error:user:${hash(userId)}`)).toBe(1);
  });

  it("limits unique mutations by aggregate site admission", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await reportPosSyncError({ ...report, clientMutationId: `local_${i}` })).toEqual({ ok: true });
    }
    expect(await reportPosSyncError({ ...report, clientMutationId: "local_11" })).toEqual({ error: "POS sync error report limit reached. Try again later." });
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("admits at most one concurrent same-report send", async () => {
    const results = await Promise.all([reportPosSyncError(report), reportPosSyncError(report)]);
    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({ error: "POS sync error report limit reached. Try again later." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows a later attempt after the Redis suppression window expires", async () => {
    await reportPosSyncError(report);
    // The Redis command mock models expiry by clearing its counters.
    counters.clear();
    expect(await reportPosSyncError(report)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("limits the authenticated user even when the requested site changes", async () => {
    counters.set(`rl:v1:pos-sync-error:user:${hash(userId)}`, 10);
    expect(await reportPosSyncError({ ...report, siteId: otherSiteId })).toEqual({ error: "POS sync error report limit reached. Try again later." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{ configured: false }, { configured: true, error: "private Redis URL" }])(
    "fails closed with a generic error when Redis is unavailable %#", async (response) => {
      jest.mocked(executeRedisCommand).mockResolvedValue(response as never);
      expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error reporting is temporarily unavailable" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not expose Redis exceptions or send an email", async () => {
    jest.mocked(executeRedisCommand).mockRejectedValue(new Error("rediss://secret@private"));
    expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error reporting is temporarily unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("provider failures and action exports", () => {
  it("returns a generic provider error without reading its body, and counts failed sends", async () => {
    const text = jest.fn().mockResolvedValue("provider-key private@example.test");
    fetchMock.mockResolvedValue({ ok: false, status: 400, text } as unknown as Response);
    expect(await reportPosSyncError(report)).toEqual({ error: "Unable to send POS sync error email" });
    expect(text).not.toHaveBeenCalled();
    expect(await reportPosSyncError(report)).toEqual({ error: "POS sync error report limit reached. Try again later." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a generic error for a network rejection", async () => {
    fetchMock.mockRejectedValue(new Error("Authorization: Bearer private-provider-key"));
    expect(await reportPosSyncError(report)).toEqual({ error: "Unable to send POS sync error email" });
  });

  it("aborts a slow SendGrid request after five seconds", async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    }));
    const result = reportPosSyncError(report);
    await jest.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual({ error: "Unable to send POS sync error email" });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it.each([false, true])("compiles its async-only exports with the installed Next transform (server=%s)", (isReactServerLayer) => {
    const filename = resolve(process.cwd(), "app/pos/actions/report-sync-error.ts");
    const result = transformSync(readFileSync(filename, "utf8"), {
      filename, isServerCompiler: isReactServerLayer,
      jsc: { parser: { syntax: "typescript" }, target: "es2022" },
      serverActions: {
        isReactServerLayer, isDevelopment: true, useCacheEnabled: false,
        hashSalt: "pos-sync-error-report-test", cacheKinds: ["default", "remote", "private"],
      },
    });
    expect(result.code.length).toBeGreaterThan(0);
  });
});