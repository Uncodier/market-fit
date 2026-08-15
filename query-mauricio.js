const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Searching for "MAURICIO" in catalog_items...');
  
  const { data: items, error } = await supabase
    .from('catalog_items')
    .select('*')
    .ilike('name', '%MAURICIO%');

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  if (!items || items.length === 0) {
    console.log('No items found with name similar to "MAURICIO".');
    return;
  }

  console.log(`Found ${items.length} item(s).\n`);

  for (const item of items) {
    console.log('=== PARENT ITEM ===');
    console.log(`ID: ${item.id}`);
    console.log(`Name: ${item.name}`);
    console.log(`Parent ID: ${item.parent_id}`);
    console.log(`Type: ${item.type}`);
    console.log(`Metadata: ${JSON.stringify(item.metadata, null, 2)}`);
    console.log('-------------------');

    // Fetch children
    const { data: children, error: childrenError } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('parent_id', item.id);

    if (childrenError) {
      console.error(`Error fetching children for item ${item.id}:`, childrenError);
      continue;
    }

    if (children && children.length > 0) {
      console.log(`  Found ${children.length} children for ${item.name}:`);
      for (const child of children) {
        console.log(`  --- CHILD ITEM ---`);
        console.log(`  ID: ${child.id}`);
        console.log(`  Name: ${child.name}`);
        console.log(`  Type: ${child.type}`);
        console.log(`  Metadata: ${JSON.stringify(child.metadata, null, 2)}`);
        console.log(`  ------------------`);
      }
    } else {
      console.log('  No children found.');
    }
    console.log('\n');
  }
}

run();
