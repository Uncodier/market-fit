"use client"

import { useEffect } from "react"

const MUSEO_HREF =
  "https://fonts.googleapis.com/css2?family=Museo+Moderno:wght@400;600;700&display=swap"

export default function MuseoFont() {
  useEffect(() => {
    const existing = document.querySelector(`link[href="${MUSEO_HREF}"]`) as HTMLLinkElement | null
    if (existing) {
      if (existing.media === "all" || existing.sheet) {
        document.documentElement.classList.add("museo-ready")
      }
      return
    }

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = MUSEO_HREF
    link.media = "print"
    link.onload = () => {
      link.media = "all"
      document.documentElement.classList.add("museo-ready")
    }
    document.head.appendChild(link)
  }, [])

  return null
}
