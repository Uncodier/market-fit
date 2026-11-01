import { readEnvironment, required, requiredUuid } from './environment';
import { projectLifecyclePolicy } from './project-lifecycle-policy';
import { accountLifecyclePolicy } from './account-lifecycle-policy';
import { qaModulePolicy } from './qa-module-policy';

export default async function preflight(): Promise<void> {
  const env = readEnvironment();
  if (env.suite === 'account-lifecycle') { accountLifecyclePolicy(); return; }
  if (env.suite === 'project-lifecycle') projectLifecyclePolicy();
  if (env.suite === 'procurement' || env.suite === 'subsystems') qaModulePolicy();
  const roles = env.suite === 'buyer' ? ['BUYER']
    : env.suite === 'roles' ? ['ADMIN', 'COLLABORATOR', 'MARKETING', 'FOREIGN']
    : env.suite === 'procurement' ? ['ADMIN', 'BUYER', 'COLLABORATOR', 'FOREIGN'] : ['ADMIN'];
  for (const role of roles) {
    required(process.env, `TEST_${role}_EMAIL`);
    required(process.env, `TEST_${role}_PASSWORD`);
  }
  if (env.suite === 'procurement' || env.suite === 'subsystems') {
    requiredUuid(process.env, 'TEST_CATALOG_ITEM_ID');
    required(process.env, 'TEST_CATALOG_ITEM_NAME');
    if (env.suite === 'subsystems') required(process.env, 'TEST_LEAD_NAME');
    if (env.suite === 'procurement') {
      const emails = roles.map(role => required(process.env, `TEST_${role}_EMAIL`).toLowerCase());
      if (new Set(emails).size !== emails.length) throw new Error('Procurement role identities must be distinct');
      if (requiredUuid(process.env, 'TEST_FOREIGN_SITE_ID') === env.siteId) throw new Error('Tenant fixtures must be distinct');
    }
  }
  if (env.suite === 'smoke' || env.suite === 'regression' || env.suite === 'buyer') {
    required(process.env, 'TEST_SHOP_SLUG');
    requiredUuid(process.env, 'TEST_CATALOG_ITEM_ID');
    required(process.env, 'TEST_CATALOG_ITEM_NAME');
  }
  if (env.suite === 'smoke') {
    required(process.env, 'TEST_CONTENT_NAME');
    required(process.env, 'TEST_LEAD_NAME');
  }
  if (env.suite === 'roles') {
    required(process.env, 'TEST_SUPABASE_URL');
    required(process.env, 'TEST_SUPABASE_ANON_KEY');
    requiredUuid(process.env, 'TEST_FOREIGN_SITE_ID');
    if (process.env.TEST_FOREIGN_SITE_ID === env.siteId) throw new Error('Tenant fixtures must be distinct');
  }
}