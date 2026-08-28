const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function test() {
  const r1 = await supabase.from('quotations').select('id, title, lead:leads(name)').limit(5)
  console.log('Quotations error:', r1.error)
  console.log('Quotations:', JSON.stringify(r1.data, null, 2))
}
test()
