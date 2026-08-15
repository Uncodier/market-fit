import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log(`Connecting to Supabase at ${supabaseUrl}...`);
  
  // 1. Get Clemente's site ID
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('id, name')
    .ilike('name', '%Clemente%');
    
  if (sitesError) {
    console.error("Error fetching sites:", sitesError);
    return;
  }
  
  if (sites && sites.length > 0) {
    console.log(`\n--- Clemente Items ---`);
    console.log(`Found ${sites.length} Clemente site(s):`, sites.map(s => s.name).join(', '));
    const siteIds = sites.map(s => s.id);
    
    const { data: clementeItems, error: itemsError } = await supabase
      .from('catalog_items')
      .select('id, name, variant_axes')
      .in('site_id', siteIds);
      
    if (itemsError) {
      console.error("Error fetching Clemente items:", itemsError);
    } else {
      console.log(`Found ${clementeItems.length} Clemente items.`);
      clementeItems.forEach(item => {
        if (item.variant_axes) {
          console.log(`- Item: ${item.name}`);
          console.log(`  variant_axes:`, JSON.stringify(item.variant_axes, null, 2));
        }
      });
    }
  } else {
    console.log("\n--- Clemente Items ---");
    console.log("No Clemente sites found.");
  }

  console.log("\n--- Items with empty labels ---");
  
  // 2. Check for empty labels across all items
  const { data: allItems, error: allItemsError } = await supabase
    .from('catalog_items')
    .select('id, name, variant_axes, site:site_id(name)')
    .not('variant_axes', 'is', null);
    
  if (allItemsError) {
    console.error("Error fetching all items:", allItemsError);
    return;
  }
  
  const emptyLabel = allItems.filter(d => 
    Array.isArray(d.variant_axes) && 
    d.variant_axes.some(axis => !axis.label || axis.label.trim() === '')
  );
  
  console.log(`Found ${emptyLabel.length} items total with an empty label in variant_axes.`);
  emptyLabel.forEach(item => {
    console.log(`- Item: ${item.name} (${item.site?.name || 'Unknown Site'})`);
    console.log(`  variant_axes:`, JSON.stringify(item.variant_axes, null, 2));
  });
}

run();
