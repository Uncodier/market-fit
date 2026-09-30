"use client"

import { Card, CardContent } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"

import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Send, FileText, Lock, UnlockKeyhole, Plus, X } from "@/app/components/ui/icons"

import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"

import { extractUrlsFromText } from "@/app/utils/url-cleaning"

import type { useTimeline } from "./useTimeline"
import { getFileIcon, formatFileSize } from "./timeline-presentation"
const detectUrlsInText = extractUrlsFromText
export function TimelineComposer(state: ReturnType<typeof useTimeline>) {
  const { newComment, setNewComment, isSubmitting, isPrivate, setIsPrivate, selectedFiles, fileInputRef, ctaTitle, setCtaTitle, ctaUrl, setCtaUrl, showCtaFields, setShowCtaFields, handleFileSelect, handleRemoveFile, handleSubmitComment } = state
  return (<>
      {/* Comment input */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            
            {/* Files preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(file.type)({ className: "h-4 w-4 text-muted-foreground" })}
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* CTA Fields */}
            {showCtaFields && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Call to Action</Label>
                    {detectUrlsInText(newComment).length > 0 && (
                      <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Auto-detected
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCtaFields(false)
                      setCtaTitle("")
                      setCtaUrl("")
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Button text (e.g., 'View Details', 'Download File')"
                    value={ctaTitle}
                    onChange={(e) => setCtaTitle(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="URL (e.g., https://example.com)"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    className="text-sm"
                  />
                </div>
                {detectUrlsInText(newComment).length > 1 && (
                  <div className="text-xs text-muted-foreground">
                    💡 Multiple URLs detected. Using the first one: {detectUrlsInText(newComment)[0]}
                  </div>
                )}
              </div>
            )}

          </div>
        </CardContent>
        
        <ActionFooter>
          {/* File attachment and CTA buttons */}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
              multiple
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText className="h-4 w-4 mr-2" />
              Attach Files
            </Button>
            {!showCtaFields && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCtaFields(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add CTA
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Private comment switch */}
            <div className="flex items-center gap-2">
              <Switch
                id="private-mode"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
              <Label htmlFor="private-mode" className="flex items-center gap-1.5 cursor-pointer">
                {isPrivate ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <UnlockKeyhole className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Private</span>
              </Label>
            </div>

            <Button
              onClick={handleSubmitComment}
              disabled={isSubmitting || !newComment.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Update Status
            </Button>
          </div>
        </ActionFooter>
      </Card>

  </>)
}
