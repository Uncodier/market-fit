import { qaModulePolicy } from './qa-module-policy';
import { required, requireUuid } from './mutation-safety';

export function procurementPolicy(env: Record<string, string | undefined> = process.env, now = Date.now()) {
  const policy = qaModulePolicy(env, now);
  if (policy.suite !== 'procurement') throw new Error('Procurement requires its isolated suite');
  const roles = ['ADMIN', 'BUYER', 'COLLABORATOR', 'FOREIGN'] as const;
  const emails = roles.map(role => required(env, `TEST_${role}_EMAIL`).toLowerCase());
  roles.forEach(role => required(env, `TEST_${role}_PASSWORD`));
  if (new Set(emails).size !== roles.length || emails.some(email => !email.endsWith(`@${policy.qaId}.invalid`))) {
    throw new Error('Procurement requires distinct installer-owned QA identities');
  }
  const foreignSiteId = requireUuid(required(env, 'TEST_FOREIGN_SITE_ID'), 'Foreign site');
  const catalogItemId = requireUuid(required(env, 'TEST_CATALOG_ITEM_ID'), 'Catalog item');
  if (foreignSiteId === policy.siteId) throw new Error('Foreign site must differ from buyer workspace');
  return { ...policy, foreignSiteId, catalogItemId };
}

export function assertProcurementQaOwnership(value: unknown, role?: string, env: Record<string, string | undefined> = process.env) {
  const policy = procurementPolicy(env);
  if (!value || typeof value !== 'object') throw new Error('Missing verified QA ownership');
  const metadata = value as Record<string, unknown>;
  if (metadata.qa_fixture !== 'market-fit-qa-v1' || metadata.qa_environment_id !== policy.qaId ||
    metadata.qa_expires_at !== policy.expiresAt || (role && metadata.qa_role !== role)) {
    throw new Error('QA ownership or expiry differs from the exact installer scope');
  }
}

export function procurementMarker(scenario: string, env: Record<string, string | undefined> = process.env) {
  const { runId } = procurementPolicy(env);
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(scenario)) throw new Error('Invalid procurement scenario namespace');
  const marker = `QA procurement ${runId} ${scenario}`;
  if (marker.length > 100) throw new Error('Procurement run/scenario marker exceeds quotation reference safety limit');
  return marker;
}