"use client"

import { createContext, useState, useContext, ReactNode } from 'react'

type AnalyzeContextType = {
  showAnalyzeButton: boolean
  setShowAnalyzeButton: (show: boolean) => void
}

const AnalyzeContext = createContext<AnalyzeContextType>({
  showAnalyzeButton: false,
  setShowAnalyzeButton: () => {},
})

export const AnalyzeProvider = ({ children }: { children: ReactNode }) => {
  const [showAnalyzeButton, setShowAnalyzeButton] = useState(false)

  return (
    <AnalyzeContext.Provider value={{ showAnalyzeButton, setShowAnalyzeButton }}>
      {children}
    </AnalyzeContext.Provider>
  )
}

export const useAnalyze = () => useContext(AnalyzeContext) 