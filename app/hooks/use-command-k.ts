import { useEffect } from "react"

/**
 * Hook para manejar el atajo de teclado Command/Ctrl + K
 * Enfoca automáticamente el input de búsqueda cuando se presiona
 */
export function useCommandK(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        const searchInput = document.querySelector('[data-command-k-input]') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])
} 