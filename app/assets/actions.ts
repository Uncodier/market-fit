import { createClient } from "@/lib/supabase/client"
import { z } from "zod"

// Definir el schema de respuesta
const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  file_path: z.string(),
  file_type: z.string(),
  file_size: z.number().nullable(),
  metadata: z.record(z.any()).nullable(),
  is_public: z.boolean(),
  site_id: z.string(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string()
})

export type Asset = z.infer<typeof AssetSchema>

// Schema para validar los datos de entrada al crear un asset
const CreateAssetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  file_path: z.string().min(1, "File path is required"),
  file_type: z.string().min(1, "File type is required"),
  file_size: z.number().optional(),
  tags: z.array(z.string()).optional(),
  site_id: z.string().min(1, "Site ID is required"),
  instance_id: z.string().optional(),
})

export type CreateAssetInput = z.infer<typeof CreateAssetSchema>

export async function getAssets(site_id: string): Promise<{ assets?: Asset[], error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from("assets")
      .select(`
        id,
        name,
        description,
        file_path,
        file_type,
        file_size,
        metadata,
        is_public,
        site_id,
        user_id,
        created_at,
        updated_at
      `)
      .eq('site_id', site_id)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Si no hay datos, retornamos un array vacío en lugar de null
    return { assets: data || [] }
  } catch (error) {
    console.error("Error loading assets:", error)
    return { error: "Error loading assets", assets: [] }
  }
}

// Function to attach an asset to an agent
export async function attachAssetToAgent(agentId: string, assetId: string): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    
    // Check if the relationship already exists
    const { data: existingRelation, error: checkError } = await supabase
      .from('agent_assets')
      .select('*')
      .eq('agent_id', agentId)
      .eq('asset_id', assetId)
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error("Error checking existing relation:", checkError)
      return { error: "Error checking asset relation" }
    }
    
    if (existingRelation) {
      return { error: "Asset is already attached to this agent" }
    }
    
    // Create the relationship
    const { error } = await supabase
      .from('agent_assets')
      .insert([{
        agent_id: agentId,
        asset_id: assetId
      }])
    
    if (error) {
      console.error("Error attaching asset to agent:", error)
      return { error: "Error attaching asset to agent" }
    }
    
    return {}
  } catch (error) {
    console.error("Error attaching asset to agent:", error)
    return { error: "Error attaching asset to agent" }
  }
}

// Function to detach an asset from an agent
export async function detachAssetFromAgent(agentId: string, assetId: string): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('agent_assets')
      .delete()
      .match({
        agent_id: agentId,
        asset_id: assetId
      })
    
    if (error) {
      console.error("Error detaching asset from agent:", error)
      return { error: "Error detaching asset from agent" }
    }
    
    return {}
  } catch (error) {
    console.error("Error detaching asset from agent:", error)
    return { error: "Error detaching asset from agent" }
  }
}

// Function to get agent's attached assets
export async function getAgentAssets(agentId: string): Promise<{ assetIds?: string[], error?: string }> {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('agent_assets')
      .select('asset_id')
      .eq('agent_id', agentId)
    
    if (error) {
      console.error("Error getting agent assets:", error)
      return { error: "Error getting agent assets" }
    }
    
    return { assetIds: data?.map((item: { asset_id: string }) => item.asset_id) || [] }
  } catch (error) {
    console.error("Error getting agent assets:", error)
    return { error: "Error getting agent assets" }
  }
}

// --- Content-Assets (many-to-many) ---

export type ContentAssetWithDetails = {
  id: string
  name: string
  description: string | null
  file_path: string
  file_type: string
  file_size: number | null
  position: number
  is_primary: boolean
  created_at: string
}

export async function getContentAssets(contentId: string): Promise<{
  assets?: ContentAssetWithDetails[]
  error?: string
}> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('content_assets')
      .select(`
        position,
        is_primary,
        created_at,
        assets (
          id,
          name,
          description,
          file_path,
          file_type,
          file_size,
          created_at
        )
      `)
      .eq('content_id', contentId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error("Error getting content assets:", error)
      return { error: "Error getting content assets" }
    }

    const assets: ContentAssetWithDetails[] = (data || [])
      .filter((row: { assets: unknown }) => row.assets != null)
      .map((row: {
        position: number
        is_primary: boolean
        created_at: string
        assets: {
          id: string
          name: string
          description: string | null
          file_path: string
          file_type: string
          file_size: number | null
          created_at: string
        }
      }) => ({
        id: row.assets.id,
        name: row.assets.name,
        description: row.assets.description,
        file_path: row.assets.file_path,
        file_type: row.assets.file_type,
        file_size: row.assets.file_size,
        position: row.position,
        is_primary: row.is_primary,
        created_at: row.created_at
      }))

    return { assets }
  } catch (error) {
    console.error("Error getting content assets:", error)
    return { error: "Error getting content assets" }
  }
}

