"use client"

import { useEffect } from 'react'

export default function LoggerInit() {
  useEffect(() => {
    // Import and initialize the logging system only on client side
    import('../../lib/init').then(() => {
      // The init file auto-initializes when imported
    }).catch(error => {
      console.error('Failed to initialize logging system:', error)
    })
  }, [])

  return null // This component doesn't render anything
} 