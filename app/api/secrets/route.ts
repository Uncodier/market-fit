import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

// Cliente de Supabase con rol de servicio
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'Encryption-key';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { operation, siteId, instanceId, name, provider, useCase, secretValue } = body;
    
    if (!siteId || !provider || !useCase || !operation) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Función para encriptar con AES
    const encryptToken = (text: string): string => {
      const salt = CryptoJS.lib.WordArray.random(128/8).toString();
      const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY + salt).toString();
      return `${salt}:${encrypted}`;
    };

    // Función para desencriptar
    const decryptToken = (encryptedValue: string): string | null => {
      try {
        const [salt, encrypted] = encryptedValue.split(':');
        const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY + salt);
        return decrypted.toString(CryptoJS.enc.Utf8);
      } catch (error) {
        console.error('Error decrypting token:', error);
        return null;
      }
    };

    if (operation === 'store') {
      if (!secretValue || !name) {
        return NextResponse.json(
          { error: 'Missing secretValue or name' },
          { status: 400 }
        );
      }
      
      const encryptedValue = encryptToken(secretValue);

      // 1. Check if site_secrets already exists
      let query = supabase
        .from('site_secrets')
        .select('id')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase);
        
      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      } else {
        query = query.is('instance_id', null);
      }

      const { data: existingSiteSecret } = await query.maybeSingle();

      // 2. Insert or update site_secrets
      let secretId = null;
      if (existingSiteSecret) {
        const { data, error: updateError } = await supabase
          .from('site_secrets')
          .update({
            encrypted_value: encryptedValue,
            name: name
          })
          .eq('id', existingSiteSecret.id)
          .select('id')
          .single();
          
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        secretId = data.id;
      } else {
        const { data, error: insertError } = await supabase
          .from('site_secrets')
          .insert({
            site_id: siteId,
            instance_id: instanceId || null,
            name: name,
            provider: provider,
            use_case: useCase,
            encrypted_value: encryptedValue
          })
          .select('id')
          .single();
          
        if (insertError) {
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }
        secretId = data.id;
      }
      
      return NextResponse.json({ success: true, id: secretId });
    } 
    
    else if (operation === 'retrieve') {
      let query = supabase
        .from('site_secrets')
        .select('encrypted_value')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase);

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      } else {
        query = query.is('instance_id', null);
      }

      const { data: siteSecret, error: siteSecretError } = await query.maybeSingle();
        
      if (siteSecretError || !siteSecret || !siteSecret.encrypted_value) {
        return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
      }

      const decryptedValue = decryptToken(siteSecret.encrypted_value);

      if (!decryptedValue) {
        return NextResponse.json({ error: 'Failed to decrypt secret' }, { status: 500 });
      }

      return NextResponse.json({ secretValue: decryptedValue });
    }
    
    else if (operation === 'check') {
      let query = supabase
        .from('site_secrets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase);

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      } else {
        query = query.is('instance_id', null);
      }

      const { count, error } = await query;
        
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      return NextResponse.json({ exists: count ? count > 0 : false });
    }
    
    else if (operation === 'delete') {
      let query = supabase
        .from('site_secrets')
        .select('id')
        .eq('site_id', siteId)
        .eq('provider', provider)
        .eq('use_case', useCase);

      if (instanceId) {
        query = query.eq('instance_id', instanceId);
      } else {
        query = query.is('instance_id', null);
      }

      const { data: siteSecret } = await query.maybeSingle();
        
      if (siteSecret) {
        await supabase.from('site_secrets').delete().eq('id', siteSecret.id);
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
