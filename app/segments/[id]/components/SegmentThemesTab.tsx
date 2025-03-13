import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { FileText, Copy } from "@/app/components/ui/icons"
import { Segment, getHotTopics } from "../page"

interface SegmentThemesTabProps {
  segment: Segment
}

export function SegmentThemesTab({ segment }: SegmentThemesTabProps) {
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({})

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStates(prev => ({
        ...prev,
        [id]: true
      }))
      setTimeout(() => {
        setCopyStates(prev => ({
          ...prev,
          [id]: false
        }))
      }, 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="border-none shadow-sm">
        <CardHeader className="px-6 pb-2">
          <CardTitle className="text-lg">Blog Ideas</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-4">
            {getHotTopics(segment, 'blog').length > 0 ? (
              getHotTopics(segment, 'blog').map((topic, idx) => (
                <div key={idx} className="bg-muted/30 p-3 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary rounded-full p-1 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{topic}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="sm" className="h-7 rounded-full text-xs">
                          Use Topic
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 rounded-full text-xs text-muted-foreground"
                          onClick={() => copyToClipboard(topic, `blog-${idx}`)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copyStates[`blog-${idx}`] ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No blog topics available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-none shadow-sm">
        <CardHeader className="px-6 pb-2">
          <CardTitle className="text-lg">Newsletter Content</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-4">
            {getHotTopics(segment, 'newsletter').length > 0 ? (
              getHotTopics(segment, 'newsletter').map((topic, idx) => (
                <div key={idx} className="bg-muted/30 p-3 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary rounded-full p-1 mt-0.5">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{topic}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="sm" className="h-7 rounded-full text-xs">
                          Use Topic
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 rounded-full text-xs text-muted-foreground"
                          onClick={() => copyToClipboard(topic, `newsletter-${idx}`)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          {copyStates[`newsletter-${idx}`] ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No newsletter topics available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 