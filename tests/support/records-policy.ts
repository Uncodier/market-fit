import { qaModulePolicy } from './qa-module-policy';
import { required, requireUuid } from './mutation-safety';

/** Pure preflight: invoke before auth; discovery must not invoke this function. */
export function recordsPolicy(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  if (env.TEST_SUITE !== 'records') throw new Error('Records requires its isolated suite');
  const policy = qaModulePolicy(env, now);
  if (env.TEST_RECORDS_RELATION_GUARD_READY !== '1' || env.TEST_RECORDS_LOCAL_EFFECTS_ACK !== '1') {
    throw new Error('Records requires the locally installed relation guard and contained background effects');
  }
  if (env.TEST_RECORDS_TRASH_READY !== '1') throw new Error('Records requires the locally installed recoverable Trash migrations');
  for (const key of ['TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD', 'TEST_FOREIGN_EMAIL',
    'TEST_FOREIGN_PASSWORD', 'TEST_FOREIGN_SITE_NAME', 'TEST_LEAD_NAME',
    'TEST_RECORDS_SUPPLIER_NAME', 'TEST_RECORDS_ORDER_NUMBER']) required(env, key);
  const foreignSiteId = requireUuid(required(env, 'TEST_FOREIGN_SITE_ID'), 'Foreign site');
  if (foreignSiteId === policy.siteId || env.TEST_ADMIN_EMAIL?.toLowerCase() === env.TEST_FOREIGN_EMAIL?.toLowerCase()) {
    throw new Error('Records requires distinct QA tenants and actors');
  }
  for (const role of ['ADMIN', 'FOREIGN']) {
    if (!required(env, `TEST_${role}_EMAIL`).toLowerCase().endsWith(`@${policy.qaId.toLowerCase()}.invalid`)) {
      throw new Error('Records requires installer-owned QA identities');
    }
  }
  for (const key of ['TEST_RECORDS_SUPPLIER_NAME', 'TEST_RECORDS_ORDER_NUMBER']) {
    if (!required(env, key).startsWith(`${policy.qaId} `)) throw new Error(`${key} must be QA namespaced`);
  }
  const publicUrl = required(env, 'NEXT_PUBLIC_SUPABASE_URL');
  if (new URL(publicUrl).origin !== policy.backend || required(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') !== policy.key) {
    throw new Error('Records browser and verification backend must match');
  }
  return { ...policy, foreignSiteId,
    supplierId: requireUuid(required(env, 'TEST_RECORDS_SUPPLIER_ID'), 'Supplier fixture'),
    orderId: requireUuid(required(env, 'TEST_RECORDS_ORDER_ID'), 'Sales order fixture') };
}