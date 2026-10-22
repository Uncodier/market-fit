import { fetchPosCheckoutStatus } from "@/app/pos/checkout-status-client";

const fetchMock = jest.mocked(fetch);
const input = { siteId: "site", clientMutationId: "mutation", payments: [{ paymentId: "original", amount: 10 }] };

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: jest.fn(async () => body) } as unknown as Response;
}

beforeEach(() => { jest.useFakeTimers(); fetchMock.mockReset(); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it("uses the fixed same-origin no-store POST read transport, preserving evidence IDs", async () => {
  const data = { state: "payment_recorded", message: "Review checkout." };
  fetchMock.mockResolvedValue(response({ data }));
  await expect(fetchPosCheckoutStatus(input)).resolves.toEqual({ data });
  expect(fetchMock).toHaveBeenCalledWith("/api/pos/checkout-status", {
    method: "POST", credentials: "same-origin", cache: "no-store", redirect: "error",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: expect.any(AbortSignal),
  });
  expect(jest.getTimerCount()).toBe(0);
});

it("bounds a hung request even when fetch ignores AbortController, with no fallback", async () => {
  fetchMock.mockReturnValue(new Promise(() => {}));
  const pending = fetchPosCheckoutStatus(input);
  const signal = fetchMock.mock.calls[0][1]!.signal!;
  await jest.advanceTimersByTimeAsync(8_000);
  await expect(pending).resolves.toEqual({ error: expect.stringContaining("timed out") });
  expect(signal.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it("bounds a hung response body as part of the same read deadline", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) } as unknown as Response);
  const pending = fetchPosCheckoutStatus(input);
  await jest.advanceTimersByTimeAsync(8_000);
  await expect(pending).resolves.toHaveProperty("error");
  expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
});

it("does not convert a late aborted read into payment confirmation", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const pending = fetchPosCheckoutStatus(input);
  await jest.advanceTimersByTimeAsync(8_000);
  const failed = await pending;
  finish(response({ data: { state: "completed", message: "Confirmed", result: { success: true, orderId: "order", saleId: "sale" } } }));
  await Promise.resolve();
  await expect(pending).resolves.toBe(failed);
  expect(failed).toHaveProperty("error");
});

it("allows another independent read while the first hangs", async () => {
  fetchMock.mockReturnValueOnce(new Promise(() => {}));
  const first = fetchPosCheckoutStatus(input);
  fetchMock.mockResolvedValueOnce(response({ data: { state: "processing", message: "Still pending" } }));
  await expect(fetchPosCheckoutStatus({ ...input, clientMutationId: "other" })).resolves.toHaveProperty("data.state", "processing");
  await jest.advanceTimersByTimeAsync(8_000);
  await first;
});

it.each([400, 401, 403, 500])("fails closed for HTTP %i and hides raw response details", async (status) => {
  fetchMock.mockResolvedValue(response({ error: "private server detail" }, status));
  const result = await fetchPosCheckoutStatus(input);
  expect(result).toHaveProperty("error");
  expect(JSON.stringify(result)).not.toContain("private server detail");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it.each([{}, { data: { state: "completed", message: "Missing result" } }, { data: { state: "invented", message: "Invalid" } }])(
  "does not treat malformed response data as confirmation (%#)", async (body) => {
    fetchMock.mockResolvedValue(response(body));
    await expect(fetchPosCheckoutStatus(input)).resolves.toHaveProperty("error");
  },
);

it("fails closed on a network error without retrying through a Server Action", async () => {
  fetchMock.mockRejectedValue(new Error("private network details"));
  await expect(fetchPosCheckoutStatus(input)).resolves.toHaveProperty("error");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});