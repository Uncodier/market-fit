export const POS_ACCESS_RECHECK_EVENT = "pos-access-recheck";
export const POS_ACCESS_UPDATED_EVENT = "pos-access-updated";

/** Requests verification from the POS access owner; this event grants no access. */
export function requestPosAccessRecheck(): void {
  if (typeof window === "undefined" || !navigator.onLine) return;
  window.dispatchEvent(new CustomEvent(POS_ACCESS_RECHECK_EVENT));
}

/** Publish accepted/restored access without invoking destructive scope invalidation.
 * Consumers must reread the current lease; the event itself grants no authority.
 */
export function notifyPosAccessUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POS_ACCESS_UPDATED_EVENT));
}