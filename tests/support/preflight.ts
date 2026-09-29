import { readEnvironment, required, requiredUuid } from './environment';

export default async function preflight(): Promise<void> {
  const env = readEnvironment();
  const roles = env.suite === 'buyer' ? ['BUYER']
    : env.suite === 'roles' ? ['ADMIN', 'COLLABORATOR', 'MARKETING', 'FOREIGN'] : ['ADMIN'];
  for (const role of roles) {
    required(process.env, `TEST_${role}_EMAIL`);
    required(process.env, `TEST_${role}_PASSWORD`);
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