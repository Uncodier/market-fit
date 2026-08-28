const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function test() {
  const r1 = await supabase.from('quotations').select('id, status, total, currency, created_at, lead:leads(name), deal:deals!quotations_deal_id_fkey(name)').limit(1)
  console.log('Error details:', r1.error)
}
test()
