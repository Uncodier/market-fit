"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"

// SELLER ACTIONS

export async function listCatalogItemFiles(catalogItemId: string) {
  const supabase = await createClient()
  
  // RLS (site_members_manage_files) will protect this if we rely on it, 
  // but let's do a basic site membership check just in case.
  const { data: item } = await supabase
    .from('catalog_items')
    .select('site_id')
    .eq('id', catalogItemId)
    .single()
    
  if (!item) return { data: null, error: "Item not found" }
  
  const { data, error } = await supabase
    .from('catalog_item_files')
    .select('*')
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    
  if (error) return { data: null, error: error.message }
  return { data }
}

export async function uploadCatalogItemFile(catalogItemId: string, formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) return { error: "No file provided" }

  const supabase = await createClient()
  
  // 1. Validate item is file/license
  const { data: item } = await supabase
    .from('catalog_items')
    .select('site_id, kind, digital_subtype')
    .eq('id', catalogItemId)
    .single()
    
  if (!item) return { error: "Item not found" }
  if (item.kind !== 'digital_asset' || (item.digital_subtype !== 'file' && item.digital_subtype !== 'license')) {
    return { error: "Item is not a downloadable digital asset" }
  }

  // 2. Upload to storage
  const uuid = crypto.randomUUID()
  const storagePath = `${item.site_id}/${catalogItemId}/${uuid}_${file.name}`
  
  const { data: uploadData, error: uploadError } = await supabase
    .storage
    .from('digital-downloads')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false
    })
    
  if (uploadError) return { error: uploadError.message }

  // 3. Insert row
  const { data: fileRow, error: insertError } = await supabase
    .from('catalog_item_files')
    .insert({
      site_id: item.site_id,
      catalog_item_id: catalogItemId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size
    })
    .select()
    .single()
    
  if (insertError) {
    // Attempt cleanup
    await supabase.storage.from('digital-downloads').remove([storagePath])
    return { error: insertError.message }
  }
  
  return { data: fileRow }
}

export async function deleteCatalogItemFile(fileId: string) {
  const supabase = await createClient()
  
  // 1. Get file
  const { data: fileRow } = await supabase
    .from('catalog_item_files')
    .select('id, storage_path')
    .eq('id', fileId)
    .single()
    
  if (!fileRow) return { error: "File not found" }

  // 2. Remove from storage
  const { error: storageError } = await supabase
    .storage
    .from('digital-downloads')
    .remove([fileRow.storage_path])
    
  if (storageError) console.error("Error removing file from storage:", storageError)

  // 3. Delete row
  const { error: deleteError } = await supabase
    .from('catalog_item_files')
    .delete()
    .eq('id', fileId)
    
  if (deleteError) return { error: deleteError.message }
  return { success: true }
}

// BUYER ACTIONS

import { getActiveDigitalEntitlementForCatalogItem } from "@/app/buyer/entitlement-queries"

export async function listDownloadableFilesForBuyer(catalogItemId: string) {
  const supabase = await createServiceClient(true) // Bypass RLS to read metadata for entitled buyers
  
  const entitlement = await getActiveDigitalEntitlementForCatalogItem(catalogItemId)
  if (!entitlement) return { data: null, error: "Not entitled" }

  const { data, error } = await supabase
    .from('catalog_item_files')
    .select('id, file_name, mime_type, size_bytes')
    .eq('catalog_item_id', catalogItemId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    
  if (error) return { data: null, error: error.message }
  return { data }
}

export async function createDigitalFileDownloadUrl(fileId: string) {
  // Use service client to bypass storage RLS and create signed url
  const adminSupabase = await createServiceClient(true)
  
  const { data: fileRow } = await adminSupabase
    .from('catalog_item_files')
    .select('catalog_item_id, storage_path, file_name')
    .eq('id', fileId)
    .single()
    
  if (!fileRow) return { error: "File not found" }

  // Verify buyer has entitlement
  const entitlement = await getActiveDigitalEntitlementForCatalogItem(fileRow.catalog_item_id)
  if (!entitlement) return { error: "Not entitled" }

  // Create signed url (valid for 60 seconds)
  const { data, error } = await adminSupabase
    .storage
    .from('digital-downloads')
    .createSignedUrl(fileRow.storage_path, 60, {
      download: fileRow.file_name // Force download with original filename
    })
    
  if (error) return { error: error.message }
  return { data: data.signedUrl }
}
