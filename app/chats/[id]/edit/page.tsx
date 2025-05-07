"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { toast } from "sonner"

export default function ChatEditPage() {
  const params = useParams()
  const router = useRouter()
  
  useEffect(() => {
    toast.info("Edit functionality coming soon")
    router.push(`/chats/${params.id}`)
  }, [params.id, router])
  
  return null
} 