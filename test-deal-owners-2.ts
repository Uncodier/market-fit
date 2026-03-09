import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: owners } = await supabase.from("deal_owners").select('*').limit(1)
  console.log("owners", owners)
  if (owners && owners.length > 0) {
    const { data: profiles, error } = await supabase.from("profiles").select('*').in('id', owners.map(o => o.user_id))
    console.log("profiles", profiles, "error", error)
  }
}
test()
