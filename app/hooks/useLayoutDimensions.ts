import { useMemo } from 'react'

interface LayoutDimensionsProps {
  isLayoutCollapsed: boolean
  isChatListCollapsed: boolean
}

interface LayoutDimensions {
  sidebarWidth: number
  chatListWidth: number
  totalLeftOffset: number
  containerStyle: {
    left: string
    right: string
    maxWidth: string
  }
}

export function useLayoutDimensions({ 
  isLayoutCollapsed, 
  isChatListCollapsed 
}: LayoutDimensionsProps): LayoutDimensions {
  
  return useMemo(() => {
    const sidebarWidth = isLayoutCollapsed ? 64 : 256
    const chatListWidth = isChatListCollapsed ? 0 : 319
    const totalLeftOffset = sidebarWidth + chatListWidth
    
    return {
      sidebarWidth,
      chatListWidth,
      totalLeftOffset,
      containerStyle: {
        left: `${totalLeftOffset}px`,
        right: '0px',
        maxWidth: `calc(100vw - ${totalLeftOffset}px)`
      }
    }
  }, [isLayoutCollapsed, isChatListCollapsed])
} 