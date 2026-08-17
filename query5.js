const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { count: countVariant, error } = await supabase
    .from('pass_redeemable_items')
    .select('*', { count: 'exact', head: true })
    .eq('pass_catalog_item_id', '56b11d0d-aee9-4016-8ab0-417b6a0aec27'); // one of the variants
  console.log("Count for variant:", countVariant, error);
  
  const { count: countParent, error: error2 } = await supabase
    .from('pass_redeemable_items')
    .select('*', { count: 'exact', head: true })
    .eq('pass_catalog_item_id', 'b30bbe4d-1c44-4ccb-afc4-441d0a742806'); // parent
  console.log("Count for parent:", countParent, error2);
}
run();
