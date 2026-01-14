"use client"

import * as z from "zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import { Input } from "@/app/components/ui/input"
import { Globe, PlusCircle } from "@/app/components/ui/icons"

const formSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .refine(
      (domain) => {
        // Allow localhost
        if (domain.toLowerCase() === 'localhost') return true
        
        // If domain starts with https:// or http://, extract the domain part
        let cleanDomain = domain
        if (domain.startsWith('https://') || domain.startsWith('http://')) {
          try {
            const url = new URL(domain)
            cleanDomain = url.hostname
          } catch {
            return false
          }
        }
        
        // Regular domain validation
        const domainRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/
        if (domainRegex.test(cleanDomain)) return true
        
        // IPv4 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
        if (ipv4Regex.test(cleanDomain)) return true
        
        // IPv6 validation
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
        if (ipv6Regex.test(cleanDomain)) return true
        
        return false
      },
      {
        message: "Please enter a valid domain name or IP address"
      }
    )
})

interface AddDomainDialogProps {
  onAddDomain: (domain: string) => Promise<boolean>
}

export function AddDomainDialog({ onAddDomain }: AddDomainDialogProps) {
  const [open, setOpen] = useState(false)
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      domain: "",
    },
  })

  const handleDomainChange = (value: string) => {
    // If the value is empty, don't add anything
    if (!value) {
      return value
    }

    // If the value already starts with http:// or https://, don't modify it
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value
    }

    // Add https:// prefix when user starts typing anything that doesn't already have a protocol
    if (value.trim() && !value.startsWith('//')) {
      return `https://${value}`
    }

    return value
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Extract the domain part if it has https:// prefix
    let domainToSubmit = values.domain
    if (domainToSubmit.startsWith('https://') || domainToSubmit.startsWith('http://')) {
      try {
        const url = new URL(domainToSubmit)
        domainToSubmit = url.hostname
      } catch {
        // If URL parsing fails, use the original value
      }
    }
    
    const success = await onAddDomain(domainToSubmit)
    if (success) {
      form.reset()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          type="button"
          variant="outline"
          size="sm"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Domain
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Allowed Domain</DialogTitle>
          <DialogDescription>
            Add a domain that will be allowed to make requests to your API.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="https://example.com" 
                        className="pl-10"
                        {...field}
                        onChange={(e) => {
                          const processedValue = handleDomainChange(e.target.value)
                          field.onChange(processedValue)
                        }}
                        onBlur={(e) => {
                          const processedValue = handleDomainChange(e.target.value)
                          field.onChange(processedValue)
                          field.onBlur()
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add Domain
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
} 