"use client";

import type { checkoutCart } from "@/app/commerce/checkout";
import type { createLeadWithIdempotency } from "./actions/create-lead-sync";
import type { getPosOrder } from "./actions/get-order";
import type {
  getActiveRegisterForPayment, getRegisterDashboard, getRegisterSummary,
  openRegister, closeRegister, moveRegisterCash,
} from "./register/actions";
import { parsePosOperationSuccess, posOperationErrorSchema } from "./operation-response";

const ENDPOINT = "/api/pos/operation";
const READ_WAIT_MS = 8_000;
const UNCONFIRMED = "Unable to confirm the POS operation. Keep the original attempt and check its status before retrying.";

async function send(operation: string, input: unknown, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: "POST", credentials: "same-origin", mode: "same-origin", cache: "no-store", redirect: "error",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ operation, input }), ...(signal ? { signal } : {}),
  });
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { error: UNCONFIRMED };
  }
  const body: unknown = await response.json();
  const error = posOperationErrorSchema.safeParse(body);
  if (error.success) return error.data;
  if (!response.ok) return { error: UNCONFIRMED };
  return parsePosOperationSuccess(operation, body, input) || { error: UNCONFIRMED };
}

async function request(operation: string, input: unknown, readOnly: boolean): Promise<unknown> {
  // The outbox owns mutation deadlines and keeps the real HTTP flight alive.
  // Do not abort, race, replay, or manufacture a new idempotency key here.
  if (!readOnly) {
    try { return await send(operation, input); }
    catch { return { error: UNCONFIRMED }; }
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      send(operation, input, controller.signal),
      new Promise<{ error: string }>((resolve) => {
        timer = setTimeout(() => {
          resolve({ error: "POS request timed out. Please try again." });
          controller.abort();
        }, READ_WAIT_MS);
      }),
    ]);
  } catch { return { error: "Unable to load POS data. Please try again." }; }
  finally { clearTimeout(timer); }
}

export async function checkoutPosCart(
  ...args: Parameters<typeof checkoutCart>
): Promise<Awaited<ReturnType<typeof checkoutCart>>> {
  return await request("checkout", args[0], false) as Awaited<ReturnType<typeof checkoutCart>>;
}

export async function createPosLead(
  ...args: Parameters<typeof createLeadWithIdempotency>
): Promise<Awaited<ReturnType<typeof createLeadWithIdempotency>>> {
  return await request("create-lead", args[0], false) as Awaited<ReturnType<typeof createLeadWithIdempotency>>;
}

export async function fetchPosOrder(
  ...args: Parameters<typeof getPosOrder>
): Promise<Awaited<ReturnType<typeof getPosOrder>>> {
  return await request("order", { siteId: args[0], orderId: args[1] }, true) as Awaited<ReturnType<typeof getPosOrder>>;
}

export async function fetchActivePaymentRegister(input: unknown): Promise<Awaited<ReturnType<typeof getActiveRegisterForPayment>>> {
  return await request("register", input, true) as Awaited<ReturnType<typeof getActiveRegisterForPayment>>;
}

export async function fetchRegisterDashboard(input: unknown): Promise<Awaited<ReturnType<typeof getRegisterDashboard>>> {
  return await request("register-dashboard", input, true) as Awaited<ReturnType<typeof getRegisterDashboard>>;
}

export async function fetchRegisterSummary(input: unknown): Promise<Awaited<ReturnType<typeof getRegisterSummary>>> {
  return await request("register-summary", input, true) as Awaited<ReturnType<typeof getRegisterSummary>>;
}

export async function openPosRegister(input: unknown): Promise<Awaited<ReturnType<typeof openRegister>>> {
  return await request("register-open", input, false) as Awaited<ReturnType<typeof openRegister>>;
}

export async function closePosRegister(input: unknown): Promise<Awaited<ReturnType<typeof closeRegister>>> {
  return await request("register-close", input, false) as Awaited<ReturnType<typeof closeRegister>>;
}

export async function movePosRegisterCash(input: unknown): Promise<Awaited<ReturnType<typeof moveRegisterCash>>> {
  return await request("register-move", input, false) as Awaited<ReturnType<typeof moveRegisterCash>>;
}