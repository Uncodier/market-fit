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
import { PlusCircle, FlaskConical, FileText, Users, XCircle } from "@/app/components/ui/icons"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState, useEffect } from "react"
import { Switch } from "@/app/components/ui/switch"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Textarea } from "./ui/textarea"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"

// Marca para React DevTools
if (typeof window !== "undefined") {
  // @ts-ignore
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.on?.("renderer", () => {
    console.log("🔍 React DevTools detectado")
  })
}

const experimentFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  hypothesis: z.string().min(1, "La hipótesis es requerida"),
  segments: z.array(z.string()).min(1, "Debe seleccionar al menos un segmento"),
  status: z.enum(["draft", "active", "completed"]).default("draft"),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  conversion: z.number().nullable().optional(),
  roi: z.number().nullable().optional(),
  preview_url: z.string().optional(),
  user_id: z.string().min(1, "El usuario es requerido"),
  site_id: z.string().min(1, "El sitio es requerido"),
  created_at: z.string(),
  updated_at: z.string(),
})

type ExperimentFormValues = z.infer<typeof experimentFormSchema>

interface Segment {
  id: string
  name: string
  description: string
}

interface CreateExperimentDialogProps {
  segments: Segment[]
  onCreateExperiment: (values: ExperimentFormValues) => Promise<{ data?: any; error?: string }>
}

export function CreateExperimentDialog({ segments, onCreateExperiment }: CreateExperimentDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [dialogState, setDialogState] = useState({
    isFormValid: false,
    lastAction: 'initial',
    submitAttempts: 0,
    formData: null as any
  })
  
  const { user } = useAuth()
  const { currentSite } = useSite()

  const form = useForm<ExperimentFormValues>({
    resolver: zodResolver(experimentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      hypothesis: "",
      segments: [],
      status: "draft",
      start_date: null,
      end_date: null,
      conversion: null,
      roi: null,
      preview_url: "",
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
      form.setValue("preview_url", currentSite.url || "")
    }
  }, [user?.id, currentSite?.id, form])

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

  const onSubmit = async (values: ExperimentFormValues) => {
    setDialogState(prev => ({ 
      ...prev, 
      lastAction: 'submit',
      submitAttempts: prev.submitAttempts + 1,
      formData: values
    }))

    try {
      // Validar que exista un usuario y sitio seleccionado
      if (!user?.id) {
        toast.error("Debes iniciar sesión para crear un experimento")
        return
      }

      if (!currentSite?.id) {
        toast.error("Debes seleccionar un sitio para crear un experimento")
        return
      }

      setIsLoading(true)
      setDialogState(prev => ({ ...prev, lastAction: 'loading' }))

      // Actualizar los timestamps y datos del sitio
      values.created_at = new Date().toISOString()
      values.updated_at = new Date().toISOString()
      values.user_id = user.id
      values.site_id = currentSite.id
      values.preview_url = currentSite.url || values.preview_url

      const { data, error } = await onCreateExperiment(values)

      if (error) {
        setDialogState(prev => ({ ...prev, lastAction: 'error' }))
        toast.error(error)
        return
      }

      setDialogState(prev => ({ ...prev, lastAction: 'success' }))
      toast.success("Experimento creado exitosamente")
    } catch (error) {
      setDialogState(prev => ({ ...prev, lastAction: 'error' }))
      toast.error(error instanceof Error ? error.message : "Error al crear el experimento")
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
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Experiment
        </Button>
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
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Create New Experiment
            </DialogTitle>
            <DialogDescription>
              Create a new experiment to test different variations with your selected segments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  {...form.register("name")}
                  className="h-12 pl-10 pr-4"
                  placeholder="Enter experiment name..."
                />
              </div>
              {form.formState.errors.name && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="description"
                  {...form.register("description")}
                  className="min-h-[100px] resize-none pl-10 pr-4 py-3"
                  placeholder="Describe what you want to test..."
                />
              </div>
              {form.formState.errors.description && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hypothesis">Hypothesis</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="hypothesis"
                  {...form.register("hypothesis")}
                  className="min-h-[100px] resize-none pl-10 pr-4 py-3"
                  placeholder="What do you expect to happen and why?"
                />
              </div>
              {form.formState.errors.hypothesis && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {form.formState.errors.hypothesis.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label>Target Segments</Label>
              </div>
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
                              currentSegments.filter((id) => id !== segment.id)
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
              {isLoading ? "Creating..." : "Create Experiment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 