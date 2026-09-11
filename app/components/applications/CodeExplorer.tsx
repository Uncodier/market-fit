"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Skeleton } from "@/app/components/ui/skeleton"
import dynamic from "next/dynamic"

const ZipViewer = dynamic(
  () => import("@/app/components/simple-messages-view/components/ZipViewer").then((m) => m.ZipViewer),
  { ssr: false }
)

export function CodeExplorer({ requirementId }: { requirementId: string }) {
  const searchParams = useSearchParams()
  const name = searchParams.get('name') || "Code Details"
  
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    
    async function fetchUrl() {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('requirement_status')
        .select('source_code, repo_url')
        .eq('requirement_id', requirementId)
        .order('created_at', { ascending: false })
      
      if (error) {
        if (!cancelled) {
          setError(error.message)
          setLoading(false)
        }
        return
      }
      
      if (!cancelled) {
        if (data && data.length > 0) {
          // find the first one that has source_code or zip repo_url
          let found = null
          for (const row of data) {
            if (row.source_code) {
              found = row.source_code
              break
            }
            if (row.repo_url && (row.repo_url.endsWith('.zip') || row.repo_url.includes('.zip?'))) {
              found = row.repo_url
              break
            }
          }
          
          if (found) {
            setUrl(found)
          } else {
            setError("No zip file found for this code repository.")
          }
        } else {
          setError("Code details not found.")
        }
        setLoading(false)
      }
    }
    
    fetchUrl()
    
    return () => { cancelled = true }
  }, [requirementId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4">
        <Skeleton className="w-full h-full rounded-md" />
      </div>
    )
  }
  
  if (error || !url) {
    return (
      <div className="flex items-center justify-center w-full h-full text-muted-foreground p-4">
        {error || "Unknown error"}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col w-full h-full bg-background overflow-hidden">
      <ZipViewer url={url} className="w-full h-full" />
    </div>
  )
}
