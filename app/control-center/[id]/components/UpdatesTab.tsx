"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Task, TaskComment } from "@/app/types"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Send } from "@/app/components/ui/icons"
import { toast } from "sonner"

interface UpdatesTabProps {
  task: Task | null
}

export default function UpdatesTab({ task }: UpdatesTabProps) {
  const { currentSite } = useSite()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchComments = async () => {
      if (!task || !currentSite) return

      setIsLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          user:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching comments:', error)
        setIsLoading(false)
        return
      }

      setComments(data || [])
      setIsLoading(false)
    }

    fetchComments()
  }, [task, currentSite])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  const handleSubmitComment = async () => {
    if (!task || !currentSite || !newComment.trim()) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      const { data: comment, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: task.id,
          content: newComment.trim(),
          attachments: []
        })
        .select(`
          *,
          user:user_id (
            id,
            name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      setComments([comment, ...comments])
      setNewComment("")
      toast.success("Comment added successfully")
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error("Failed to add comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitComment}
                disabled={isSubmitting || !newComment.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Comment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No comments yet
            </CardContent>
          </Card>
        ) : (
          comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Avatar>
                    {comment.user?.avatar_url ? (
                      <AvatarImage src={comment.user.avatar_url} alt={comment.user.name} />
                    ) : (
                      <AvatarFallback>
                        {comment.user?.name ? getInitials(comment.user.name) : 'U'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {comment.user?.name}
                    </p>
                    <p className="text-sm">
                      {comment.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(comment.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
} 