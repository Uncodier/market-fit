const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function test() {
  const r1 = await supabase.from('quotations').select('*').limit(1)
  console.log('Quotations error:', r1.error)
  console.log('Quotations fields:', r1.data && r1.data.length > 0 ? Object.keys(r1.data[0]) : 'no data')
}
test()
