"use client"

import { useState, useEffect, useRef, useCallback } from 'react'

const API_CHAT_MESSAGE_ENDPOINT = '/api/agents/chat/message'

/**
 * Hook para rastrear peticiones API a endpoints específicos
 * Usado principalmente para determinar si hay peticiones pendientes a /agents/chat/message
 */
export function useApiRequestTracker() {
  const [hasActiveChatRequest, setHasActiveChatRequest] = useState(false)
  const pendingRequestsRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const updateRequestState = useCallback(() => {
    const hasActive = pendingRequestsRef.current > 0
    setHasActiveChatRequest(prev => {
      // Only update if the state actually changed
      return prev !== hasActive ? hasActive : prev
    })
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

      if (isChatMessageRequest) {
        pendingRequestsRef.current += 1
        updateRequestState()
        console.log(`[ApiTracker] ↗️ Iniciando petición a ${API_CHAT_MESSAGE_ENDPOINT}`)
      }

      try {
        // Continuar con la solicitud original
        const response = await originalFetch(url, init)
        return response
      } catch (error) {
        throw error
      } finally {
        // Decrementar el contador cuando la solicitud finaliza
        if (isChatMessageRequest) {
          pendingRequestsRef.current = Math.max(0, pendingRequestsRef.current - 1)
          console.log(`[ApiTracker] ↘️ Finalizando petición a ${API_CHAT_MESSAGE_ENDPOINT}`)
          
          // Clear any existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          
          // Update state with a small delay to avoid rapid state changes
          timeoutRef.current = setTimeout(() => {
            updateRequestState()
          }, 100)
        }
      }
    }

    // Reemplazar el fetch global con nuestro interceptor
    window.fetch = fetchInterceptor as typeof fetch

    // Limpiar al desmontar
    return () => {
      window.fetch = originalFetch
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [updateRequestState])

  return {
    hasActiveChatRequest
  }
} 