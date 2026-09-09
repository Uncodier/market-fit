import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente de Supabase con rol de servicio para poder acceder a vault.secrets
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operation, siteId, name, provider, useCase, secretValue } = body;
    
    if (!siteId || !provider || !useCase || !operation) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    if (operation === 'store') {
      if (!secretValue || !name) {
        return NextResponse.json(
          { error: 'Missing secretValue or name' },
          { status: 400 }
        );
      }
      
      // 1. Check if site_secrets already exists
      const { data: existingSiteSecret } = await supabase
        .from('site_secrets')
        .select('id, vault_secret_id')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase)
        .maybeSingle();

      let vaultSecretId = null;

      if (existingSiteSecret && existingSiteSecret.vault_secret_id) {
        await supabase.schema('vault').from('secrets').delete().eq('id', existingSiteSecret.vault_secret_id);
      }

      const { data: vaultData2, error: vaultError2 } = await supabase
        .schema('vault')
        .from('secrets')
        .insert({
          secret: secretValue,
          name: `${siteId}_${provider}_${useCase}`,
          description: name
        })
        .select('id')
        .single();
        
      if (vaultError2) {
          console.error('Vault insert error:', vaultError2);
          return NextResponse.json({ error: vaultError2.message }, { status: 500 });
      }
      vaultSecretId = vaultData2.id;

      // 3. Insert or update site_secrets
      if (existingSiteSecret) {
        const { error: updateError } = await supabase
          .from('site_secrets')
          .update({
            vault_secret_id: vaultSecretId,
            name: name
          })
          .eq('id', existingSiteSecret.id);
          
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
      } else {
        const { error: insertError } = await supabase
          .from('site_secrets')
          .insert({
            site_id: siteId,
            name: name,
            provider: provider,
            use_case: useCase,
            vault_secret_id: vaultSecretId
          });
          
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
      }
      
      return NextResponse.json({ success: true });
    } 
    
    else if (operation === 'retrieve') {
      const { data: siteSecret, error: siteSecretError } = await supabase
        .from('site_secrets')
        .select('vault_secret_id')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase)
        .maybeSingle();
        
      if (siteSecretError || !siteSecret || !siteSecret.vault_secret_id) {
        return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
      }

      // Get from vault
      const { data: vaultData, error: vaultError } = await supabase
        .schema('vault')
        .from('decrypted_secrets')
        .select('decrypted_secret')
        .eq('id', siteSecret.vault_secret_id)
        .maybeSingle();

      if (vaultError || !vaultData) {
        return NextResponse.json({ error: 'Failed to retrieve from vault' }, { status: 500 });
      }

      return NextResponse.json({ secretValue: vaultData.decrypted_secret });
    }
    
    else if (operation === 'check') {
      const { count, error } = await supabase
        .from('site_secrets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase);
        
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({ exists: count ? count > 0 : false });
    }
    
    else if (operation === 'delete') {
      const { data: siteSecret } = await supabase
        .from('site_secrets')
        .select('id, vault_secret_id')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase)
        .maybeSingle();
        
      if (siteSecret) {
        // delete from site_secrets
        await supabase.from('site_secrets').delete().eq('id', siteSecret.id);
        
        // delete from vault
        if (siteSecret.vault_secret_id) {
          await supabase.schema('vault').from('secrets').delete().eq('id', siteSecret.vault_secret_id);
        }
      }
      
      return NextResponse.json({ success: true });
    }
    
    else {
      return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Secrets API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
