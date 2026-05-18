'use client'

import { useState, useEffect } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Estado para guardar nuestro valor
  // Pasamos la función de estado inicial a useState para que la lógica
  // se ejecute solo una vez
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      // Obtenemos del local storage por key
      const item = window.localStorage.getItem(key)
      // Parseamos JSON o si es null retornamos initialValue
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      // Si hay error también retornamos initialValue
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Retornamos una versión de setValue envuelta que persistirá
  // la nueva función de estado
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Permitimos que el valor sea una función para que tengamos 
      // el mismo API que useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      
      // Guardamos el estado
      setStoredValue(valueToStore)
      
      // Guardamos en local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      // Un error más avanzado se manejaría aquí
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }

  // Sincronizar cambios entre diferentes pestañas/ventanas
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch (error) {
          console.warn(`Error parsing localStorage key "${key}" on storage event:`, error)
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    }
  }, [key])

  return [storedValue, setValue]
}
