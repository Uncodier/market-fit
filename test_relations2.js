const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function test() {
  const r3 = await supabase.from('records').select('id, company:companies(name)').limit(1)
  console.log('Record company:', r3.error ? r3.error.message : 'OK')
  const r4 = await supabase.from('records').select('*').limit(1)
  console.log('Record fields:', Object.keys(r4.data[0] || {}))
}
test()
