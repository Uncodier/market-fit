"use client"

import { useFormContext, useFieldArray } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Globe } from "../ui/icons"
import { useState } from "react"
import { toast } from "sonner"

interface AllowedDomainsSectionProps {
  active: boolean
}

export function AllowedDomainsSection({ active }: AllowedDomainsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [newDomain, setNewDomain] = useState("")

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "allowed_domains"
  })

  const handleAddDomain = () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain")
      return
    }

    const domain = newDomain.toLowerCase().trim()
    
    // Check if domain already exists
    const existingDomain = fields.find(field => field.domain === domain)
    if (existingDomain) {
      toast.error("This domain is already in the list")
      return
    }

    // Validate domain format
    const isValidDomain = 
      domain === 'localhost' ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) ||
      /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(domain)

    if (!isValidDomain) {
      toast.error("Please enter a valid domain, IP address, or 'localhost'")
      return
    }

    append({ domain })
    setNewDomain("")
    toast.success("Domain added successfully")
  }

  const handleRemoveDomain = (index: number) => {
    remove(index)
    toast.success("Domain removed successfully")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddDomain()
    }
  }

  if (!active) return null

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Allowed Domains</CardTitle>
        <FormDescription className="text-sm text-muted-foreground">
          Control which domains can embed or access your site. Add domains and subdomains that should be allowed to interact with your content.
        </FormDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        {/* Add new domain */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-12 h-12 text-base"
                placeholder="example.com, localhost, or 192.168.1.1"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={handleAddDomain}
            className="h-12 px-4"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>

        {/* Existing domains */}
        {fields.length > 0 ? (
          <div className="space-y-2">
            <FormLabel className="text-sm font-medium text-foreground">Current Allowed Domains</FormLabel>
            <div className="rounded-md border">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`flex items-center justify-between p-4 ${
                    index !== fields.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{field.domain}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveDomain(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove domain</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No domains added yet</p>
            <p className="text-xs mt-1">Add domains to control access to your site</p>
          </div>
        )}

        {/* Helper text */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Examples:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><code>example.com</code> - Allows the domain and all its subdomains</li>
            <li><code>subdomain.example.com</code> - Allows only this specific subdomain</li>
            <li><code>localhost</code> - Allows local development</li>
            <li><code>192.168.1.1</code> - Allows specific IP addresses</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 