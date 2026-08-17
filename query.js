const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: rrPasses } = await supabase
    .from('catalog_items')
    .select('id, name, parent_id, metadata, redeem_assignment_mode')
    .eq('redeem_assignment_mode', 'round_robin');
  console.log("Round Robin passes:", JSON.stringify(rrPasses, null, 2));
}
run();
