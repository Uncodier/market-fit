"use client"

import { useState, useEffect } from 'react'

const API_CHAT_MESSAGE_ENDPOINT = '/api/agents/chat/message'

/**
 * Hook para rastrear peticiones API a endpoints específicos
 * Usado principalmente para determinar si hay peticiones pendientes a /agents/chat/message
 */
export function useApiRequestTracker() {
  const [pendingChatRequests, setPendingChatRequests] = useState(0)
  const [isAgentChatRequest, setIsAgentChatRequest] = useState(false)

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
        setIsAgentChatRequest(true)
        setPendingChatRequests(prev => prev + 1)
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
          setPendingChatRequests(prev => Math.max(0, prev - 1))
          console.log(`[ApiTracker] ↘️ Finalizando petición a ${API_CHAT_MESSAGE_ENDPOINT}`)
          
          // Si no hay más peticiones pendientes, limpiar el estado
          setTimeout(() => {
            if (pendingChatRequests <= 1) {
              setIsAgentChatRequest(false)
            }
          }, 300)
        }
      }
    }

    // Reemplazar el fetch global con nuestro interceptor
    window.fetch = fetchInterceptor as typeof fetch

    // Limpiar al desmontar
    return () => {
      window.fetch = originalFetch
    }
  }, [pendingChatRequests])

  return {
    hasActiveChatRequest: pendingChatRequests > 0 && isAgentChatRequest
  }
} 