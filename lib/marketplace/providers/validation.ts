import { MarketplaceProviderError } from './types';

export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
  return value as JsonObject;
}
export function optionalObject(value: unknown): JsonObject {
  return value === undefined || value === null ? {} : object(value);
}
export function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
export function id(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  const result = text(value);
  if (!result || !/^[a-zA-Z0-9_-]{1,200}$/.test(result)) invalid();
  return result;
}
export function requiredText(value: unknown): string {
  const result = text(value);
  if (!result || result.length > 1000) invalid();
  return result;
}
export function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) invalid();
  return value;
}
export function nonnegative(value: unknown): number {
  const result = number(value);
  if (result < 0) invalid();
  return result;
}
export function quantity(value: unknown): number {
  const result = nonnegative(value);
  if (result <= 0 || result > 10000) invalid();
  return result;
}
export function array(value: unknown, optional = false): unknown[] {
  if (optional && (value === undefined || value === null)) return [];
  if (!Array.isArray(value) || value.length > 2000) invalid();
  return value;
}
export function invalid(): never {
  throw new MarketplaceProviderError('invalid_payload', 'The marketplace payload does not match the supported contract.');
}
export function assertStore(actual: string, expected: string): void {
  if (actual !== expected) throw new MarketplaceProviderError('store_mismatch', 'The marketplace order belongs to a different store.');
}
export function coordinate(value: unknown, limit: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const result = number(value);
  if (Math.abs(result) > limit) invalid();
  return result;
}
export function eventTime(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 253402300800) {
    return new Date(value * 1000).toISOString();
  }
  const result = text(value);
  if (result && result.length <= 80) return result;
  return undefined;
}