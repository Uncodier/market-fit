import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const siteId = '353b235b-1242-4e5e-9bfa-f0cf23363483';
  
  // Find leads where name contains only numbers (or numbers with spaces/dashes)
  // or where name matches the phone number
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, company, companies(name)')
    .eq('site_id', siteId);

  if (error) {
    console.error("Error fetching leads:", error);
    return;
  }

  const leadsToFix = data.filter(lead => {
    if (!lead.name) return false;
    
    // Check if name is mostly numbers
    const digitsOnly = lead.name.replace(/\D/g, '');
    const isMostlyNumbers = digitsOnly.length > 5 && digitsOnly.length / lead.name.length > 0.5;
    
    // Check if name equals phone
    const isSameAsPhone = lead.phone && (
      lead.name === lead.phone || 
      lead.name.replace(/\D/g, '') === lead.phone.replace(/\D/g, '')
    );
    
    // It must have a valid company name to use as a replacement
    const hasCompanyName = 
      (lead.companies && lead.companies.name) || 
      (typeof lead.company === 'object' && lead.company && lead.company.name) ||
      (typeof lead.company === 'string' && lead.company.trim().length > 0);
      
    return (isMostlyNumbers || isSameAsPhone) && hasCompanyName;
  });

  console.log(`Found ${leadsToFix.length} leads to fix out of ${data.length} total leads.`);
  
  for (const lead of leadsToFix) {
    let companyName = "";
    if (lead.companies && lead.companies.name) {
      companyName = lead.companies.name;
    } else if (typeof lead.company === 'object' && lead.company && lead.company.name) {
      companyName = lead.company.name;
    } else if (typeof lead.company === 'string') {
      companyName = lead.company.trim();
    }
    
    console.log(`Fixing lead ${lead.id}: Change name from "${lead.name}" to "${companyName}"`);
    
    const { error: updateError } = await supabase
      .from('leads')
      .update({ name: companyName })
      .eq('id', lead.id);
      
    if (updateError) {
      console.error(`Failed to update lead ${lead.id}:`, updateError);
    }
  }
  
  console.log("Finished updating leads.");
}

main();