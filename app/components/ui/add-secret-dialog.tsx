"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { useSite } from "@/app/context/SiteContext"
import { useToast } from "@/app/components/ui/use-toast"
import { Key, Lock } from "@/app/components/ui/icons"

interface AddSecretDialogProps {
  onSecretCreated: (id: string, name: string) => void
  trigger?: React.ReactNode
}

export function AddSecretDialog({ onSecretCreated, trigger }: AddSecretDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [value, setValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { currentSite } = useSite()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentSite) {
      toast({ title: "Error", description: "No site selected", variant: "destructive" })
      return
    }

    if (!name || !value) {
      toast({ title: "Error", description: "Name and secret value are required", variant: "destructive" })
      return
    }

    try {
      setIsSubmitting(true)
      
      const response = await fetch('/api/secure-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'store',
          siteId: currentSite.id,
          tokenType: 'custom_secret',
          identifier: name,
          tokenValue: value
        })
      })
      
      const data = await response.json()
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create secret')
      }
      
      toast({ title: "Success", description: "Secret created securely" })
      onSecretCreated(data.tokenId, name)
      setOpen(false)
      setName("")
      setValue("")
    } catch (error: any) {
      console.error("Error creating secret:", error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Key className="h-4 w-4" />
            Add Secret
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Add Secret
            </DialogTitle>
            <DialogDescription>
              Store a secure token or API key. The value will be encrypted and cannot be viewed again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Secret Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., OPENAI_API_KEY"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="value">Secret Value</Label>
              <Input
                id="value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter the secret value"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Secret"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
