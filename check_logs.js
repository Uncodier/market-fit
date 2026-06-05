const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const fetch = require('node-fetch');

let supabaseUrl, supabaseKey;
for (const line of env.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1];
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1];
}

async function main() {
  const url = `${supabaseUrl}/rest/v1/instance_logs?log_type=eq.user_action&order=created_at.desc&limit=10&select=message,details,created_at,instance_id`;
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log("Recent user_actions:");
  data.forEach(d => console.log(JSON.stringify(d, null, 2)));
}

main();
