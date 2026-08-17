const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('id, name, parent_id, metadata, redeem_assignment_mode, kind, digital_subtype')
    .ilike('name', '%Barba%');
  console.log("Error:", error);
  console.log("Items:", JSON.stringify(data, null, 2));
}
run();
