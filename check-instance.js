const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rnjgeloamtszdjplmqxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuamdlbG9hbXRzemRqcGxtcXh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MDYxNzMwMSwiZXhwIjoyMDU2MTkzMzAxfQ.Thk7xYSDPXEjfR50azUyWMsxy52arJkpZUWsTCrh7yo';
const instanceId = 'a37d1a91-e728-44fe-a031-d7d4c1de21b7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log(`Checking instance ID: ${instanceId}\n`);

  const { data: instanceData, error: instanceError } = await supabase
    .from('remote_instances')
    .select('*')
    .eq('id', instanceId)
    .single();

  if (instanceError) {
    console.error('Error fetching instance:', instanceError.message);
  } else {
    console.log('Instance Data:', instanceData);
  }

  const { data: reqData, error: reqError } = await supabase
    .from('requirements')
    .select('*')
    .eq('instance_id', instanceId);

  if (reqError) {
    console.error('Error fetching requirements:', reqError.message);
  } else {
    console.log(`Found ${reqData?.length || 0} requirements.`);
    console.log('Requirements:', JSON.stringify(reqData, null, 2));
  }

  const { data: statusData, error: statusError } = await supabase
    .from('requirement_status')
    .select('*')
    .eq('instance_id', instanceId);

  if (statusError) {
    console.error('Error fetching requirement_status:', statusError.message);
  } else {
    console.log(`Found ${statusData?.length || 0} requirement statuses.`);
    console.log('Requirement Statuses:', JSON.stringify(statusData, null, 2));
  }

  const { data: artifactsData, error: artifactsError } = await supabase
    .from('instance_artifacts')
    .select('*')
    .eq('instance_id', instanceId);

  if (artifactsError) {
    console.error('Error fetching artifacts:', artifactsError.message);
  } else {
    console.log(`Found ${artifactsData?.length || 0} artifacts.`);
    console.log('Artifacts:', JSON.stringify(artifactsData, null, 2));
  }
}

check();
