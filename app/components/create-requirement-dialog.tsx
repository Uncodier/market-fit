import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { 
  PlusCircle, 
  FileText, 
  Users, 
  XCircle, 
  ClipboardList, 
  Tag,
  CheckCircle2,
  Archive,
  MessageSquare
} from "@/app/components/ui/icons"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect, useRef } from "react"
import { Switch } from "@/app/components/ui/switch"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Textarea } from "./ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { requirementFormSchema } from "../requirements/schema"
import type { RequirementFormValues } from "../requirements/actions"
import * as z from "zod"

interface Segment {
  id: string
  name: string
  description: string
}

interface CreateRequirementDialogProps {
  segments: Segment[]
  onCreateRequirement: (values: RequirementFormValues) => Promise<{ data?: any; error?: string }>
  trigger?: React.ReactNode
}

export function CreateRequirementDialog({ segments, onCreateRequirement, trigger }: CreateRequirementDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dialogState, setDialogState] = useState({
    isFormValid: false,
    lastAction: 'initial',
    submitAttempts: 0,
    formData: null as any
  })
  
  // Prevenir renderizados innecesarios
  const segmentsRef = useRef<Segment[]>([])
  const loggedRef = useRef(false)
  
  const { user } = useAuth()
  const { currentSite } = useSite()

  const form = useForm<RequirementFormValues>({
    resolver: zodResolver(requirementFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "backlog",
      completionStatus: "pending",
      source: "Feature Request",
      segments: [],
      user_id: "",
      site_id: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })

  // Actualizar user_id y site_id cuando cambien
  useEffect(() => {
    if (user?.id) {
      form.setValue("user_id", user.id)
    }
    if (currentSite?.id) {
      form.setValue("site_id", currentSite.id)
    }
  }, [user?.id, currentSite?.id, form])

  // Monitorear cambios en los segmentos para evitar re-renders innecesarios
  useEffect(() => {
    if (!segments || segments.length === 0) return
    
    // Solo actualizar si realmente hay cambios
    const hasChanges = segments.length !== segmentsRef.current.length || 
      segments.some((seg, idx) => segmentsRef.current[idx]?.id !== seg.id)
    
    if (hasChanges) {
      segmentsRef.current = segments
      
      if (!loggedRef.current) {
        console.log("CreateRequirementDialog: segmentos actualizados", segments.length)
        loggedRef.current = true
      }
    }
  }, [segments])

  // Monitorear cambios en el formulario
  useEffect(() => {
    setDialogState(prev => ({
      ...prev,
      isFormValid: form.formState.isValid,
      formData: form.getValues()
    }))
  }, [form.formState.isValid, form.formState.isDirty, form])

  const handleClose = () => {
    if (isLoading) return
    setDialogState(prev => ({ ...prev, lastAction: 'close' }))
    setIsOpen(false)
  }

  const onSubmit = async (values: RequirementFormValues) => {
    setDialogState(prev => ({ 
      ...prev, 
      lastAction: 'submit',
      submitAttempts: prev.submitAttempts + 1,
      formData: values
    }))

    try {
      // Validar que exista un usuario y sitio seleccionado
      if (!user?.id) {
        toast.error("Debes iniciar sesión para crear un requerimiento")
        return
      }

      if (!currentSite?.id) {
        toast.error("Debes seleccionar un sitio para crear un requerimiento")
        return
      }

      setIsLoading(true)
      setDialogState(prev => ({ ...prev, lastAction: 'loading' }))

      // Actualizar los timestamps y datos del sitio
      values.created_at = new Date().toISOString()
      values.updated_at = new Date().toISOString()
      values.user_id = user.id
      values.site_id = currentSite.id

      const { data, error } = await onCreateRequirement(values)

      if (error) {
        setDialogState(prev => ({ ...prev, lastAction: 'error' }))
        toast.error(error)
        return
      }

      setDialogState(prev => ({ ...prev, lastAction: 'success' }))
      toast.success("Requerimiento creado exitosamente")
      setIsOpen(false)
    } catch (error) {
      setDialogState(prev => ({ ...prev, lastAction: 'error' }))
      toast.error(error instanceof Error ? error.message : "Error al crear el requerimiento")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog 
      open={isOpen}
      modal={true}
      onOpenChange={(open) => {
        if (!isLoading) {
          setIsOpen(open)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Requirement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[600px]" 
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
      >
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Requirement</DialogTitle>
            <DialogDescription>
              Create a new product requirement aligned with specific segments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input
                {...form.register("title")}
                placeholder="Enter requirement title"
                icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <div className="relative">
                <div className="absolute top-[14px] left-3 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <Textarea
                  {...form.register("description")}
                  placeholder="Describe your requirement"
                  className="min-h-[100px] pl-10"
                />
              </div>
              {form.formState.errors.description && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select 
                    onValueChange={(value) => form.setValue("priority", value as "high" | "medium" | "low")}
                    defaultValue={form.getValues("priority")}
                  >
                    <SelectTrigger className="h-12 pl-10">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.formState.errors.priority && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {form.formState.errors.priority.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Select 
                    onValueChange={(value) => form.setValue("status", value as "validated" | "in-progress" | "backlog")}
                    defaultValue={form.getValues("status")}
                  >
                    <SelectTrigger className="h-12 pl-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="validated">Validated</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="backlog">Backlog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.formState.errors.status && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    {form.formState.errors.status.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Source</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <Select 
                  onValueChange={(value) => form.setValue("source", value)}
                  defaultValue={form.getValues("source")}
                >
                  <SelectTrigger className="h-12 pl-10">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer Interview">Customer Interview</SelectItem>
                    <SelectItem value="Feature Request">Feature Request</SelectItem>
                    <SelectItem value="Support Ticket">Support Ticket</SelectItem>
                    <SelectItem value="Internal Stakeholder">Internal Stakeholder</SelectItem>
                    <SelectItem value="Market Research">Market Research</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.formState.errors.source && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.source.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Target Segments</Label>
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-4">
                  {segments.map((segment) => (
                    <div 
                      key={segment.id} 
                      className={cn(
                        "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                        "transition-colors hover:bg-muted/50"
                      )}
                    >
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`segment-${segment.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {segment.name}
                        </label>
                        <p className="text-sm text-muted-foreground">
                          {segment.description}
                        </p>
                      </div>
                      <Switch
                        id={`segment-${segment.id}`}
                        onCheckedChange={(checked) => {
                          const currentSegments = form.getValues("segments")
                          if (checked) {
                            form.setValue("segments", [...currentSegments, segment.id])
                          } else {
                            form.setValue(
                              "segments",
                              currentSegments.filter((id: string) => id !== segment.id)
                            )
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {form.formState.errors.segments && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.segments.message}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="h-12"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="h-12">
              {isLoading ? "Creating..." : "Create Requirement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 