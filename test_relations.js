const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function test() {
  const r1 = await supabase.from('quotations').select('id, lead:leads(name)').limit(1)
  console.log('Quotation lead:', r1.error ? r1.error.message : 'OK')
  const r2 = await supabase.from('deals').select('id, lead:leads(name)').limit(1)
  console.log('Deal lead:', r2.error ? r2.error.message : 'OK')
  const r3 = await supabase.from('records').select('id, lead:leads(name)').limit(1)
  console.log('Record lead:', r3.error ? r3.error.message : 'OK')
  const r4 = await supabase.from('deals').select('id, company:companies(name)').limit(1)
  console.log('Deal company:', r4.error ? r4.error.message : 'OK')
}
test()
