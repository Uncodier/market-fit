import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase
    .from("deal_owners")
    .select(`
      deal_id,
      user_id,
      profiles:user_id(id, email, name)
    `)
    .limit(1)
  console.log("With profiles:user_id =>", JSON.stringify({ data, error }, null, 2))
  
  const { data: d2, error: e2 } = await supabase
    .from("deal_owners")
    .select(`
      deal_id,
      user_id,
      user:profiles(id, email, name)
    `)
    .limit(1)
  console.log("With user:profiles =>", JSON.stringify({ d2, e2 }, null, 2))
}
test()
