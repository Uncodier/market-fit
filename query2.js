const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: all } = await supabase
    .from('pass_redeemable_items')
    .select('*');
  console.log("All redeemables:", all);
}
run();
