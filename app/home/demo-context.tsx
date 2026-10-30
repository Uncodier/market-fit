'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { isDemoModeActive } from '@/lib/demo-utils'

const DemoContext = createContext(false)
const subscribe = () => () => {}
export function usePortalDemo() {
  const serverDemo = useContext(DemoContext)
  const browserDemo = useSyncExternalStore(subscribe, isDemoModeActive, () => false)
  return serverDemo || browserDemo
}
export function PortalDemoProvider({ demo, children }: { demo: boolean; children: ReactNode }) {
  return <DemoContext.Provider value={demo}>{children}</DemoContext.Provider>
}