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
  localStorage.setItem(SESSION_PREFIX + siteKey(siteId), uuidv4());
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(ATTEMPT_PREFIX + siteKey(siteId) + ":")) localStorage.removeItem(key);
  }
}

export function checkoutAttemptKey(siteId: string, userId: string, session: string, payload: unknown) {
  // Do not put cart/customer/payment details in localStorage, even in key names.
  return `${ATTEMPT_PREFIX}${siteKey(siteId)}:${encodeURIComponent(userId)}:${session}:${sha256(JSON.stringify(payload)).toString()}`;
}
