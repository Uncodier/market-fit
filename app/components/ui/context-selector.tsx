"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Input } from "@/app/components/ui/input"
import { Checkbox } from "@/app/components/ui/checkbox"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"

// Types based on the data models we found
interface Lead {
  id: string
  name: string
  email: string
  company: { name?: string } | null
  position: string | null
  status: "new" | "contacted" | "qualified" | "converted" | "lost"
}

interface ContentItem {
  id: string
  title: string
  description: string | null
  type: string
  status: string
}

interface Requirement {
  id: string
  title: string
  description: string
  type: string
  priority: "high" | "medium" | "low"
  status: string
}

interface Task {
  id: string
  serial_id: string
  title: string
  description: string | null
  status: "completed" | "in_progress" | "pending" | "failed"
  type: string
  priority: number
}

interface SelectedContext {
  leads: string[]
  contents: string[]
  requirements: string[]
  tasks: string[]
}

interface ContextSelectorProps {
  onContextChange: (context: SelectedContext) => void
  selectedContext: SelectedContext
}

export function ContextSelector({ onContextChange, selectedContext }: ContextSelectorProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("leads")
  const [searchTerm, setSearchTerm] = useState("")
  const { currentSite } = useSite()
  
  // Data states
  const [leads, setLeads] = useState<Lead[]>([])
  const [contents, setContents] = useState<ContentItem[]>([])
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  
  // Loading states
  const [loading, setLoading] = useState({
    leads: false,
    contents: false,
    requirements: false,
    tasks: false
  })

  const totalSelected = Object.values(selectedContext).reduce((sum, arr) => sum + arr.length, 0)

  // Fetch functions
  const fetchLeads = async () => {
    if (!currentSite?.id || leads.length > 0) return
    
    setLoading(prev => ({ ...prev, leads: true }))
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, company, position, status')
        .eq('site_id', currentSite.id)
        .limit(50)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(prev => ({ ...prev, leads: false }))
    }
  }

  const fetchContents = async () => {
    if (!currentSite?.id || contents.length > 0) return
    
    setLoading(prev => ({ ...prev, contents: true }))
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('content')
        .select('id, title, description, type, status')
        .eq('site_id', currentSite.id)
        .limit(50)
        .order('created_at', { ascending: false })

      if (error) throw error
      setContents(data || [])
    } catch (error) {
      console.error('Error fetching contents:', error)
    } finally {
      setLoading(prev => ({ ...prev, contents: false }))
    }
  }

  const fetchRequirements = async () => {
    if (!currentSite?.id || requirements.length > 0) return
    
    setLoading(prev => ({ ...prev, requirements: true }))
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('requirements')
        .select('id, title, description, type, priority, status')
        .eq('site_id', currentSite.id)
        .limit(50)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRequirements(data || [])
    } catch (error) {
      console.error('Error fetching requirements:', error)
    } finally {
      setLoading(prev => ({ ...prev, requirements: false }))
    }
  }

  const fetchTasks = async () => {
    if (!currentSite?.id || tasks.length > 0) return
    
    setLoading(prev => ({ ...prev, tasks: true }))
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tasks')
        .select('id, serial_id, title, description, status, type, priority')
        .eq('site_id', currentSite.id)
        .limit(50)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(prev => ({ ...prev, tasks: false }))
    }
  }

  // Load data when tab changes or modal opens
  useEffect(() => {
    if (!open || !currentSite?.id) return
    
    if (activeTab === 'leads') fetchLeads()
    else if (activeTab === 'contents') fetchContents()
    else if (activeTab === 'requirements') fetchRequirements()
    else if (activeTab === 'tasks') fetchTasks()
  }, [activeTab, open, currentSite?.id])

  // Selection handlers
  const handleSelectionChange = (type: keyof SelectedContext, id: string, checked: boolean) => {
    const newContext = { ...selectedContext }
    if (checked) {
      newContext[type] = [...newContext[type], id]
    } else {
      newContext[type] = newContext[type].filter(item => item !== id)
    }
    onContextChange(newContext)
  }

  // Filter functions
  const getFilteredData = () => {
    const term = searchTerm.toLowerCase()
    
    switch (activeTab) {
      case 'leads':
        return leads.filter(lead => 
          lead.name.toLowerCase().includes(term) ||
          lead.email.toLowerCase().includes(term) ||
          (lead.company?.name && lead.company.name.toLowerCase().includes(term))
        )
      case 'contents':
        return contents.filter(content => 
          content.title.toLowerCase().includes(term) ||
          (content.description && content.description.toLowerCase().includes(term))
        )
      case 'requirements':
        return requirements.filter(req => 
          req.title.toLowerCase().includes(term) ||
          req.description.toLowerCase().includes(term)
        )
      case 'tasks':
        return tasks.filter(task => 
          task.title.toLowerCase().includes(term) ||
          (task.description && task.description.toLowerCase().includes(term))
        )
      default:
        return []
    }
  }

  const renderItems = () => {
    const filteredData = getFilteredData()
    const isLoading = loading[activeTab as keyof typeof loading]
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary/20 border-t-primary"></div>
        </div>
      )
    }

    if (filteredData.length === 0) {
      return (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No {activeTab} found
        </div>
      )
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredData.map((item: any) => (
          <div key={item.id} className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted/50 hover:scale-[1.02] active:scale-95 transition-all duration-200 cursor-pointer">
            <Checkbox
              checked={selectedContext[activeTab as keyof SelectedContext].includes(item.id)}
              onCheckedChange={(checked) => handleSelectionChange(activeTab as keyof SelectedContext, item.id, checked as boolean)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {item.title || item.name}
              </p>
              {(item.description || item.email) && (
                <p className="text-xs text-muted-foreground truncate">
                  {item.description || item.email}
                </p>
              )}
              {(item.status || item.company?.name) && (
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {item.status || item.company?.name}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-3 hover:bg-muted hover:scale-105 active:scale-95 transition-all duration-200 text-xs"
        onClick={() => setOpen(!open)}
      >
        <span className="mr-1">🗃️</span>
        add context
        {totalSelected > 0 && (
          <Badge variant="secondary" className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
            {totalSelected}
          </Badge>
        )}
      </Button>
      
      {open && (
        <div className="absolute bottom-10 left-0 w-96 bg-popover border rounded-md shadow-lg p-4 z-[100001]">
          <div className="border-b pb-2 mb-4">
            <h4 className="font-medium text-sm">Add Context</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Select data to provide context to the robot
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b mb-4">
            {[
              { key: 'leads', label: '👥 Leads', count: selectedContext.leads.length },
              { key: 'contents', label: '📄 Content', count: selectedContext.contents.length },
              { key: 'requirements', label: '☑️ Reqs', count: selectedContext.requirements.length },
              { key: 'tasks', label: '📋 Tasks', count: selectedContext.tasks.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-2 py-1 text-xs border-b-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
                  activeTab === tab.key 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Items */}
          {renderItems()}
          
          <div className="mt-4 pt-4 border-t flex justify-between">
            <div className="text-xs text-muted-foreground">
              {totalSelected} items selected
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}