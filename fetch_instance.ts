import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const id = '0b750495-01f1-4051-99c0-ba8afda3c526';

  const { data: nodes } = await supabase
    .from('instance_nodes')
    .select('id, type, parent_node_id')
    .eq('instance_id', id);

  console.log("Nodes:", nodes);
  
  const { data: edges } = await supabase
    .from('instance_edges')
    .select('*')
    .eq('instance_id', id);
    
  console.log("Edges:", edges);
}

main();
