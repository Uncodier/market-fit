"use client"

import { useState, useEffect, useRef, useCallback } from 'react'

const API_CHAT_MESSAGE_ENDPOINT = '/api/agents/chat/message'

/**
 * Hook para rastrear peticiones API a endpoints específicos
 * Usado principalmente para determinar si hay peticiones pendientes a /agents/chat/message
 * Ahora rastrea las peticiones por conversationId para evitar bloquear todos los chats
 */
export function useApiRequestTracker() {
  // Map to track pending requests per conversationId
  const pendingRequestsRef = useRef<Map<string, number>>(new Map())
  const [, forceUpdate] = useState(0)

  // Function to extract conversationId from request body
  const extractConversationId = useCallback((init?: RequestInit): string | null => {
    if (!init?.body) return null

    try {
      // If body is already a string (JSON), parse it
      if (typeof init.body === 'string') {
        const parsed = JSON.parse(init.body)
        return parsed.conversationId || null
      }
      
      // If body is a FormData, Blob, etc., we can't extract conversationId
      // For now, return null and handle it as a global request
      return null
    } catch (error) {
      // If parsing fails, return null
      console.warn('[ApiTracker] Failed to extract conversationId from request body:', error)
      return null
    }
  }, [])

  // Function to check if a specific conversation has active requests
  const hasActiveChatRequest = useCallback((conversationId: string | null | undefined): boolean => {
    if (!conversationId) return false
    const count = pendingRequestsRef.current.get(conversationId) || 0
    return count > 0
  }, [])

  // Force a re-render when pending requests change
  const triggerUpdate = useCallback(() => {
    forceUpdate(prev => prev + 1)
  }, [])

  useEffect(() => {
    // Objeto original de fetch
    const originalFetch = window.fetch

    // Función para interceptar las llamadas a fetch
    const fetchInterceptor = async (url: RequestInfo | URL, init?: RequestInit) => {
      // Convertir URL a string si es necesario
      const urlString = url instanceof Request ? url.url : url.toString()

      // Verificar si es una solicitud a /agents/chat/message
      const isChatMessageRequest = urlString.includes(API_CHAT_MESSAGE_ENDPOINT)

      let conversationId: string | null = null

      if (isChatMessageRequest) {
        // Extract conversationId from request body
        conversationId = extractConversationId(init)
        
        if (conversationId) {
          // Increment count for this specific conversation
          const currentCount = pendingRequestsRef.current.get(conversationId) || 0
          pendingRequestsRef.current.set(conversationId, currentCount + 1)
          triggerUpdate()
          console.log(`[ApiTracker] ↗️ Iniciando petición para conversationId: ${conversationId}`)
        } else {
          // If we can't extract conversationId, log a warning but don't track it
          console.warn(`[ApiTracker] ⚠️ No se pudo extraer conversationId de la petición`)
        }
      }

      try {
        // Continuar con la solicitud original
        const response = await originalFetch(url, init)
        return response
      } catch (error) {
        throw error
      } finally {
        // Decrementar el contador cuando la solicitud finaliza
        if (isChatMessageRequest && conversationId) {
          const currentCount = pendingRequestsRef.current.get(conversationId) || 0
          const newCount = Math.max(0, currentCount - 1)
          
          if (newCount === 0) {
            pendingRequestsRef.current.delete(conversationId)
          } else {
            pendingRequestsRef.current.set(conversationId, newCount)
          }
          
          triggerUpdate()
          console.log(`[ApiTracker] ↘️ Finalizando petición para conversationId: ${conversationId}`)
        }
      }
    }

    // Reemplazar el fetch global con nuestro interceptor
    window.fetch = fetchInterceptor as typeof fetch

    // Limpiar al desmontar
    return () => {
      window.fetch = originalFetch
      pendingRequestsRef.current.clear()
    }
  }, [extractConversationId, triggerUpdate])

  return {
    hasActiveChatRequest
  }
} 