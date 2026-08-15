import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function test() {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, name, sort_order, category_id, category:catalog_categories!left(name, sort_order)")
    .is("parent_id", null)
    .order("category(sort_order)" as any, { ascending: true, nullsFirst: false })
    .limit(2)

  console.log("Error:", error?.message)
  console.log("Data:", data ? "Success" : "Failed")
}
test()
