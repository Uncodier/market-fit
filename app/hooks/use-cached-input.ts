import { useLocalStorage } from './use-local-storage'
import { ChangeEvent, useCallback } from 'react'

/**
 * Hook para guardar automáticamente en cache el valor de un input/textarea
 * 
 * @param id Identificador único para el cache en localStorage
 * @param initialValue Valor inicial si no hay nada en cache
 * @returns [value, onChange, setValue] 
 */
export function useCachedInput(id: string, initialValue: string = '') {
  const cacheKey = `input-cache-${id}`
  const [value, setValue] = useLocalStorage<string>(cacheKey, initialValue)

  const onChange = useCallback((
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | string
  ) => {
    if (typeof e === 'string') {
      setValue(e)
    } else {
      setValue(e.target.value)
    }
  }, [setValue])

  const clearCache = useCallback(() => {
    setValue(initialValue)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(cacheKey)
    }
  }, [initialValue, setValue, cacheKey])

  return {
    value,
    onChange,
    setValue,
    clearCache,
    // Propiedades convenientes para hacer spread directamente en el input
    inputProps: {
      value,
      onChange
    }
  }
}
