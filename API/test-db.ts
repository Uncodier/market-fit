import { supabaseAdmin } from './src/lib/database/supabase-client';
async function run() {
  const { data, error } = await supabaseAdmin.from('outstand_posts').select('*').limit(1);
  console.log('outstand_posts:', data, error);
}
run();