/** Fetch assets for multiple content IDs. Returns a map contentId -> assets (ordered; primary first). */
export async function getContentAssetsByContentIds(contentIds: string[]): Promise<{
  byContentId?: Record<string, ContentAssetWithDetails[]>
  error?: string
}> {
  if (contentIds.length === 0) return { byContentId: {} }
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('content_assets')
      .select(`
        content_id,
        position,
        is_primary,
        created_at,
        assets (
          id,
          name,
          description,
          file_path,
          file_type,
          file_size,
          created_at
        )
      `)
      .in('content_id', contentIds)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error("Error getting content assets bulk:", error)
      return { error: "Error getting content assets" }
    }

    const byContentId: Record<string, ContentAssetWithDetails[]> = {}
    for (const id of contentIds) byContentId[id] = []
    ;(data || []).forEach((row: {
      content_id: string
      position: number
      is_primary: boolean
      created_at: string
      assets: {
        id: string
        name: string
        description: string | null
        file_path: string
        file_type: string
        file_size: number | null
        created_at: string
      } | null
    }) => {
      if (!row.assets) return
      const list = byContentId[row.content_id] || []
      list.push({
        id: row.assets.id,
        name: row.assets.name,
        description: row.assets.description,
        file_path: row.assets.file_path,
        file_type: row.assets.file_type,
        file_size: row.assets.file_size,
        position: row.position,
        is_primary: row.is_primary,
        created_at: row.created_at
      })
      byContentId[row.content_id] = list
    })
    return { byContentId }
  } catch (error) {
    console.error("Error getting content assets bulk:", error)
    return { error: "Error getting content assets" }
  }
}

export async function attachAssetToContent(
  contentId: string,
  assetId: string,
  options?: { is_primary?: boolean; position?: number }
): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    const isPrimary = options?.is_primary ?? false
    const position = options?.position ?? 0

    if (isPrimary) {
      await supabase
        .from('content_assets')
        .update({ is_primary: false })
        .eq('content_id', contentId)
    }

    const { error } = await supabase
      .from('content_assets')
      .insert({
        content_id: contentId,
        asset_id: assetId,
        position,
        is_primary: isPrimary
      })

    if (error) {
      if (error.code === '23505') return { error: "Asset is already linked to this content" }
      console.error("Error attaching asset to content:", error)
      return { error: "Error attaching asset to content" }
    }
    return {}
  } catch (error) {
    console.error("Error attaching asset to content:", error)
    return { error: "Error attaching asset to content" }
  }
}

export async function detachAssetFromContent(contentId: string, assetId: string): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('content_assets')
      .delete()
      .match({ content_id: contentId, asset_id: assetId })

    if (error) {
      console.error("Error detaching asset from content:", error)
      return { error: "Error detaching asset from content" }
    }
    return {}
  } catch (error) {
    console.error("Error detaching asset from content:", error)
    return { error: "Error detaching asset from content" }
  }
}

export async function setContentPrimaryAsset(
  contentId: string,
  assetId: string
): Promise<{ error?: string }> {
  try {
    const supabase = createClient()
    const { error: unsetError } = await supabase
      .from('content_assets')
      .update({ is_primary: false })
      .eq('content_id', contentId)
    if (unsetError) {
      console.error("Error unsetting primary:", unsetError)
      return { error: "Error updating primary asset" }
    }
    const { error } = await supabase
      .from('content_assets')
      .update({ is_primary: true })
      .eq('content_id', contentId)
      .eq('asset_id', assetId)
    if (error) {
      console.error("Error setting primary:", error)
      return { error: "Error setting primary asset" }
    }
    return {}
  } catch (error) {
    console.error("Error setting primary asset:", error)
    return { error: "Error setting primary asset" }
  }
}

