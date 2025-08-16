"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { 
  Search, 
  FileText, 
  Filter, 
  Mail, 
  MessageSquare,
  Phone,
  PenTool,
  Hash,
  Globe,
  Target,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Pencil,
  Plus
} from "@/app/components/ui/icons"
import { Switch } from "@/app/components/ui/switch"
import { Pagination } from "@/app/components/ui/pagination"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getCopywriting, createCopywriting, updateCopywritingStatus, updateCopywriting, type CopywritingItem } from "./actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { toast } from "sonner"
import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/app/components/ui/sheet"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { useCommandK } from "@/app/hooks/use-command-k"
import { useRouter } from "next/navigation"

// Copywriting types
const COPYWRITING_TYPES = [
  { id: 'tweet', label: 'Tweet', icon: Hash },
  { id: 'pitch', label: 'Pitch', icon: Target },
  { id: 'blurb', label: 'Blurb', icon: FileText },
  { id: 'cold_email', label: 'Cold Email', icon: Mail },
  { id: 'cold_call', label: 'Cold Call Script', icon: Phone },
  { id: 'social_post', label: 'Social Media Post', icon: MessageSquare },
  { id: 'ad_copy', label: 'Ad Copy', icon: Globe },
  { id: 'headline', label: 'Headline', icon: PenTool },
  { id: 'description', label: 'Product Description', icon: FileText },
  { id: 'landing_page', label: 'Landing Page Copy', icon: Globe }
] as const

type CopywritingType = typeof COPYWRITING_TYPES[number]['id']

const COPYWRITING_STATUS = [
  'pending',
  'in_progress', 
  'completed',
  'published',
  'archived'
] as const

type CopywritingStatus = typeof COPYWRITING_STATUS[number]

interface CopywritingFilters {
  status: CopywritingStatus[]
  type: CopywritingType[]
  segments: string[]
}

function getCopywritingIcon(type: CopywritingType) {
  const typeConfig = COPYWRITING_TYPES.find(t => t.id === type)
  return typeConfig?.icon || FileText
}

function getCopywritingStatusColor(status: CopywritingStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'published':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'archived':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Skeleton component
function CopywritingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-48">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between mt-4">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Create copywriting dialog
interface CreateCopywritingDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Partial<CopywritingItem>) => Promise<void>
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
}

function CreateCopywritingDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  segments, 
  campaigns 
}: CreateCopywritingDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'tweet' as CopywritingType,
    content: '',
    segment_id: '',
    campaign_id: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }
    
    await onSubmit(formData)
    setFormData({
      title: '',
      description: '',
      type: 'tweet',
      content: '',
      segment_id: '',
      campaign_id: ''
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Copy</DialogTitle>
          <DialogDescription>
            Create a new piece of copywriting content
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter title..."
                required
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value: CopywritingType) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COPYWRITING_TYPES.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="segment">Segment (Optional)</Label>
              <Select 
                value={formData.segment_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, segment_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select segment..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No segment</SelectItem>
                  {segments.map(segment => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="campaign">Campaign (Optional)</Label>
              <Select 
                value={formData.campaign_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, campaign_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No campaign</SelectItem>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your copy here..."
              rows={8}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Copy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Copywriting card component
interface CopywritingCardProps {
  item: CopywritingItem
  onEdit: (item: CopywritingItem) => void
  onStatusChange: (id: string, status: CopywritingStatus) => Promise<void>
}

function CopywritingCard({ item, onEdit, onStatusChange }: CopywritingCardProps) {
  const Icon = getCopywritingIcon(item.type)
  
  return (
    <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline" className={getCopywritingStatusColor(item.status)}>
              {item.status.replace('_', ' ')}
            </Badge>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{item.title}</h3>
          {item.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
              {item.description}
            </p>
          )}
          {item.content && (
            <p className="text-sm line-clamp-3 mb-4">
              {item.content}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {COPYWRITING_TYPES.find(t => t.id === item.type)?.label}
          </span>
          <div className="flex gap-2">
            <Select 
              value={item.status} 
              onValueChange={(value: CopywritingStatus) => onStatusChange(item.id, value)}
            >
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COPYWRITING_STATUS.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CopywritingPage() {
  const { currentSite } = useSite()
  const router = useRouter()
  const [copywritingItems, setCopywritingItems] = useState<CopywritingItem[]>([])
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; description?: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewType, setViewType] = useState<ViewType>('grid')
  const [selectedCopywriting, setSelectedCopywriting] = useState<CopywritingItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [filters, setFilters] = useState<CopywritingFilters>({
    status: [],
    type: [],
    segments: []
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredCopywriting, setFilteredCopywriting] = useState<CopywritingItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // Initialize command+k hook
  useCommandK()

  useEffect(() => {
    if (currentSite?.id) {
      loadCopywriting()
      loadSegments()
      loadCampaigns()
    }
  }, [currentSite?.id])

  const loadCopywriting = async () => {
    if (!currentSite?.id) return
    
    try {
      setIsLoading(true)
      const items = await getCopywriting(currentSite.id)
      setCopywritingItems(items)
      setFilteredCopywriting(items)
    } catch (error) {
      console.error('Error loading copywriting:', error)
      toast.error('Failed to load copywriting items')
      setError('Failed to load copywriting items')
    } finally {
      setIsLoading(false)
    }
  }

  const loadSegments = async () => {
    if (!currentSite?.id) return
    
    try {
      const segmentsData = await getSegments(currentSite.id)
      setSegments(segmentsData)
    } catch (error) {
      console.error('Error loading segments:', error)
    }
  }

  const loadCampaigns = async () => {
    if (!currentSite?.id) return
    
    try {
      const campaignsData = await getCampaigns(currentSite.id)
      setCampaigns(campaignsData)
    } catch (error) {
      console.error('Error loading campaigns:', error)
    }
  }

  const handleCreateCopywriting = async (data: Partial<CopywritingItem>) => {
    if (!currentSite?.id) return

    try {
      const newItem = await createCopywriting(currentSite.id, data)
      setCopywritingItems(prev => [newItem, ...prev])
      updateFilteredCopywriting(searchTerm, filters, [newItem, ...copywritingItems])
      toast.success('Copy created successfully')
    } catch (error) {
      console.error('Error creating copywriting:', error)
      toast.error('Failed to create copy')
    }
  }

  const handleStatusChange = async (id: string, status: CopywritingStatus) => {
    try {
      await updateCopywritingStatus(id, status)
      const updatedItems = copywritingItems.map(item => 
        item.id === id ? { ...item, status } : item
      )
      setCopywritingItems(updatedItems)
      updateFilteredCopywriting(searchTerm, filters, updatedItems)
      toast.success('Status updated successfully')
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const updateFilteredCopywriting = useCallback((search: string, filters: CopywritingFilters, items: CopywritingItem[]) => {
    let filtered = items

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.content?.toLowerCase().includes(searchLower)
      )
    }

    // Apply status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(item => filters.status.includes(item.status))
    }

    // Apply type filter
    if (filters.type.length > 0) {
      filtered = filtered.filter(item => filters.type.includes(item.type))
    }

    // Apply segments filter
    if (filters.segments.length > 0) {
      filtered = filtered.filter(item => 
        item.segment_id && filters.segments.includes(item.segment_id)
      )
    }

    setFilteredCopywriting(filtered)
    setCurrentPage(1) // Reset to first page when filtering
  }, [])

  useEffect(() => {
    updateFilteredCopywriting(searchTerm, filters, copywritingItems)
  }, [searchTerm, filters, copywritingItems, updateFilteredCopywriting])

  // Pagination
  const totalPages = Math.ceil(filteredCopywriting.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCopywriting = filteredCopywriting.slice(startIndex, endIndex)

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={loadCopywriting}
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all">
                    All Copy
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {copywritingItems.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="tweet">
                    Tweets
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {copywritingItems.filter(item => item.type === 'tweet').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="cold_email">
                    Cold Emails
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {copywritingItems.filter(item => item.type === 'cold_email').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="pitch">
                    Pitches
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {copywritingItems.filter(item => item.type === 'pitch').length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="ad_copy">
                    Ad Copy
                    <Badge variant="secondary" className="ml-2 bg-muted">
                      {copywritingItems.filter(item => item.type === 'ad_copy').length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search copy..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                
                <ViewSelector viewType={viewType} onViewTypeChange={setViewType} />
                
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Copy
                </Button>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 px-16 py-8">
          <TabsContent value="all" className="mt-0">
            {isLoading ? (
              <CopywritingSkeleton />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                  {paginatedCopywriting.map((item) => (
                    <CopywritingCard
                      key={item.id}
                      item={item}
                      onEdit={setSelectedCopywriting}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}

                {filteredCopywriting.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <PenTool className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No copy found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || filters.status.length > 0 || filters.type.length > 0 || filters.segments.length > 0
                        ? "Try adjusting your search or filters"
                        : "Create your first piece of copy to get started"
                      }
                    </p>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Copy
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Individual type tabs */}
          {COPYWRITING_TYPES.slice(0, 4).map(type => (
            <TabsContent key={type.id} value={type.id} className="mt-0">
              {isLoading ? (
                <CopywritingSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {copywritingItems
                    .filter(item => item.type === type.id)
                    .map((item) => (
                      <CopywritingCard
                        key={item.id}
                        item={item}
                        onEdit={setSelectedCopywriting}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>

      {/* Create Dialog */}
      <CreateCopywritingDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateCopywriting}
        segments={segments}
        campaigns={campaigns}
      />
    </div>
  )
}
