const fs = require('fs');
const path = require('path');

// Fix lib/supabase/server-client.ts
const serverClientPath = 'lib/supabase/server-client.ts';
let serverClientContent = fs.readFileSync(serverClientPath, 'utf8');
if (!serverClientContent.includes('createDemoMockClient')) {
  serverClientContent = `import { createDemoMockClient } from "@/lib/demo-data/mock-client"\n` + serverClientContent;
  
  serverClientContent = serverClientContent.replace(
    'export function createApiClient() {',
    'export function createApiClient(siteId?: string | null) {\n  if (siteId && siteId.startsWith("demo-")) return createDemoMockClient(siteId) as any;\n'
  );
  
  serverClientContent = serverClientContent.replace(
    'export function createServiceApiClient() {',
    'export function createServiceApiClient(siteId?: string | null) {\n  if (siteId && siteId.startsWith("demo-")) return createDemoMockClient(siteId) as any;\n'
  );
  
  fs.writeFileSync(serverClientPath, serverClientContent);
  console.log('Fixed lib/supabase/server-client.ts');
}

// Fix utils/supabase/server.ts
const utilsServerPath = 'utils/supabase/server.ts';
let utilsServerContent = fs.readFileSync(utilsServerPath, 'utf8');
if (!utilsServerContent.includes('createDemoMockClient')) {
  utilsServerContent = `import { createDemoMockClient } from "@/lib/demo-data/mock-client"\n` + utilsServerContent;
  
  utilsServerContent = utilsServerContent.replace(
    '  const cookieStore = await cookies()',
    '  const cookieStore = await cookies()\n  const demoSiteId = cookieStore.get("market_fit_demo_site_id")?.value;\n  if (demoSiteId) return createDemoMockClient(demoSiteId) as any;'
  );
  
  fs.writeFileSync(utilsServerPath, utilsServerContent);
  console.log('Fixed utils/supabase/server.ts');
}

// Find all usages of createApiClient() and createServiceApiClient() in app/api
const { execSync } = require('child_process');
const grepResult = execSync('grep -rn "createApiClient()" app/api || true').toString();
const grepResult2 = execSync('grep -rn "createServiceApiClient()" app/api || true').toString();

const files = new Set([
  ...grepResult.split('\n').filter(Boolean).map(line => line.split(':')[0]),
  ...grepResult2.split('\n').filter(Boolean).map(line => line.split(':')[0])
]);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/createApiClient\(\)/g, 'createApiClient(siteId)');
  content = content.replace(/createServiceApiClient\(\)/g, 'createServiceApiClient(siteId)');
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
