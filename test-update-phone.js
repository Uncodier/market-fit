const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.auth.admin.updateUserById('541396e1-a904-4a81-8cbf-0ca4e3b8b2b4', {
    phone: '+524611721870'
  });
  console.log('Error:', error);
  console.log('User phone:', data?.user?.phone);
}
check();
