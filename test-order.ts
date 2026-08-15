import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function test() {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, name, sort_order, category_id, category:catalog_categories(name, sort_order)")
    .is("parent_id", null)
    .order("catalog_categories(sort_order)" as any, { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(5)

  console.log("With catalog_categories(sort_order) Error:", error?.message)
  if (data) {
    console.log(data.map(d => ({ name: d.name, cat: d.category?.name, sort: d.category?.sort_order })))
  }

  const { data: data2, error: error2 } = await supabase
    .from("catalog_items")
    .select("id, name, sort_order, category_id, category:catalog_categories(name, sort_order)")
    .is("parent_id", null)
    .order("category(sort_order)" as any, { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .limit(5)

  console.log("With category(sort_order) Error:", error2?.message)
  if (data2) {
    console.log(data2.map(d => ({ name: d.name, cat: d.category?.name, sort: d.category?.sort_order })))
  }
}
test()
