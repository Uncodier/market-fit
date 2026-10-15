import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

type RawBody = string | Uint8Array;
export const RAPPI_SIGNATURE_TOLERANCE_SECONDS = 300;

function matches(expected: Buffer, received: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  const bytes = Buffer.from(received, 'hex');
  return bytes.length === expected.length && timingSafeEqual(bytes, expected);
}

/** X-Uber-Signature: SHA256 HMAC of the exact request bytes with the app client secret. */
export function verifyUberSignature(rawBody: RawBody, signature: string | null, clientSecret: string): boolean {
  if (!clientSecret || !signature) return false;
  return matches(createHmac('sha256', clientSecret).update(rawBody).digest(), signature);
}

/** Rappi-Signature: t=<unix seconds>,sign=<hex>; signed message is timestamp + '.' + raw bytes. */
export function verifyRappiSignature(rawBody: RawBody, header: string | null, webhookSecret: string, nowMs = Date.now()): boolean {
  if (!header || header.length > 512 || !webhookSecret || !Number.isFinite(nowMs)) return false;
  const fields = header.split(',').map(value => value.trim().split('='));
  if (fields.length !== 2 || fields.some(field => field.length !== 2)) return false;
  const timestamps = fields.filter(([key]) => key === 't');
  const signatures = fields.filter(([key]) => key === 'sign');
  if (timestamps.length !== 1 || signatures.length !== 1) return false;
  const timestamp = timestamps[0][1];
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(nowMs / 1000 - seconds) > RAPPI_SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', webhookSecret).update(`${timestamp}.`).update(rawBody).digest();
  return matches(expected, signatures[0][1]);
}