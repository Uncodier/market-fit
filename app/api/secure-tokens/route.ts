import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

// La clave de encriptación fija
const ENCRYPTION_KEY = 'Encryption-key';

// Cliente de Supabase con rol de servicio
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    
    // Extract parameters
    const { operation, siteId, tokenType, tokenValue, identifier } = body;
    
    if (!siteId || !tokenType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    console.log(`Processing ${operation} operation for site ${siteId}, type ${tokenType}`);
    
    // Crear cliente de Supabase con rol de servicio
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection error' },
        { status: 500 }
      );
    }
    
    // Función para encriptar con AES (reemplaza SHA-256)
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
    
    // Si estamos guardando un token
    if (operation === 'store') {
      if (!tokenValue || !identifier) {
        return NextResponse.json(
          { error: 'Missing token value or identifier' },
          { status: 400 }
        );
      }
      
      try {
        // Encriptar el valor del token
        const encryptedValue = encryptToken(tokenValue);
        
        // Intentar insertar o actualizar el token
        let result = null;
        
        // Primero, verificar si ya existe
        const { data: existingToken } = await supabase
          .from('secure_tokens')
          .select('id')
          .eq('site_id', siteId)
          .eq('token_type', tokenType)
          .eq('identifier', identifier)
          .maybeSingle();
        
        if (existingToken) {
          // Actualizar el existente
          const { data, error } = await supabase
            .from('secure_tokens')
            .update({
              encrypted_value: encryptedValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingToken.id)
            .select('id')
            .single();
          
          if (error) {
            console.error('Error updating token:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
          
          result = data.id;
        } else {
          // Insertar nuevo
          const { data, error } = await supabase
            .from('secure_tokens')
            .insert({
              site_id: siteId,
              token_type: tokenType,
              identifier: identifier,
              encrypted_value: encryptedValue,
              last_used: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (error) {
            console.error('Error storing token:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
          
          result = data.id;
        }
        
        return NextResponse.json({ 
          success: true, 
          tokenId: result 
        });
      } catch (error: any) {
        console.error('Error storing token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    // Verificar un token
    else if (operation === 'verify') {
      if (!tokenValue || !identifier) {
        return NextResponse.json(
          { error: 'Missing token value or identifier' },
          { status: 400 }
        );
      }
      
      try {
        // Obtener el token almacenado
        const { data, error } = await supabase
          .from('secure_tokens')
          .select('encrypted_value')
          .eq('site_id', siteId)
          .eq('token_type', tokenType)
          .eq('identifier', identifier)
          .maybeSingle();
        
        if (error) {
          console.error('Error retrieving token:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        if (!data) {
          return NextResponse.json({ isValid: false });
        }
        
        // Desencriptar el token almacenado
        const decryptedToken = decryptToken(data.encrypted_value);
        
        // Comparar con el valor proporcionado
        const isValid = decryptedToken === tokenValue;
        
        // Actualizar last_used si es válido
        if (isValid) {
          await supabase
            .from('secure_tokens')
            .update({ last_used: new Date().toISOString() })
            .eq('site_id', siteId)
            .eq('token_type', tokenType)
            .eq('identifier', identifier);
        }
        
        return NextResponse.json({ isValid });
      } catch (error: any) {
        console.error('Error verifying token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    // Recuperar un token
    else if (operation === 'retrieve') {
      if (!identifier) {
        return NextResponse.json(
          { error: 'Missing identifier' },
          { status: 400 }
        );
      }
      
      try {
        // Obtener el token almacenado
        const { data, error } = await supabase
          .from('secure_tokens')
          .select('encrypted_value')
          .eq('site_id', siteId)
          .eq('token_type', tokenType)
          .eq('identifier', identifier)
          .maybeSingle();
        
        if (error) {
          console.error('Error retrieving token:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        if (!data) {
          return NextResponse.json(
            { error: 'Token not found' },
            { status: 404 }
          );
        }
        
        // Desencriptar y devolver el valor original
        const decryptedValue = decryptToken(data.encrypted_value);
        
        if (!decryptedValue) {
          return NextResponse.json(
            { error: 'Failed to decrypt token' },
            { status: 500 }
          );
        }
        
        // Actualizar último uso
        await supabase
          .from('secure_tokens')
          .update({ last_used: new Date().toISOString() })
          .eq('site_id', siteId)
          .eq('token_type', tokenType)
          .eq('identifier', identifier);
        
        return NextResponse.json({ tokenValue: decryptedValue });
      } catch (error: any) {
        console.error('Error retrieving token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    // Comprobar si existe
    else if (operation === 'check') {
      if (!identifier) {
        return NextResponse.json(
          { error: 'Missing identifier' },
          { status: 400 }
        );
      }
      
      try {
        // Comprobar existencia
        const { count, error } = await supabase
          .from('secure_tokens')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('token_type', tokenType)
          .eq('identifier', identifier);
        
        if (error) {
          console.error('Error checking token:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        return NextResponse.json({ exists: count ? count > 0 : false });
      } catch (error: any) {
        console.error('Error checking token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    // Eliminar token
    else if (operation === 'delete') {
      if (!identifier) {
        return NextResponse.json(
          { error: 'Missing identifier' },
          { status: 400 }
        );
      }
      
      try {
        // Eliminar token
        const { error } = await supabase
          .from('secure_tokens')
          .delete()
          .eq('site_id', siteId)
          .eq('token_type', tokenType)
          .eq('identifier', identifier);
        
        if (error) {
          console.error('Error deleting token:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('Error deleting token:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    
    else {
      return NextResponse.json(
        { error: 'Invalid operation' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('General error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 