import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function applyShopCatalogOrder<T extends { order: (...args: any[]) => T }>(query: T): T {
  return query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .order("id", { ascending: true });
}

async function test() {
  let query = supabase
    .from("catalog_items")
    .select("id, name, sort_order, category_id, category:catalog_categories(name, sort_order)")
    .is("parent_id", null)
    .limit(10);

  query = applyShopCatalogOrder(query);

  const { data, error } = await query;
  console.log("Error:", error?.message);
  if (data) {
    console.log(data.map(d => ({ name: d.name, sort: d.sort_order, cat_name: d.category?.name })));
  }
}
test()
