import { createClient } from '../supabase/server'
import { Tables, TablesInsert, TablesUpdate } from '../types/database.types'

export interface SiteWithResourceUrls extends Tables<'sites'> {
  resource_urls: Array<{ key: string; url: string }> | null
}

class SiteServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SiteServiceError'
  }
}

export async function getSites(userId: string): Promise<SiteWithResourceUrls[]> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw new SiteServiceError(`Error al obtener los sitios: ${error.message}`)
    
    return data as SiteWithResourceUrls[]
  } catch (error) {
    console.error('Error en getSites:', error)
    throw error instanceof SiteServiceError
      ? error
      : new SiteServiceError('Error al obtener los sitios')
  }
}

export async function getSiteById(id: string): Promise<SiteWithResourceUrls> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw new SiteServiceError(`Error al obtener el sitio: ${error.message}`)
    if (!data) throw new SiteServiceError(`No se encontró el sitio con ID: ${id}`)
    
    return data as SiteWithResourceUrls
  } catch (error) {
    console.error('Error en getSiteById:', error)
    throw error instanceof SiteServiceError
      ? error
      : new SiteServiceError(`Error al obtener el sitio con ID: ${id}`)
  }
}

export async function createSite(
  site: Omit<TablesInsert<'sites'>, 'id' | 'created_at' | 'updated_at'>
): Promise<SiteWithResourceUrls> {
  try {
    const supabase = createClient()
    
    const now = new Date().toISOString()
    const newSite = {
      ...site,
      created_at: now,
      updated_at: now
    }
    
    const { data, error } = await supabase
      .from('sites')
      .insert(newSite)
      .select()
      .single()
    
    if (error) throw new SiteServiceError(`Error al crear el sitio: ${error.message}`)
    if (!data) throw new SiteServiceError('No se pudo crear el sitio')
    
    return data as SiteWithResourceUrls
  } catch (error) {
    console.error('Error en createSite:', error)
    throw error instanceof SiteServiceError
      ? error
      : new SiteServiceError('Error al crear el sitio')
  }
}

export async function updateSite(
  id: string,
  updates: Omit<TablesUpdate<'sites'>, 'id' | 'created_at' | 'user_id'>
): Promise<SiteWithResourceUrls> {
  try {
    const supabase = createClient()
    
    // Primero verificamos que el sitio existe
    const { data: existing, error: fetchError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError) throw new SiteServiceError(`Error al verificar el sitio: ${fetchError.message}`)
    if (!existing) throw new SiteServiceError(`No se encontró el sitio con ID: ${id}`)
    
    // Actualizar el sitio
    const { data, error } = await supabase
      .from('sites')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw new SiteServiceError(`Error al actualizar el sitio: ${error.message}`)
    if (!data) throw new SiteServiceError(`No se pudo actualizar el sitio con ID: ${id}`)
    
    return data as SiteWithResourceUrls
  } catch (error) {
    console.error('Error en updateSite:', error)
    throw error instanceof SiteServiceError
      ? error
      : new SiteServiceError(`Error al actualizar el sitio con ID: ${id}`)
  }
}

export async function deleteSite(id: string): Promise<void> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('sites')
      .delete()
      .eq('id', id)
    
    if (error) throw new SiteServiceError(`Error al eliminar el sitio: ${error.message}`)
  } catch (error) {
    console.error('Error en deleteSite:', error)
    throw error instanceof SiteServiceError
      ? error
      : new SiteServiceError(`Error al eliminar el sitio con ID: ${id}`)
  }
} 