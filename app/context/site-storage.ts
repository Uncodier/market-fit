"use client"

import { persistCurrentSiteCookie } from "@/lib/auth/current-site-cookie"

function cleanUUID(id: string | null): string | null {
  if (!id) return null
  
  // Eliminar comillas extras si existen
  let cleaned = id.replace(/["']/g, '')
  
  // Verificar el formato básico de UUID después de limpiar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned
  }
  
  // Caso especial para "default" u otros valores especiales
  if (cleaned === "default") return cleaned
  
  console.warn("UUID inválido después de limpieza:", id, "->", cleaned)
  return null
}

// Función segura para acceder a localStorage
function getLocalStorage(key: string, defaultValue: any = null) {
  if (typeof window === 'undefined') return defaultValue
  
  try {
    const rawValue = localStorage.getItem(key)
    if (rawValue === null) return defaultValue
    
    // Manejar acceso directo para UUIDs y otros IDs para evitar errores de JSON.parse
    if (key.toLowerCase().includes('id')) {
      // Para IDs, devolver directamente el valor sin parsear
      if (key === 'currentSiteId') {
        
        // Si es un UUID, intentar limpiarlo
        const cleanedValue = cleanUUID(rawValue)
        
        if (cleanedValue && cleanedValue !== rawValue) {
          // Si el valor limpio es diferente, actualizar localStorage
          try {
            localStorage.setItem(key, cleanedValue)
          } catch (e) {
            console.error(`Error al corregir UUID en localStorage:`, e)
          }
          return cleanedValue
        }
        
        return rawValue
      }
    }
    
    // Para otros valores, intentar parsear como JSON, pero con manejo de errores
    try {
      return JSON.parse(rawValue)
    } catch (jsonError) {
      console.warn(`Valor en localStorage para "${key}" no es JSON válido, usando como texto plano:`, rawValue)
      return rawValue
    }
  } catch (e) {
    console.error(`Error al leer localStorage key "${key}":`, e)
    return defaultValue
  }
}

// Función segura para guardar en localStorage
function setLocalStorage(key: string, value: any) {
  if (typeof window === 'undefined') return
  
  try {
    // Caso especial para currentSiteId - siempre guardar como string plano
    if (key === 'currentSiteId') {
      let valueToStore = value
      
      // Si es un string, intentar limpiarlo de comillas si es un UUID
      if (typeof value === 'string') {
        const cleanedValue = cleanUUID(value)
        if (cleanedValue) {
          valueToStore = cleanedValue
        }
      }
      
      localStorage.setItem(key, valueToStore)
      persistCurrentSiteCookie(String(valueToStore))
      return
    }
    
    // Para otros IDs, también guardar como string plano si es un UUID
    if (key.toLowerCase().includes('id') && typeof value === 'string') {
      const cleanedValue = cleanUUID(value)
      if (cleanedValue) {
        localStorage.setItem(key, cleanedValue)
        return
      }
    }
    
    // Para objetos y arrays, usar JSON.stringify
    if (typeof value === 'object' && value !== null) {
      localStorage.setItem(key, JSON.stringify(value))
      return
    }
    
    // Para valores simples (string, number, boolean), guardar directamente
    localStorage.setItem(key, String(value))
  } catch (e) {
    console.error(`Error al guardar en localStorage key "${key}":`, e)
  }
}

export { cleanUUID, getLocalStorage, setLocalStorage }
