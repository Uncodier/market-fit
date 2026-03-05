const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fix() {
  const { data, error } = await supabase.auth.admin.getUserById('541396e1-a904-4a81-8cbf-0ca4e3b8b2b4');
  console.log('Original phone:', data?.user?.phone);
  console.log('Original metadata phone:', data?.user?.user_metadata?.phone);
  
  const { error: updErr } = await supabase.auth.admin.updateUserById('541396e1-a904-4a81-8cbf-0ca4e3b8b2b4', {
      phone: '+524611721870'
  });
  console.log('Update Error:', updErr);
  
  const { data: d2 } = await supabase.auth.admin.getUserById('541396e1-a904-4a81-8cbf-0ca4e3b8b2b4');
  console.log('New phone:', d2?.user?.phone);
}
fix();
