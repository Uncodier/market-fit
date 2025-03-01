import { createClient } from "@/utils/supabase/client"
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
    return { error: "Error al cargar los assets", assets: [] }
  }
}

export async function createAsset(data: CreateAssetInput): Promise<{ error?: string, asset?: Asset, debug?: any }> {
  try {
    const supabase = createClient()
    
    // Validar los datos de entrada
    const validatedData = CreateAssetSchema.parse(data)
    
    // Verificar que el site_id sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validatedData.site_id)) {
      return { error: "ID de sitio inválido" }
    }

    // Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error("Error getting authenticated user:", authError)
      return { error: "Error de autenticación" }
    }

    if (!user) {
      return { error: "Usuario no autenticado" }
    }

    // Verificar que el usuario tenga acceso al sitio
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('id, user_id')
      .eq('id', validatedData.site_id)
      .single()
    
    if (siteError) {
      console.error("Error verificando acceso al sitio:", siteError)
      return { error: "Error al verificar acceso al sitio" }
    }
    
    if (!siteData) {
      return { error: "El sitio especificado no existe" }
    }
    
    if (siteData.user_id !== user.id) {
      return { error: "No tienes acceso a este sitio" }
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
      has_site_access: siteData.user_id === user.id
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
          user_id: user.id
        }
      ])
      .select()
      .single()

    if (error) {
      console.error("Error inserting asset:", error)
      if (error.code === "22P02") {
        return { error: "ID de sitio inválido", debug: { ...debugInfo, error } }
      }
      if (error.code === "23503") {
        return { error: "El sitio seleccionado no existe", debug: { ...debugInfo, error } }
      }
      if (error.code === "42501") {
        return { error: "No tienes permisos para crear assets en este sitio", debug: { ...debugInfo, error } }
      }
      return { error: `Error al crear el asset: ${error.message}`, debug: { ...debugInfo, error } }
    }

    return { asset, debug: debugInfo }
  } catch (error) {
    console.error("Error creating asset:", error)
    if (error instanceof z.ZodError) {
      return { error: "Datos de entrada inválidos", debug: { error } }
    }
    return { error: "Error al crear el asset", debug: { error } }
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
        return { error: `El bucket "${bucketName}" no existe. Por favor, créalo en el panel de Supabase Storage.` }
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
    return { error: error instanceof Error ? error.message : "Error al subir el archivo" }
  }
}

export async function deleteAsset(assetId: string): Promise<{ success?: boolean, error?: string }> {
  try {
    const supabase = createClient()
    const bucketName = 'assets'

    // Validar que el assetId sea un UUID válido
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
      return { error: "ID de asset inválido" }
    }

    // Primero obtenemos el asset para conocer la ruta del archivo
    const { data: asset, error: fetchError } = await supabase
      .from("assets")
      .select("file_path")
      .eq('id', assetId)
      .single()

    if (fetchError) {
      return { error: "No se pudo encontrar el asset" }
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
        return { error: "No tienes permisos para eliminar este asset" }
      }
      throw error
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting asset:', error)
    return { error: error instanceof Error ? error.message : 'Error al eliminar el asset' }
  }
} 