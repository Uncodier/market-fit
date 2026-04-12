import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import {
  ModalFooter,
  ModalFooterActions,
  ModalFooterInfo,
} from "@/app/components/ui/modal-footer"
import {
  ModalHeader,
  ModalHeaderTitle,
  ModalHeaderDescription,
} from "@/app/components/ui/modal-header"

interface EditStepModalProps {
  open: boolean
  title: string
  description: string
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onSave: () => void
  onClose: () => void
}

export const EditStepModal: React.FC<EditStepModalProps> = ({
  open,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onClose
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden flex flex-col">
        <ModalHeader className="shrink-0">
          <div>
            <ModalHeaderTitle>Editar Paso</ModalHeaderTitle>
            <ModalHeaderDescription>
              Modifica el título y la descripción del paso. Presiona Escape o haz clic en Cancelar para descartar los cambios.
            </ModalHeaderDescription>
          </div>
        </ModalHeader>
        <div className="grid gap-4 p-6 overflow-y-auto">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="col-span-3"
              placeholder="Introduce el título del paso..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSave()
                }
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right mt-2">
              Descripción
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="col-span-3 min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Describe en qué consiste este paso..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault()
                  onSave()
                }
              }}
            />
          </div>
        </div>
        <ModalFooter className="shrink-0">
          <ModalFooterInfo>
          </ModalFooterInfo>
          <ModalFooterActions>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onSave} disabled={!title.trim()}>
              Guardar Cambios
            </Button>
          </ModalFooterActions>
        </ModalFooter>
      </DialogContent>
    </Dialog>
  )
}
