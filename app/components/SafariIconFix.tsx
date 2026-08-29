"use client"

import { useEffect } from "react"

function isSafariBrowser() {
  const ua = navigator.userAgent
  return (
    /AppleWebKit\/[\d.]+/.test(ua) &&
    /Version\/[\d.]+.*Safari/.test(ua) &&
    !/Chrome\/[\d.]+/.test(ua)
  )
}

export default function SafariIconFix() {
  useEffect(() => {
    if (!isSafariBrowser()) return
    document.documentElement.classList.add("safari")
  }, [])

  return null
}
