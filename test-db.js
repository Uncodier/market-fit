const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('api_keys').insert({
    name: 'test',
    key_hash: '123',
    prefix: 'test',
    scopes: ['read'],
    user_id: 'a688aab9-e58e-4a65-8968-07d0f97087bc', // need a valid user id or it might fail FK
    site_id: null,
    expires_at: new Date().toISOString(),
    status: 'active'
  }).select();
  console.log('Result:', data, error);
}
test();
