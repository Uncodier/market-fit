/** @jest-environment node */
import {
  checkoutPosCart, createPosLead, fetchPosOrder, fetchActivePaymentRegister,
  fetchRegisterDashboard, fetchRegisterSummary, openPosRegister, closePosRegister, movePosRegisterCash,
} from "@/app/pos/operation-client";
import { siteId, orderId, locationId, sessionId, requestId, foreignId,
  checkoutInput, checkoutResult, order, register, summary } from "./operation-fixtures";

// A runtime action import would throw, not silently turn into a direct action call.
jest.mock("@/app/commerce/checkout", () => { throw new Error("Client imported checkout action"); });
jest.mock("@/app/pos/actions/create-lead-sync", () => { throw new Error("Client imported lead action"); });
jest.mock("@/app/pos/actions/get-order", () => { throw new Error("Client imported order action"); });
jest.mock("@/app/pos/register/actions", () => { throw new Error("Client imported register actions"); });

const fetchMock = jest.mocked(fetch);
const response = (body: unknown, status = 200) => Response.json(body, { status });
const leadInput = { siteId, name: "Customer", clientMutationId: requestId };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { jest.resetAllMocks(); });
afterEach(() => { jest.useRealTimers(); });

it("uses only fixed same-origin no-store HTTP with original checkout identities", async () => {
  fetchMock.mockResolvedValue(response(checkoutResult));
  const input = { ...checkoutInput, originLocationId: locationId, registerSessionId: sessionId,
    payments: [{ paymentId: requestId, method: "cash", amount: 10, tendered: 10, change: 0 }] };
  expect(await checkoutPosCart(input)).toEqual(checkoutResult);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/pos/operation", expect.objectContaining({
    method: "POST", credentials: "same-origin", mode: "same-origin", redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ operation: "checkout", input }),
  }));
  expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("signal");
});

it("returns the existing lead, order and active-register contracts", async () => {
  fetchMock.mockResolvedValueOnce(response({ lead: { id: orderId }, idempotent: true }));
  expect(await createPosLead(leadInput)).toEqual({ lead: { id: orderId }, idempotent: true });
  fetchMock.mockResolvedValueOnce(response({ data: order }));
  expect(await fetchPosOrder(siteId, orderId)).toEqual({ data: order });
  fetchMock.mockResolvedValueOnce(response({ data: register }));
  expect(await fetchActivePaymentRegister({ siteId, locationId })).toEqual({ data: register });
});

it.each(["register_required", "register_location_required"])("preserves %s even on non-2xx", async (code) => {
  const error = { error: "Open or select a register.", code };
  fetchMock.mockResolvedValue(response(error, 409));
  expect(await fetchActivePaymentRegister({ siteId })).toEqual(error);
});

it("preserves checkout recovery errors without marking success", async () => {
  const error = { error: "Payment recorded", recovery: { state: "payment_recorded", message: "Payment recorded", orderId } };
  fetchMock.mockResolvedValue(response(error, 409));
  expect(await checkoutPosCart(checkoutInput)).toEqual(error);
});

