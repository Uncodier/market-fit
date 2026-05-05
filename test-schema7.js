const { createClient } = require('@supabase/supabase-js');

// These aren't the real secrets as the original didn't use dotenv, just using the same keys from test-schema3
const supabaseUrl = 'https://rnjgeloamtszdjplmqxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuamdlbG9hbXRzemRqcGxtcXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MTczMDEsImV4cCI6MjA1NjE5MzMwMX0.xeoUChfi9t7DpJnwoDJxvYe9gJW6jFlGnPuLS0mIYzI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('requirement_status')
    .select('*, requirements(title, backlog)')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.error('Error:', error);
  } else {
    for (const d of data) {
        if (d.requirements && (Array.isArray(d.requirements) ? d.requirements[0]?.backlog : d.requirements.backlog)) {
            console.log("FOUND", d.requirements);
            return;
        }
    }
    console.log('No backlog found in the last 5');
  }
}

checkSchema();