'use server'

import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import * as siteService from '@/lib/services/site-service'
import { getUserProfileFromServer } from '@/lib/services/auth-service'
import type { ResourceUrl } from '@/lib/types/database.types'

// Crear un cliente de acciones seguras
const action = createSafeActionClient()

// Esquema para ResourceUrl
const resourceUrlSchema = z.object({
  key: z.string().min(1, 'La clave es requerida'),
  url: z.string().url('URL inválida')
})

// Esquema para crear un sitio
const createSiteSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  url: z.string().url('URL inválida').or(z.string().length(0).transform(() => null)),
  description: z.string().optional().transform(val => val || null),
  logo_url: z.string().url('URL de logo inválida').optional().transform(val => val || null),
  resource_urls: z.array(resourceUrlSchema).optional().transform(val => val || [])
})

// Esquema para actualizar un sitio
const updateSiteSchema = z.object({
  id: z.string().min(1, 'El ID es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  url: z.string().url('URL inválida').or(z.string().length(0).transform(() => null)),
  description: z.string().optional().transform(val => val || null),
  logo_url: z.string().url('URL de logo inválida').optional().transform(val => val || null),
  resource_urls: z.array(resourceUrlSchema).optional().transform(val => val || [])
})

// Tipos inferidos a partir de los esquemas Zod
type CreateSiteInput = z.infer<typeof createSiteSchema>
type UpdateSiteInput = z.infer<typeof updateSiteSchema>
type DeleteSiteInput = { id: string }

// Acción para crear un sitio
export const createSiteAction = action(createSiteSchema, async (data: CreateSiteInput) => {
  try {
    const user = await getUserProfileFromServer()
    
    if (!user) {
      return {
        success: false,
        error: 'No estás autenticado'
      }
    }
    
    const site = await siteService.createSite({
      name: data.name,
      url: data.url,
      description: data.description,
      logo_url: data.logo_url,
      resource_urls: data.resource_urls as ResourceUrl[],
      user_id: user.id
    })
    
    revalidatePath('/settings')
    revalidatePath('/')
    
    return {
      success: true,
      data: site
    }
  } catch (error) {
    console.error('Error al crear sitio:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear sitio'
    }
  }
})

// Acción para actualizar un sitio
export const updateSiteAction = action(updateSiteSchema, async (data: UpdateSiteInput) => {
  try {
    const user = await getUserProfileFromServer()
    
    if (!user) {
      return {
        success: false,
        error: 'No estás autenticado'
      }
    }
    
    // Verificar que el sitio pertenece al usuario
    const currentSite = await siteService.getSiteById(data.id)
    
    if (currentSite.user_id !== user.id) {
      return {
        success: false,
        error: 'No tienes permiso para actualizar este sitio'
      }
    }
    
    const updatedSite = await siteService.updateSite(data.id, {
      name: data.name,
      url: data.url,
      description: data.description,
      logo_url: data.logo_url,
      resource_urls: data.resource_urls as ResourceUrl[]
    })
    
    revalidatePath('/settings')
    revalidatePath('/')
    
    return {
      success: true,
      data: updatedSite
    }
  } catch (error) {
    console.error('Error al actualizar sitio:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar sitio'
    }
  }
})

// Acción para eliminar un sitio
export const deleteSiteAction = action(
  z.object({
    id: z.string().min(1, 'El ID es requerido')
  }),
  async ({ id }: DeleteSiteInput) => {
    try {
      const user = await getUserProfileFromServer()
      
      if (!user) {
        return {
          success: false,
          error: 'No estás autenticado'
        }
      }
      
      // Verificar que el sitio pertenece al usuario
      const currentSite = await siteService.getSiteById(id)
      
      if (currentSite.user_id !== user.id) {
        return {
          success: false,
          error: 'No tienes permiso para eliminar este sitio'
        }
      }
      
      await siteService.deleteSite(id)
      
      revalidatePath('/settings')
      revalidatePath('/')
      
      return {
        success: true
      }
    } catch (error) {
      console.error('Error al eliminar sitio:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al eliminar sitio'
      }
    }
  }
) 