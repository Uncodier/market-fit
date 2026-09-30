"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

import { Task, TaskComment } from "@/app/types"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"

import { File } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"

import { getUserData } from "@/app/services/user-service"

import { extractUrlsFromText, generateTitleFromUrl } from "@/app/utils/url-cleaning"

import type { FileUpload } from "./timeline-presentation"

export function useTimeline(task: Task | null) {
  const router = useRouter()
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentUserData, setCurrentUserData] = useState<{ name: string, avatar_url: string | null } | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null)
  const [assigneeData, setAssigneeData] = useState<{ name: string, avatar_url: string | null } | null>(null)
  // CTA state
  const [ctaTitle, setCtaTitle] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [showCtaFields, setShowCtaFields] = useState(false)

  // Fetch current user data
  useEffect(() => {
    const fetchCurrentUserData = async () => {
      if (!user) return
      const userData = await getUserData(user.id)
      setCurrentUserData(userData)
    }

    fetchCurrentUserData()
  }, [user])

  // Fetch assignee data
  useEffect(() => {
    const fetchAssigneeData = async () => {
      if (!task?.assignee) return
      const userData = await getUserData(task.assignee)
      setAssigneeData(userData)
    }

    fetchAssigneeData()
  }, [task?.assignee])

  // Fetch comments with user data
  useEffect(() => {
    const fetchComments = async () => {
      if (!task || !currentSite) return

      setIsLoading(true)
      const supabase = createClient()

      try {
        // Get comments
        const { data: commentsData, error: commentsError } = await supabase
          .from('task_comments')
          .select('*')
          .eq('task_id', task.id)
          .order('created_at', { ascending: false })

        if (commentsError) throw commentsError

        // Enrich comments with user data
        const enrichedComments = await Promise.all(
          commentsData.map(async (comment) => {
            const userData = await getUserData(comment.user_id)
            return {
              ...comment,
              cta: comment.cta ?? undefined,
              profiles: userData ? {
                id: comment.user_id,
                name: userData.name,
                avatar_url: userData.avatar_url ?? undefined
              } : undefined
            }
          })
        )

        setComments(enrichedComments)
      } catch (error) {
        console.error('Error fetching comments:', error)
        toast.error("Failed to load comments")
      } finally {
        setIsLoading(false)
      }
    }

    fetchComments()
  }, [task, currentSite])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async (taskId: string): Promise<FileUpload[]> => {
    const supabase = createClient()
    const uploadPromises = selectedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop()
      const fileName = `${taskId}/${Date.now()}.${fileExt}`
      const { data, error } = await supabase.storage
        .from('task_files')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('task_files')
        .getPublicUrl(fileName)

      return {
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type
      }
    })

    return Promise.all(uploadPromises)
  }

  const handleSubmitComment = async () => {
    if (!task || !currentSite || !newComment.trim() || !user) return

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      // 1. Get user data
      const userData = await getUserData(user.id)

      // 2. Upload files if any
      const files: FileUpload[] = []
      if (selectedFiles.length > 0) {
        const uploadedFiles = await uploadFiles(task.id)
        files.push(...uploadedFiles)
      }

      // 3. Create CTA object if both fields are provided
      const cta = (ctaTitle.trim() && ctaUrl.trim()) ? {
        primary_action: {
          title: ctaTitle.trim(),
          url: ctaUrl.trim()
        }
      } : null

      // 4. Create comment
      const { data: comment, error: commentError } = await supabase
        .from('task_comments')
        .insert({
          task_id: task.id,
          user_id: user.id,
          content: newComment.trim(),
          attachments: [],
          is_private: isPrivate,
          files,
          cta
        })
        .select('*')
        .single()

      if (commentError) throw commentError

      // 4. Add user data to comment
      const enrichedComment = {
        ...comment,
              cta: comment.cta ?? undefined,
        profiles: userData ? {
          id: user.id,
          name: userData.name,
          avatar_url: userData.avatar_url ?? undefined
        } : undefined
      }

      setComments([enrichedComment, ...comments])
      setNewComment("")
      setSelectedFiles([])
      setIsPrivate(false)
      setCtaTitle("")
      setCtaUrl("")
      setShowCtaFields(false)

      // 5. Call external API for public comments
      if (!isPrivate && task.lead_id) {
        try {
          const { apiClient } = await import('@/app/services/api-client-service')
          
          await apiClient.post('/api/notifications/taskStatus', {
            message: newComment.trim(),
            lead_id: task.lead_id,
            task_id: task.id,
            site_id: currentSite.id
          })
        } catch (apiError) {
          console.error('Error calling task status notification API:', apiError)
          // Don't throw error here as the comment was already saved successfully
        }
      }

      toast.success("Comment added successfully")
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error("Failed to add comment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!currentSite) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId)

      if (error) throw error

      setComments(comments.filter(c => c.id !== commentId))
      toast.success("Comment deleted successfully")
    } catch (error) {
      console.error('Error deleting comment:', error)
      toast.error("Failed to delete comment")
    }
  }

  const handleEditComment = async (commentId: string) => {
    if (!currentSite) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('task_comments')
        .update({ content: editingContent })
        .eq('id', commentId)

      if (error) throw error

      setComments(comments.map(c => 
        c.id === commentId 
          ? { ...c, content: editingContent }
          : c
      ))
      setEditingCommentId(null)
      setEditingContent("")
      toast.success("Comment updated successfully")
    } catch (error) {
      console.error('Error updating comment:', error)
      toast.error("Failed to update comment")
    }
  }

  const startEditing = (comment: TaskComment) => {
    setEditingCommentId(comment.id)
    setEditingContent(comment.content)
  }

  const cancelEditing = () => {
    setEditingCommentId(null)
    setEditingContent("")
  }

  const handleResendNotification = async (comment: TaskComment) => {
    if (!currentSite || !task?.lead_id || comment.is_private) {
      toast.error("Cannot resend notification for private comments or tasks without leads")
      return
    }

    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      await apiClient.post('/api/notifications/taskStatus', {
        message: comment.content,
        lead_id: task.lead_id,
        task_id: task.id,
        site_id: currentSite.id
      })

      toast.success("Notification resent successfully")
    } catch (error) {
      console.error('Error resending notification:', error)
      toast.error("Failed to resend notification")
    }
  }

  const handleSendReminder = async (comment: TaskComment) => {
    if (!currentSite || !task?.lead_id || comment.is_private) {
      toast.error("Cannot send reminder for private comments or tasks without leads")
      return
    }

    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      await apiClient.post('/api/notifications/taskCommentReminder', {
        message: comment.content,
        lead_id: task.lead_id,
        task_id: task.id,
        site_id: currentSite.id
      })

      toast.success("Reminder sent successfully")
    } catch (error) {
      console.error('Error sending reminder:', error)
      toast.error("Failed to send reminder")
    }
  }

  // Use the imported URL detection function
  const detectUrlsInText = extractUrlsFromText

  // Auto-detect URLs in comment and populate CTA
  useEffect(() => {
    // Debounce the URL detection to avoid issues while typing
    const timeoutId = setTimeout(() => {
      if (!newComment.trim()) {
        // Only auto-close CTA if it was auto-populated (has URL but user cleared comment)
        // Don't close if user manually opened CTA fields
        if (showCtaFields && ctaUrl.trim() && !ctaTitle && !newComment.trim()) {
          // If CTA was auto-populated but comment was cleared, clean up
          setCtaUrl("")
          setCtaTitle("")
          setShowCtaFields(false)
        }
        return
      }

      const urls = detectUrlsInText(newComment)
      console.log('Detected URLs:', urls) // Debug log
      console.log('Original comment text:', newComment) // Debug log
      
      if (urls.length > 0 && !ctaUrl.trim()) {
        // Only auto-populate if CTA URL is empty to avoid overwriting user input
        const firstUrl = urls[0]
        if (firstUrl && firstUrl.length > 10) { // Ensure it's a reasonable URL
          const suggestedTitle = generateTitleFromUrl(firstUrl)
          
          setCtaUrl(firstUrl)
          setCtaTitle(suggestedTitle)
          setShowCtaFields(true)
        }
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [newComment, ctaUrl, ctaTitle, showCtaFields])

  return { router, user, comments, isLoading, newComment, setNewComment, isSubmitting, isPrivate, setIsPrivate, selectedFiles, fileInputRef, currentUserData, editingCommentId, editingContent, setEditingContent, commentToDelete, setCommentToDelete, assigneeData, ctaTitle, setCtaTitle, ctaUrl, setCtaUrl, showCtaFields, setShowCtaFields, handleFileSelect, handleRemoveFile, handleSubmitComment, handleDeleteComment, handleEditComment, startEditing, cancelEditing, handleResendNotification, handleSendReminder }
}
