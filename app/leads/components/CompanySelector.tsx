import React, { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/app/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { CheckCircle2, Plus, Search } from "@/app/components/ui/icons"
import { Company, COMPANY_INDUSTRIES, COMPANY_SIZES, COMPANY_ANNUAL_REVENUES } from "@/app/companies/types"
import { getCompanies, createCompany } from "@/app/companies/actions"
import { toast } from "sonner"

interface CompanySelectorProps {
  selectedCompanyId: string | null
  onCompanyChange: (company: Company | null) => void
  isEditing: boolean
}

export function CompanySelector({ selectedCompanyId, onCompanyChange, isEditing }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState("")

  // Load companies
  useEffect(() => {
    loadCompanies()
  }, [])

  // Find selected company when selectedCompanyId changes
  useEffect(() => {
    if (selectedCompanyId && companies.length > 0) {
      const company = companies.find(c => c.id === selectedCompanyId)
      setSelectedCompany(company || null)
    } else {
      setSelectedCompany(null)
    }
  }, [selectedCompanyId, companies])

  const loadCompanies = async () => {
    setLoading(true)
    try {
      const { companies: companiesData, error } = await getCompanies()
      if (error) {
        toast.error("Error loading companies")
        console.error(error)
        return
      }
      setCompanies(companiesData)
    } catch (error) {
      console.error("Error loading companies:", error)
      toast.error("Error loading companies")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Company name is required")
      return
    }

    try {
      const { company, error } = await createCompany({ name: newCompanyName.trim() })
      if (error) {
        toast.error(error)
        return
      }

      if (company) {
        setCompanies(prev => [company, ...prev])
        setSelectedCompany(company)
        onCompanyChange(company)
        setNewCompanyName("")
        setIsCreating(false)
        setOpen(false)
        toast.success("Company created successfully")
      }
    } catch (error) {
      console.error("Error creating company:", error)
      toast.error("Error creating company")
    }
  }

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company)
    onCompanyChange(company)
    setOpen(false)
  }

  const handleClearCompany = () => {
    setSelectedCompany(null)
    onCompanyChange(null)
  }

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!isEditing) {
    return (
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
        <p className="text-sm font-medium">
          {selectedCompany?.name || "Not specified"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
      <div className="flex gap-1 min-w-0">
        <div className="flex-1 min-w-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between h-12 text-sm min-w-0"
              >
                <span className="truncate">
                  {selectedCompany ? selectedCompany.name : "Select company..."}
                </span>
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search companies..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No companies found.</p>
                    </div>
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredCompanies.map((company) => (
                      <div
                        key={company.id}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                        onClick={() => handleSelectCompany(company)}
                      >
                        <CheckCircle2
                          className={`mr-2 h-4 w-4 ${
                            selectedCompany?.id === company.id ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{company.name}</p>
                          {company.industry && (
                            <p className="text-xs text-muted-foreground">
                              {COMPANY_INDUSTRIES.find(i => i.id === company.industry)?.name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CommandGroup>
                  <div className="border-t p-2">
                    <Button
                      variant="secondary"
                      size="default"
                      onClick={() => {
                        setIsCreating(true)
                        setNewCompanyName(search || "")
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {search ? `Create "${search}"` : "Create new company"}
                    </Button>
                  </div>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        
        {selectedCompany && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCompany}
            className="h-12 w-12 flex-shrink-0 p-0"
            title="Clear company"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Create company dialog */}
      {isCreating && (
        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
          <h4 className="text-sm font-medium mb-3">Create New Company</h4>
          <div className="space-y-3">
            <Input
              placeholder="Company name"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              className="h-10"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleCreateCompany}
                disabled={!newCompanyName.trim()}
              >
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating(false)
                  setNewCompanyName("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 