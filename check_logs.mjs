import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase
    .from('instance_logs')
    .select('message, details')
    .eq('log_type', 'user_action')
    .order('created_at', { ascending: false })
    .limit(10)
    
  if (error) {
    console.error(error)
    return
  }
  
  console.log("Recent user_actions details:")
  data.forEach((log, i) => {
    console.log(`\nLog ${i}:`)
    console.log("Message:", log.message)
    console.log("Details:", JSON.stringify(log.details, null, 2))
  })
}

main()
