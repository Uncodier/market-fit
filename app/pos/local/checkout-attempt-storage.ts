import { v4 as uuidv4 } from "uuid";
import sha256 from "crypto-js/sha256";

const SESSION_PREFIX = "pos-checkout-session:";
const ATTEMPT_PREFIX = "pos-checkout-attempt:";
const siteKey = (siteId: string) => encodeURIComponent(siteId);

/** Cache identity, never authorization. Storage failures must stop collection. */
export function getCheckoutCartSession(siteId: string): string {
  const key = SESSION_PREFIX + siteKey(siteId);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const session = uuidv4();
  localStorage.setItem(key, session);
  return session;
}

export function resetCheckoutCartSession(siteId: string) {
  // A deliberate New Order is not a legacy retry, even if its basket is identical.
  // Preserve old aliases: another tab or an unresolved checkout may still need them.
  localStorage.setItem(SESSION_PREFIX + siteKey(siteId), `new:${uuidv4()}`);
}

export function checkoutAttemptKey(siteId: string, userId: string, session: string, payload: unknown) {
  // Do not put cart/customer/payment details in localStorage, even in key names.
  return `${ATTEMPT_PREFIX}${siteKey(siteId)}:${encodeURIComponent(userId)}:${session}:${sha256(JSON.stringify(payload)).toString()}`;
}
