"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Task, TaskComment } from "@/app/types"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Send, User, FileText, Lock, UnlockKeyhole, Image as ImageIcon, File, Code, MoreHorizontal, Pencil, Trash2 } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { Switch } from "@/app/components/ui/switch"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { getUserData } from "@/app/services/user-service"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"

interface TimelineTabProps {
  task: Task | null
}

interface FileUpload {
  name: string
  url: string
  size: number
  type: string
}

// Helper function to get file icon based on type
const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon
  if (type === 'application/pdf') return File
  if (type.includes('code') || type.includes('json') || type.includes('text')) return Code
  return FileText
}

// Helper function to format file size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Helper function to check if file is previewable
const isPreviewable = (type: string) => {
  return type.startsWith('image/') || type === 'application/pdf'
}

export default function TimelineTab({ task }: TimelineTabProps) {
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
              profiles: userData ? {
                id: comment.user_id,
                name: userData.name,
                avatar_url: userData.avatar_url
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

      // 3. Create comment
      const { data: comment, error: commentError } = await supabase
        .from('task_comments')
        .insert({
          task_id: task.id,
          user_id: user.id,
          content: newComment.trim(),
          attachments: [],
          is_private: isPrivate,
          files
        })
        .select('*')
        .single()

      if (commentError) throw commentError

      // 4. Add user data to comment
      const enrichedComment = {
        ...comment,
        profiles: userData ? {
          id: user.id,
          name: userData.name,
          avatar_url: userData.avatar_url
        } : undefined
      }

      setComments([enrichedComment, ...comments])
      setNewComment("")
      setSelectedFiles([])
      setIsPrivate(false)
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

  // Function to render file preview
  const renderFilePreview = (file: FileUpload) => {
    if (file.type.startsWith('image/')) {
      return (
        <div className="relative w-full rounded-md overflow-hidden bg-muted">
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-auto max-h-[400px] object-contain mx-auto"
            loading="lazy"
          />
        </div>
      )
    }
    if (file.type === 'application/pdf') {
      return (
        <iframe
          src={file.url}
          className="w-full aspect-[4/3] rounded-md border"
          title={file.name}
        />
      )
    }
    return null
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Comment input skeleton */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="h-[100px] w-full bg-muted animate-pulse rounded-md" />
              <div className="flex items-center justify-between">
                <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
                <div className="flex items-center gap-4">
                  <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
                  <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments list skeleton */}
        <div className="space-y-4">
          {/* Comment with image */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                </div>
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-48 w-full bg-muted animate-pulse rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* Comment with text only */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task description skeleton */}
          <Card className="mt-8 bg-muted/50">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex -space-x-2">
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse ring-2 ring-background" />
                  <div className="h-10 w-10 rounded-full bg-muted animate-pulse ring-2 ring-background" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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

            <div className="flex items-center justify-between">
              {/* File attachment button */}
              <div>
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
            <Card key={comment.id} className="overflow-hidden">
              {/* Header */}
              <div className="p-4 flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    {comment.profiles?.avatar_url ? (
                      <AvatarImage 
                        src={comment.profiles.avatar_url} 
                        alt={comment.profiles.name || 'User avatar'} 
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="text-sm">
                        {comment.profiles?.name ? 
                          getInitials(comment.profiles.name) : 
                          'U'
                        }
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <div className="flex items-center">
                      <p className="text-sm font-semibold">
                        {comment.profiles?.name || 'Usuario'}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(comment.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {comment.is_private && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center text-xs bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                            <Lock className="h-3 w-3 mr-1" />
                            Private
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Neither the lead nor the agents have access to this information</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {user && comment.user_id === user.id ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem 
                          className="text-sm cursor-pointer"
                          onClick={() => startEditing(comment)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-sm cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => setCommentToDelete(comment.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>

              {/* Content */}
              {comment.content && (
                <div className="px-4 pb-4">
                  {editingCommentId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="min-h-[100px] resize-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEditing}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEditComment(comment.id)}
                          disabled={!editingContent.trim() || editingContent === comment.content}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                </div>
              )}

              {/* Files */}
              {comment.files && comment.files.length > 0 && (
                <div>
                  {/* Grid for multiple images */}
                  {comment.files.length > 1 && comment.files.every(file => file.type.startsWith('image/')) ? (
                    <div className={cn(
                      'grid gap-[2px]',
                      comment.files.length === 2 && 'grid-cols-2',
                      comment.files.length === 3 && 'grid-cols-2',
                      comment.files.length >= 4 && 'grid-cols-2'
                    )}>
                      {comment.files.map((file, index) => (
                        <div 
                          key={index} 
                          className={cn(
                            'relative bg-muted',
                            comment.files.length === 3 && index === 0 && 'col-span-2',
                            comment.files.length > 4 && index >= 4 && 'hidden'
                          )}
                        >
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-full object-cover aspect-square"
                            loading="lazy"
                          />
                          {comment.files.length > 4 && index === 3 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-white text-lg font-medium">
                                +{comment.files.length - 4}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Single file or non-image files
                    comment.files.map((file, index) => (
                      <div key={index}>
                        {/* Image/PDF preview */}
                        {isPreviewable(file.type) && (
                          <div className="relative">
                            {file.type.startsWith('image/') ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-auto"
                                loading="lazy"
                              />
                            ) : (
                              <iframe
                                src={file.url}
                                className="w-full aspect-[4/3]"
                                title={file.name}
                              />
                            )}
                          </div>
                        )}
                        
                        {/* File info - only show for non-images or single files */}
                        {(!file.type.startsWith('image/') || comment.files.length === 1) && (
                          <div className="px-4 py-3 bg-muted/50">
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {getFileIcon(file.type)({ className: "h-3 w-3" })}
                              <span className="truncate">{file.name}</span>
                              <span className="flex-shrink-0">({formatFileSize(file.size)})</span>
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))
        )}

        {/* Task Description Card */}
        <Card className="mt-8 bg-muted/50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex -space-x-2">
                {task?.leads && (
                  <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
                    <AvatarFallback className="text-sm bg-primary/10">
                      {getInitials(task.leads.name)}
                    </AvatarFallback>
                  </Avatar>
                )}
                {task?.assignee && assigneeData && (
                  <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
                    {assigneeData.avatar_url ? (
                      <AvatarImage 
                        src={assigneeData.avatar_url} 
                        alt={assigneeData.name} 
                        className="object-cover"
                      />
                    ) : (
                      <AvatarFallback className="text-sm">
                        {getInitials(assigneeData.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-base font-semibold mb-2">{task?.title}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium leading-none">
                    {task?.leads?.name || 'Lead'}
                  </p>
                  <span className="text-muted-foreground text-sm">•</span>
                  <p className="text-sm text-muted-foreground">
                    Task assigned to {assigneeData?.name || 'Unassigned'}
                  </p>
                </div>
                {task?.description && (
                  <p className="text-sm mt-4 text-foreground">
                    {task.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDate(task?.created_at || new Date().toISOString())}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!commentToDelete} onOpenChange={() => setCommentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (commentToDelete) {
                  handleDeleteComment(commentToDelete)
                  setCommentToDelete(null)
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 