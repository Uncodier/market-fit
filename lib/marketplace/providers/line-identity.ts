import { createHash } from 'node:crypto';

/** Provider instance IDs win; position paths distinguish repeated/customized menu products. */
export function lineIdentity(productId: string, path: string, instanceId?: string): string {
  return `line_${createHash('sha256').update(JSON.stringify([productId, instanceId ?? path])).digest('hex')}`;
}