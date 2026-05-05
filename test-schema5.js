const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://rnjgeloamtszdjplmqxy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuamdlbG9hbXRzemRqcGxtcXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2MTczMDEsImV4cCI6MjA1NjE5MzMwMX0.xeoUChfi9t7DpJnwoDJxvYe9gJW6jFlGnPuLS0mIYzI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('requirements')
    .select('id, title, backlog')
    .not('backlog', 'is', null)
    .limit(1);
  console.log(error ? error : data);
}
check();