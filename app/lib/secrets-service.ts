import { createClient } from '@supabase/supabase-js'
import CryptoJS from 'crypto-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'Encryption-key'

export const encryptToken = (text: string): string => {
  const salt = CryptoJS.lib.WordArray.random(128 / 8).toString()
  const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY + salt).toString()
  return `${salt}:${encrypted}`
}

export const decryptToken = (encryptedValue: string): string | null => {
  try {
    const [salt, encrypted] = encryptedValue.split(':')
    const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY + salt)
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Error decrypting token:', error)
    return null
  }
}

export async function getSiteSecret(siteId: string, provider: string, useCase: string, instanceId?: string): Promise<string | null> {
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
