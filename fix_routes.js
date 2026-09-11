const fs = require('fs');
const files = [
  'app/api/integrations/cloudflare/oauth/callback/route.ts',
  'app/api/integrations/cloudflare/sync/agentmail/route.ts',
  'app/api/integrations/cloudflare/sync/preview/route.ts',
  'app/api/integrations/cloudflare/sync/zavu/route.ts',
  'app/api/integrations/vercel/domain/route.ts',
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import\s+{\s*getAuthInfo\s*}\s*from\s*'@\/app\/context\/auth-context-server'/, "import { createClient } from '@/lib/supabase/server'");
  content = content.replace(/const\s+auth\s*=\s*await\s+getAuthInfo\(\)/g, "const supabase = await createClient();\n  const { data: { user: auth } } = await supabase.auth.getUser();");
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
}