export async function createAsset(data: CreateAssetInput): Promise<{ error?: string, asset?: Asset, debug?: any }> {
  try {
    const supabase = createClient()
    
    // Validar los datos de entrada
    const validatedData = CreateAssetSchema.parse(data)
    
    // Verificar que el site_id sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedData.site_id)) {
      return { error: "Invalid site ID" }
    }

    // Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Authentication error" }
    }

    if (!user) {
      return { error: "User not authenticated" }
    }

    // Verify the user has access to the site (owner or active member)
    // 1) Fetch site owner
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', validatedData.site_id)
      .single()

    if (siteError) {
      console.error("Error verifying site access:", siteError)
      return { error: "Error verifying site access" }
    }

    if (!siteData) {
      return { error: "Specified site does not exist" }
    }

    let hasSiteAccess = siteData.user_id === user.id

    if (!hasSiteAccess) {
      // 2) If not owner, check active membership
      const { data: member, error: memberError } = await supabase
        .from('site_members')
        .select('id')
        .eq('site_id', validatedData.site_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      if (memberError) {
        console.error('Error checking site membership:', memberError)
      }

      hasSiteAccess = !!member
    }

    if (!hasSiteAccess) {
      return { error: "You don't have access to this site" }
    }

    // Preparar los metadatos con las etiquetas
    const metadata = {
      tags: validatedData.tags || []
    }

    // Información de diagnóstico
    const debugInfo = {
      authenticated_user_id: user.id,
      site_id: validatedData.site_id,
      site_user_id: siteData.user_id,
      has_site_access: true
    }

    const { data: asset, error } = await supabase
      .from("assets")
      .insert([
        {
          name: validatedData.name,
          description: validatedData.description || null,
          file_path: validatedData.file_path,
          file_type: validatedData.file_type,
          file_size: validatedData.file_size || 0,
          metadata,
          site_id: validatedData.site_id,
          user_id: user.id,
          instance_id: validatedData.instance_id || null
        }
      ])
      .select()
      .single()

    if (error) {
      console.error("Error inserting asset:", error)
      if (error.code === "22P02") {
        return { error: "Invalid site ID", debug: { ...debugInfo, error } }
      }
      if (error.code === "23503") {
        return { error: "Selected site does not exist", debug: { ...debugInfo, error } }
      }
      if (error.code === "42501") {
        return { error: "You don't have permission to create assets in this site", debug: { ...debugInfo, error } }
      }
      return { error: `Error creating asset: ${error.message}`, debug: { ...debugInfo, error } }
    }

    return { asset, debug: debugInfo }
  } catch (error) {
    console.error("Error creating asset:", error)
    if (error instanceof z.ZodError) {
      return { error: "Invalid input data", debug: { error } }
    }
    return { error: "Error creating asset", debug: { error } }
  }
}

export async function uploadAssetFile(file: File): Promise<{ path?: string, error?: string }> {
  try {
    const supabase = createClient()
    
    // Generar un nombre de archivo único
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
    const filePath = `assets/${fileName}`
    
    // Nombre del bucket - asegúrate de que este bucket exista en tu proyecto de Supabase
    const bucketName = 'assets'
    
    // Subir el archivo a Supabase Storage
    const { data, error } = await supabase
      .storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })
    
    if (error) {
      console.error("Storage upload error:", error)
      // Verificar si el error es por bucket no encontrado
      if (error.message === "Bucket not found") {
        return { error: `Bucket "${bucketName}" does not exist. Please create it in the Supabase Storage panel.` }
      }
      throw error
    }
    
    // Obtener la URL pública del archivo
    const { data: { publicUrl } } = supabase
      .storage
      .from(bucketName)
      .getPublicUrl(data.path)
    
    return { path: publicUrl }
  } catch (error) {
    console.error("Error uploading file:", error)
    return { error: error instanceof Error ? error.message : "Error uploading file" }
  }
}

export async function deleteAsset(assetId: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const supabase = createClient()
    const bucketName = 'assets'

    // Validar que el assetId sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
      return { error: "Invalid asset ID" }
    }

    // Primero obtenemos el asset para conocer la ruta del archivo
    const { data: asset, error: fetchError } = await supabase
      .from("assets")
      .select("file_path")
      .eq('id', assetId)
      .single()

    if (fetchError) {
      return { error: "Asset not found" }
    }

    // Eliminar el archivo de Storage
    if (asset.file_path) {
      // Extraer la ruta del archivo de la URL completa
      const urlParts = asset.file_path.split('/')
      const storagePath = urlParts[urlParts.length - 2] + '/' + urlParts[urlParts.length - 1]
      
      const { error: storageError } = await supabase
        .storage
        .from(bucketName)
        .remove([storagePath])
      
      if (storageError) {
        console.error("Error removing file from storage:", storageError)
        // Continuamos con la eliminación del registro aunque falle la eliminación del archivo
      }
    }

    // Eliminar el registro de la base de datos
    const { error } = await supabase
      .from("assets")
      .delete()
      .eq('id', assetId)

    if (error) {
      if (error.code === "42501") {
        return { error: "You don't have permission to delete this asset" }
      }
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting asset:', error)
    return { error: error instanceof Error ? error.message : 'Error deleting asset' }
  }
} 