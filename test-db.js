const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
    const { data, error } = await supabase.rpc('add_credits', { p_site_id: '12345678-1234-1234-1234-123456789012', p_credits: 0 });
    console.log(data, error);
})();
