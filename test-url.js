const { SupabaseClient } = require('@supabase/supabase-js')
const supabase = new SupabaseClient('https://example.com', 'dummy')

const query = supabase.from('items').select('id, cat(sort)').order('cat(sort)', { ascending: true, nullsFirst: false })
console.log(query.url.toString())
