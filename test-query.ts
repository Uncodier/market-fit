import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase
    .from("deal_owners")
    .select(`
      *,
      user:profiles(id, email, name)
    `)
    .limit(1)
  console.log(JSON.stringify({ data, error }, null, 2))
}
test()
