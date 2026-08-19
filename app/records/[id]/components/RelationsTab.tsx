import React, { useEffect, useState } from "react"
import { LinkIcon, FileText } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { getVectorRelatedRecords } from "../../actions"
import Link from "next/link"
import { Skeleton } from "@/app/components/ui/skeleton"

interface RelationsTabProps {
  fields: any[]
  relationsData: Record<string, any>
  recordId: string
}

export function RelationsTab({ recordId }: RelationsTabProps) {
  const [relatedRecords, setRelatedRecords] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (recordId) {
      loadRelatedRecords()
    }
  }, [recordId])

  const loadRelatedRecords = async () => {
    setIsLoading(true)
    const { records, error } = await getVectorRelatedRecords(recordId)
    if (!error && records) {
      setRelatedRecords(records)
    } else {
      setRelatedRecords([])
    }
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 border border-border/50 bg-muted/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : relatedRecords.length > 0 ? (
        <div className="space-y-3">
          {relatedRecords.map(rel => (
            <Link key={rel.id} href={`/records/${rel.id}`}>
              <div className="p-3 border border-border/50 bg-muted/20 rounded-lg flex items-center justify-between group hover:bg-muted/40 transition-colors mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-background border flex items-center justify-center text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{rel.title || 'Untitled'}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {rel.category_name || 'Record'} • {Math.round(rel.similarity * 100)}% match
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          No related records found.
        </div>
      )}
    </div>
  )
}
