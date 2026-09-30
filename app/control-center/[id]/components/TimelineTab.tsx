"use client"

import { Card, CardContent } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Task } from "@/app/types"

import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Lock, MoreHorizontal, Pencil, Trash2, MessageSquare, Bell, ExternalLink, Clock } from "@/app/components/ui/icons"

import { navigateToLead } from "@/lib/navigation/navigation-helpers"
import { cn } from "@/lib/utils"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { EmptyCard } from "@/app/components/ui/empty-card"

import { useTimeline } from "./useTimeline"
import { TimelineComposer } from "./TimelineComposer"
import { TimelineSkeleton } from "./TimelineSkeleton"
import { formatDate, getInitials, getFileIcon, formatFileSize, isPreviewable } from "./timeline-presentation"

export default function TimelineTab({ task }: { task: Task | null }) {
  const state = useTimeline(task)
  const { router, user, comments, isLoading, editingCommentId, editingContent, setEditingContent, commentToDelete, setCommentToDelete, assigneeData, handleDeleteComment, handleEditComment, startEditing, cancelEditing, handleResendNotification, handleSendReminder } = state
  if (isLoading) return <TimelineSkeleton />

  return (
    <div className="space-y-6">
      <TimelineComposer {...state} />
      {/* Comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <EmptyCard
            icon={<MessageSquare />}
            title="No updates yet"
            description="Start the conversation by adding your first update or comment about this task."
            variant="fancy"
          />
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
                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuItem 
                          className="text-sm cursor-pointer"
                          onClick={() => startEditing(comment)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {!comment.is_private && task?.lead_id && (
                          <DropdownMenuItem 
                            className="text-sm cursor-pointer"
                            onClick={() => handleResendNotification(comment)}
                          >
                            <Bell className="mr-2 h-4 w-4" />
                            Resend Notification
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
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

                            {/* CTA Footer */}
              {comment.cta && comment.cta.primary_action && (
                <ActionFooter>
                  <div className="flex items-center justify-end gap-2">
                    {!comment.is_private && task?.lead_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendReminder(comment)}
                        className="gap-2"
                      >
                        <Clock className="h-4 w-4" />
                        Send Reminder
                      </Button>
                    )}
                    <a
                      href={comment.cta.primary_action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      {comment.cta.primary_action.title}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </ActionFooter>
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
                  <Avatar 
                    className="h-10 w-10 shrink-0 ring-2 ring-background cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (task?.leads?.id && task?.leads?.name) {
                        navigateToLead({
                          leadId: task.leads.id,
                          leadName: task.leads.name,
                          router
                        })
                      }
                    }}
                  >
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
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-semibold">{task?.title}</h3>
                  {task?.serial_id && (
                    <div className="font-mono text-xs text-muted-foreground bg-background px-2 py-1 rounded border">
                      {task.serial_id}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      if (task?.leads?.id && task?.leads?.name) {
                        navigateToLead({
                          leadId: task.leads.id,
                          leadName: task.leads.name,
                          router
                        })
                      }
                    }}
                    className="text-sm font-medium leading-none hover:text-primary transition-colors cursor-pointer"
                  >
                    {task?.leads?.name || 'Lead'}
                  </button>
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
              className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
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