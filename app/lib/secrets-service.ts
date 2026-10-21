import "server-only"

import { createClient } from '@supabase/supabase-js'
import CryptoJS from 'crypto-js'
import { requirePrivateCommerceSiteAccess } from '@/app/commerce/private-site-access'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
function encryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is not configured')
  return key
}

export const encryptToken = (text: string): string => {
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString()
  const encrypted = CryptoJS.AES.encrypt(text, encryptionKey() + salt).toString()
  return `${salt}:${encrypted}`
}

export const decryptToken = (encryptedValue: string): string | null => {
  try {
    const [salt, encrypted] = encryptedValue.split(':')
    if (!encrypted) return null;
    
    let result = '';
    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey() + salt);
      result = decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
      // An explicitly configured legacy key may decrypt older values.
    }
    
    if (!result && process.env.LEGACY_ENCRYPTION_KEY) {
      const legacyKey = process.env.LEGACY_ENCRYPTION_KEY;
      const decryptedLegacy = CryptoJS.AES.decrypt(encrypted, legacyKey + salt);
      result = decryptedLegacy.toString(CryptoJS.enc.Utf8);
    }
    
    return result || null;
  } catch (error) {
    console.error('Error decrypting token:', error)
    return null
  }
}

export async function getSiteSecret(siteId: string, provider: string, useCase: string, instanceId?: string): Promise<string | null> {
  const access = await requirePrivateCommerceSiteAccess(siteId, ["select"], true)
  if (access.error) return null
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  let query = supabase
    .from('site_secrets')
    .select('encrypted_value')
    .eq('site_id', siteId)
    .eq('provider', provider)
    .eq('use_case', useCase)

  if (instanceId) {
    query = query.eq('instance_id', instanceId)
  } else {
    query = query.is('instance_id', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data || !data.encrypted_value) {
    return null
  }

  return decryptToken(data.encrypted_value)
}
