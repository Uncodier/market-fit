const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Querying catalog_items table...");
  // Let's fetch everything and filter to avoid guessing the exact column for "Clemente"
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*');

  if (error) {
    console.error('Error fetching catalog items:', error);
    return;
  }
  
  const clementeItems = data.filter(item => {
     const str = JSON.stringify(item).toLowerCase();
     return str.includes('clemente');
  });

  console.log(`Found ${clementeItems.length} items related to "clemente".`);

  const dumpData = clementeItems.map(item => ({
    id: item.id,
    name: item.name || item.title || item.slug,
    metadata: item.metadata,
    children: item.children
  }));

  fs.writeFileSync('clemente_dump.json', JSON.stringify(dumpData, null, 2));
  console.log('Dumped metadata and children to clemente_dump.json');

  clementeItems.forEach(item => {
    if (item.metadata && item.metadata.variant_axes) {
      console.log(`\nVariant Axes for item ${item.id}:`);
      console.log(JSON.stringify(item.metadata.variant_axes, null, 2));
    } else {
      console.log(`\nNo variant_axes found in metadata for item ${item.id}.`);
    }
  });
}
run();
