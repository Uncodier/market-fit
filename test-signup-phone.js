const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test-signup-phone' + Date.now() + '@uncodie.com',
    password: 'securepassword123',
    phone: '+5255' + Math.floor(10000000 + Math.random() * 90000000)
  });
  console.log('Error:', error);
  console.log('Data user id:', data?.user?.id);
  console.log('Data user phone:', data?.user?.phone);
}
check();
