"use client"

import { useState, RefObject } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Label } from "@/app/components/ui/label"
import { Trash2, AlertTriangle, Copy } from "@/app/components/ui/icons"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Switch } from "@/app/components/ui/switch"
import { toast } from "sonner"
import { Segment } from "../page"
import { updateSegment, deleteSegment } from "../../actions"

interface SegmentDetailsTabProps {
  segment: Segment;
  onSave: (updatedSegment: Segment) => void;
  formRef: RefObject<HTMLFormElement>;
}

export default function SegmentDetailsTab({ segment, onSave, formRef }: SegmentDetailsTabProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: segment.name || "",
    description: segment.description || "",
    audience: segment.audience || "",
    language: segment.language || "",
    size: segment.size || "",
    url: segment.url || "",
    is_active: segment.is_active
  })
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [savingSection, setSavingSection] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleCopyId = async () => {
    try {
      // Primero intentamos usar el API moderno de clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(segment.id)
        toast.success("Segment ID copied to clipboard")
        return
      }

      // Fallback usando un elemento temporal
      const textArea = document.createElement("textarea")
      textArea.value = segment.id
      
      // Evitar que se scrollee la página
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      
      textArea.focus()
      textArea.select()

      try {
        document.execCommand('copy')
        textArea.remove()
        toast.success("Segment ID copied to clipboard")
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err)
        toast.error("Failed to copy. Please copy manually.")
      }
    } catch (err) {
      console.error('Failed to copy text: ', err)
      toast.error("Failed to copy. Please copy manually.")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await updateSegment({
        segmentId: segment.id,
        data: formData
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.segment) {
        toast.success("Segment updated successfully")
        onSave(result.segment as Segment)
      }
    } catch (error) {
      console.error("Error updating segment:", error)
      toast.error("Failed to update segment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveSection = async (section: string) => {
    setSavingSection(section)
    try {
      const result = await updateSegment({
        segmentId: segment.id,
        data: formData
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.segment) {
        toast.success(`${section === 'basic' ? 'Basic Information' : 'Audience Details'} saved successfully`)
        onSave(result.segment as Segment)
      }
    } catch (error) {
      console.error(`Error saving ${section}:`, error)
      toast.error(`Failed to save ${section}`)
    } finally {
      setSavingSection(null)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const result = await deleteSegment(segment.id)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Segment deleted successfully")
      router.push('/segments')
    } catch (error) {
      console.error("Error deleting segment:", error)
      toast.error("Failed to delete segment")
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <form ref={formRef} id="save-segment-form" onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update the basic details of your segment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Status</Label>
                <p className="text-sm text-muted-foreground">
                  {formData.is_active 
                    ? "This segment is being tracked and included in marketing cycles" 
                    : "This segment is paused and excluded from marketing cycles"
                  }
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleSwitchChange("is_active", checked)}
                aria-label="Toggle segment tracking status"
              />
            </div>

            <div className="space-y-2">
              <Label>Segment ID</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono">
                  {segment.id}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyId}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Use this ID as a URL parameter to track this segment: <code className="text-xs">?segment_id={segment.id}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Segment Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter segment name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description || ""}
                onChange={handleInputChange}
                placeholder="Describe this segment"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="url">Source URL</Label>
              <Input
                id="url"
                name="url"
                value={formData.url}
                onChange={handleInputChange}
                placeholder="https://example.com/landing-page"
              />
              <p className="text-sm text-muted-foreground">
                This URL is used for automatic segment attribution. New visitors accessing this URL will be automatically assigned to this segment. You can also manually assign visitors to this segment regardless of the URL.
              </p>
            </div>
          </CardContent>
          <ActionFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveSection('basic')}
              disabled={savingSection === 'basic'}
            >
              {savingSection === 'basic' ? "Saving..." : "Save Basic Information"}
            </Button>
          </ActionFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience Details</CardTitle>
            <CardDescription>
              Define the characteristics of your target audience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Audience Type</Label>
              <Select 
                value={formData.audience || ""} 
                onValueChange={(value) => handleSelectChange("audience", value)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select audience type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b2b">B2B (Business to Business)</SelectItem>
                  <SelectItem value="b2c">B2C (Business to Consumer)</SelectItem>
                  <SelectItem value="b2g">B2G (Business to Government)</SelectItem>
                  <SelectItem value="c2c">C2C (Consumer to Consumer)</SelectItem>
                  <SelectItem value="d2c">D2C (Direct to Consumer)</SelectItem>
                  <SelectItem value="saas">SaaS Users</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="smb">Small-Medium Business</SelectItem>
                  <SelectItem value="startup">Startup</SelectItem>
                  <SelectItem value="mixed">Mixed/Multiple</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="language">Primary Language</Label>
              <Select 
                value={formData.language || ""} 
                onValueChange={(value) => handleSelectChange("language", value)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="pt">Portuguese</SelectItem>
                  <SelectItem value="it">Italian</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="size">Estimated Audience Size</Label>
              <Input
                id="size"
                name="size"
                type="number"
                min="0"
                value={formData.size}
                onChange={handleInputChange}
                placeholder="e.g. 10000"
              />
              <p className="text-sm text-muted-foreground">
                Enter the estimated number of people in this segment. This helps with targeting and budget planning.
              </p>
            </div>
          </CardContent>
          <ActionFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveSection('audience')}
              disabled={savingSection === 'audience'}
            >
              {savingSection === 'audience' ? "Saving..." : "Save Audience Details"}
            </Button>
          </ActionFooter>
        </Card>

        <Card className="border-red-100 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-500 dark:text-red-400">Danger Zone</CardTitle>
            <CardDescription>
              Actions in this section can't be undone
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-red-600 dark:text-red-400">Delete this segment</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Once deleted, this segment and all its data will be permanently removed
                  </p>
                </div>
                <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Delete Segment
                      </DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete this segment? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm font-medium">
                        You are about to delete: <span className="font-bold">{segment.name}</span>
                      </p>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteDialogOpen(false)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Delete Segment"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
} 