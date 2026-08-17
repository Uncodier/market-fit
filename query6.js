const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: members } = await supabase
    .from('pass_redeemable_items')
    .select('reservable_catalog_item_id')
    .eq('pass_catalog_item_id', 'b30bbe4d-1c44-4ccb-afc4-441d0a742806');
    
  if (members && members.length) {
      const ids = members.map(m => m.reservable_catalog_item_id);
      const { data: items } = await supabase
        .from('catalog_items')
        .select('id, name, parent_id')
        .in('id', ids);
      console.log("Member Items:", JSON.stringify(items, null, 2));
  }
}
run();
