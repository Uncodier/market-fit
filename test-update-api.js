const { createClient } = require('@supabase/supabase-js');

async function check() {
  const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  console.log(`Testing against ${url}`);
  try {
    const res = await fetch(`${url}/api/auth/update-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4', phone: '+524611721870' })
    });
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (e) {
    console.log('Error', e);
  }
}
check();
