/** @jest-environment node */
import { searchPosCustomers } from "@/app/pos/actions/search-customers";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";

jest.mock("@/app/pos/actions/site-access", () => ({ requirePosSiteAccess: jest.fn() }));

const leads = [{ id: "lead", site_id: "site", name: "Alice" }];
const query = {
  select: jest.fn(), eq: jest.fn(), or: jest.fn(), order: jest.fn(), limit: jest.fn(),
};
const from = jest.fn(() => query);

beforeEach(() => {
  jest.clearAllMocks();
  for (const method of [query.select, query.eq, query.or, query.order]) method.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: leads, error: null });
  jest.mocked(requirePosSiteAccess).mockResolvedValue({ supabase: { from }, user: { id: "user" }, role: "owner" } as never);
});

it("searches all customer fields through the authorized user client with a bounded tenant scope", async () => {
  expect(await searchPosCustomers("site", " Alice ")).toEqual({ leads });
  expect(requirePosSiteAccess).toHaveBeenCalledWith("site");
  expect(from).toHaveBeenCalledWith("leads");
  expect(query.eq).toHaveBeenCalledWith("site_id", "site");
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('personal_email.ilike."%Alice%"'));
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('company->>name.ilike."%Alice%"'));
  expect(query.limit).toHaveBeenCalledWith(30);
  expect(query.select.mock.calls[0][0]).not.toMatch(/user_id|notes|address/);
});

it.each(["Not authenticated", "Forbidden", "This operation requires unrestricted location access"])(
  "does not read leads when access is denied: %s", async (error) => {
    jest.mocked(requirePosSiteAccess).mockResolvedValue({ error });
    expect(await searchPosCustomers("foreign-site", "Alice")).toEqual({ leads: [], error });
    expect(from).not.toHaveBeenCalled();
  },
);

it.each([["", "Alice"], ["site", " "], ["site", "x".repeat(201)]])(
  "rejects invalid input before authentication", async (site, term) => {
    expect(await searchPosCustomers(site, term)).toHaveProperty("error");
    expect(requirePosSiteAccess).not.toHaveBeenCalled();
  },
);

it("quotes commas, quotes and backslashes and escapes wildcard characters", async () => {
  const term = 'Acme, "West"\\100%_';
  await searchPosCustomers("site", term);
  const pattern = JSON.stringify(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining(`name.ilike.${pattern}`));
});

it("does not expose provider details or disguise a failed search as an empty success", async () => {
  query.limit.mockResolvedValue({ data: null, error: { message: "private database detail" } });
  const result = await searchPosCustomers("site", "Alice");
  expect(result.error).toMatch(/unavailable/);
  expect(JSON.stringify(result)).not.toContain("private database detail");
});