it.each([401, 403, 409, 500, 503])("returns HTTP %s error without retrying", async (status) => {
  fetchMock.mockResolvedValue(response({ error: "POS operation unavailable" }, status));
  expect(await checkoutPosCart(checkoutInput)).toEqual({ error: "POS operation unavailable" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([null, [], {}, { success: true }, { success: true, orderId },
  { ...checkoutResult, error: "ambiguous" }, { ...checkoutResult, saleId: "not-an-id" },
  { ...checkoutResult, kitchenDelta: {} }])("never confirms malformed checkout success (%#)", async (body) => {
  fetchMock.mockResolvedValue(response(body));
  expect(await checkoutPosCart(checkoutInput)).toEqual({ error: expect.any(String) });
});

it("never treats a valid-looking success body on HTTP failure as success", async () => {
  fetchMock.mockResolvedValue(response(checkoutResult, 500));
  expect(await checkoutPosCart(checkoutInput)).toEqual({ error: expect.any(String) });
});

it("rejects malformed lead/order/register responses and cross-tenant records", async () => {
  fetchMock.mockResolvedValueOnce(response({ lead: {} }));
  expect(await createPosLead(leadInput)).toEqual({ error: expect.any(String) });
  fetchMock.mockResolvedValueOnce(response({ data: { ...order, site_id: foreignId } }));
  expect(await fetchPosOrder(siteId, orderId)).toEqual({ error: expect.any(String) });
  fetchMock.mockResolvedValueOnce(response({ data: { ...order, id: foreignId } }));
  expect(await fetchPosOrder(siteId, orderId)).toEqual({ error: expect.any(String) });
  fetchMock.mockResolvedValueOnce(response({ data: { ...register, location_id: foreignId } }));
  expect(await fetchActivePaymentRegister({ siteId, locationId })).toEqual({ error: expect.any(String) });
  fetchMock.mockResolvedValueOnce(response({ data: { ...register, status: "closed" } }));
  expect(await fetchActivePaymentRegister({ siteId })).toEqual({ error: expect.any(String) });
});

it("handles network errors, invalid JSON and HTML without exposing raw failures", async () => {
  fetchMock.mockRejectedValueOnce(new Error("private proxy details"));
  expect(await checkoutPosCart(checkoutInput)).toEqual({ error: expect.not.stringContaining("private") });
  fetchMock.mockResolvedValueOnce(new Response("{", { headers: { "Content-Type": "application/json" } }));
  expect(await createPosLead(leadInput)).toEqual({ error: expect.any(String) });
  fetchMock.mockResolvedValueOnce(new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } }));
  expect(await fetchPosOrder(siteId, orderId)).toEqual({ error: expect.any(String) });
});

const reads = [
  () => fetchPosOrder(siteId, orderId),
  () => fetchActivePaymentRegister({ siteId }),
  () => fetchRegisterDashboard({ siteId, locationId }),
  () => fetchRegisterSummary({ siteId, sessionId }),
];
it.each(reads)("bounds a stalled read fetch even when AbortSignal is ignored (%#)", async (read) => {
  jest.useFakeTimers();
  fetchMock.mockReturnValue(new Promise(() => {}));
  const pending = read();
  await jest.advanceTimersByTimeAsync(8_000);
  expect(await pending).toEqual({ error: expect.stringContaining("timed out") });
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it.each(reads)("bounds stalled response.json as part of the same read deadline (%#)", async (read) => {
  jest.useFakeTimers();
  const json = jest.fn(() => new Promise(() => {}));
  fetchMock.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "application/json" }), json } as unknown as Response);
  const pending = read();
  await jest.advanceTimersByTimeAsync(8_000);
  expect(json).toHaveBeenCalledTimes(1);
  expect(await pending).toEqual({ error: expect.stringContaining("timed out") });
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it("clears the timer on fast read response", async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValue(response({ data: summary }));
  expect(await fetchRegisterSummary({ siteId, sessionId })).toEqual({ data: summary });
  expect(jest.getTimerCount()).toBe(0);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
});

const mutations = [
  { call: () => checkoutPosCart(checkoutInput), result: checkoutResult },
  { call: () => createPosLead(leadInput), result: { lead: { id: orderId } } },
  { call: () => openPosRegister({ siteId, locationId, currency: "USD", openingAmount: 0, requestId }), result: { data: register } },
  { call: () => closePosRegister({ siteId, sessionId, countedAmount: 0, notes: "", requestId }), result: { data: { ...register, status: "closed" } } },
  { call: () => movePosRegisterCash({ siteId, sessionId, kind: "cash_in", amount: 1, reason: "Float", requestId }), result: {
    data: { id: requestId, site_id: siteId, session_id: sessionId, kind: "cash_in", amount: 1,
      reason: "Float", actor_id: register.opened_by, request_id: requestId, created_at: register.opened_at },
  } },
];

it.each(mutations)("keeps actual mutation HTTP flight pending beyond the caller's 45s deadline (%#)", async ({ call, result }) => {
  jest.useFakeTimers();
  const http = deferred<Response>();
  fetchMock.mockReturnValue(http.promise);
  let settled = false;
  const pending = call().then((value) => { settled = true; return value; });
  await jest.advanceTimersByTimeAsync(60_000);
  expect(settled).toBe(false);
  expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("signal");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  http.resolve(response(result));
  expect(await pending).toEqual(result);
});

it("retains a mutation while response JSON is late and allows independent reads", async () => {
  jest.useFakeTimers();
  const json = deferred<unknown>();
  fetchMock.mockResolvedValueOnce({ ok: true, headers: new Headers({ "Content-Type": "application/json" }), json: () => json.promise } as Response);
  const pending = checkoutPosCart(checkoutInput);
  await jest.advanceTimersByTimeAsync(60_000);
  fetchMock.mockResolvedValueOnce(response({ data: order }));
  expect(await fetchPosOrder(siteId, orderId)).toEqual({ data: order });
  json.resolve(checkoutResult);
  expect(await pending).toEqual(checkoutResult);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});