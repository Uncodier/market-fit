const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, name, sort_order, category_id, category:catalog_categories(name, sort_order)")
    .is("parent_id", null)
    .order("catalog_categories(sort_order)", { ascending: true })
    .limit(10)

  console.log("Error:", error)
  if (data) {
    console.log(data.map(d => ({ name: d.name, cat: d.category?.name })))
  }
}
test()
