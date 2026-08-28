import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function run() {
  const { data, error } = await supabase
    .from('instance_plans')
    .select('id, title, status')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) console.error("Error:", error)
  else console.log(JSON.stringify(data, null, 2))
}
run()
