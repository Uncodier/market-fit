"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Search, Filter, ChevronLeft, ChevronRight, ExternalLink, Pencil, Trash2, Send, Printer, CreditCard } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getSales, deleteSale, updateSale } from "./actions"
import { toast } from "sonner"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import React from "react"
import { Separator } from "@/app/components/ui/separator"
import { Skeleton } from "@/app/components/ui/skeleton"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format } from "date-fns"
import { Sale } from "@/app/types"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { useRouter } from "next/navigation"
import { RegisterPaymentDialog } from "./components/RegisterPaymentDialog"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { KanbanView } from "./components/KanbanView"
import { CreateSaleDialog } from "./components/CreateSaleDialog"
import { useCommandK } from "@/app/hooks/use-command-k"

// Constants
const NO_SEGMENT = "no_segment"

// Status colors for sales
const STATUS_STYLES = {
  draft: "bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200",
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
  refunded: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200"
}

// Source colors for sales
const SOURCE_STYLES = {
  retail: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  online: "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200"
}

interface SalesTableProps {
  sales: Sale[]
  currentPage: number
  itemsPerPage: number
  totalSales: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onSaleClick: (sale: Sale) => void
  onSendSale: (sale: Sale) => void
  onPrintSale: (sale: Sale) => void
  onRegisterPayment: (sale: Sale) => void
}

function SalesTable({ 
  sales,
  currentPage,
  itemsPerPage,
  totalSales,
  onPageChange,
  onItemsPerPageChange,
  onSaleClick,
  onSendSale,
  onPrintSale,
  onRegisterPayment
}: SalesTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalSales / itemsPerPage)
  const { segments } = useSalesContext()
  const { currentSite } = useSite()
  
  // Function to get segment name from its ID
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Function to truncate text
  const truncateText = (text: any, maxLength: number = 15) => {
    if (!text) return "-"
    if (typeof text === 'object') {
      if (text.name) return String(text.name)
      return "-"
    }
    const stringValue = String(text)
    if (stringValue.length <= maxLength) return stringValue
    return `${stringValue.substring(0, maxLength)}...`
  }

  // Function to format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, 'MMM d, yyyy')
    } catch (error) {
      return dateString
    }
  }

  // Calculate total amount and total amount due for footer
  const totalAmount = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
  const totalAmountDue = sales.reduce((sum, sale) => sum + (sale.amount_due || 0), 0);
  
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Product</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Amount Due</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {sales.length > 0 ? (
              sales.map((sale) => (
                <TableRow 
                  key={sale.id}
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onSaleClick(sale)}
                >
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">{String(sale.title || '')}</p>
                      <p className="text-xs text-muted-foreground">{String(sale.productName || '')}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(sale.amount)}
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {formatCurrency(sale.amount_due)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {sale.leadName || "Anonymous Customer"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {truncateText(getSegmentName(sale.segmentId))}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_STYLES[sale.status]}`}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${SOURCE_STYLES[sale.source]}`}>
                      {sale.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDate(sale.saleDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {sale.amount_due > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRegisterPayment(sale)
                          }}
                        >
                          <CreditCard className="h-4 w-4" />
                          <span className="sr-only">Register Payment</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSendSale(sale)
                        }}
                      >
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Send</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPrintSale(sale)
                        }}
                      >
                        <Printer className="h-4 w-4" />
                        <span className="sr-only">Print</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No sales found.
                </TableCell>
              </TableRow>
            )}
        </TableBody>
        <tfoot className="border-t">
          <tr>
            <TableCell className="font-semibold">Total</TableCell>
            <TableCell className="font-semibold">{formatCurrency(totalAmount)}</TableCell>
            <TableCell className="font-semibold text-primary">{formatCurrency(totalAmountDue)}</TableCell>
            <TableCell colSpan={6}></TableCell>
          </tr>
        </tfoot>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalSales)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalSales)}</span> of <span className="font-medium">{totalSales}</span> sales
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={onItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(page)}
                className={`!min-w-0 h-8 w-8 p-0 font-medium transition-colors ${
                  currentPage === page 
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Context for segments
interface SalesContextType {
  segments: Array<{ id: string; name: string }>
  campaigns: Array<{ id: string; title: string }>
}

const SalesContext = React.createContext<SalesContextType>({
  segments: [],
  campaigns: []
})

const useSalesContext = () => React.useContext(SalesContext)

// Skeleton component for loading state
function SalesTableSkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[150px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(5).fill(0).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </Card>
  )
}

// SendSaleDialog component
interface SendSaleDialogProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updatedSale: Sale) => void
}

function SendSaleDialog({ sale, open, onOpenChange, onSave }: SendSaleDialogProps) {
  const [formData, setFormData] = useState<Partial<Sale>>({})
  const { segments } = useSalesContext()

  useEffect(() => {
    if (sale) {
      // Initialize form data with the sale values
      const initialFormData = { ...sale };
      // Handle segmentId specifically to avoid type issues
      if (initialFormData.segmentId === null || initialFormData.segmentId === undefined) {
        initialFormData.segmentId = NO_SEGMENT as any;
      }
      setFormData(initialFormData);
    }
  }, [sale])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) : value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (sale && formData) {
      const updatedSale = {
        ...sale,
        ...formData,
      };
      
      // Convert NO_SEGMENT back to null for the segmentId
      if (updatedSale.segmentId === NO_SEGMENT) {
        updatedSale.segmentId = null;
      }
      
      onSave(updatedSale);
    }
  }

  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Sale</DialogTitle>
          <DialogDescription>
            Prepare the sale information to send.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title || ''}
                onChange={handleChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="productName" className="text-right">
                Product
              </Label>
              <Input
                id="productName"
                name="productName"
                value={formData.productName || ''}
                onChange={handleChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                value={formData.amount || 0}
                onChange={handleChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="leadName" className="text-right">
                Customer
              </Label>
              <Input
                id="leadName"
                name="leadName"
                value={formData.leadName || ''}
                onChange={handleChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                name="status"
                value={formData.status}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    status: value as 'pending' | 'completed' | 'cancelled' | 'refunded'
                  }))
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="source" className="text-right">
                Source
              </Label>
              <Select
                name="source"
                value={formData.source}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    source: value as 'retail' | 'online'
                  }))
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="segmentId" className="text-right">
                Segment
              </Label>
              <Select
                name="segmentId"
                value={formData.segmentId || NO_SEGMENT}
                onValueChange={(value) => {
                  setFormData(prev => ({
                    ...prev,
                    segmentId: value
                  }))
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SEGMENT}>No Segment</SelectItem>
                  {segments?.map(segment => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// PrintSaleDialog component
interface PrintSaleDialogProps {
  sale: Sale | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
}

function PrintSaleDialog({ sale, open, onOpenChange, onConfirm }: PrintSaleDialogProps) {
  if (!sale) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Print Sale</DialogTitle>
          <DialogDescription>
            Confirm the sale information before printing.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p><strong>Product:</strong> {sale.title} ({sale.productName})</p>
          <p><strong>Amount:</strong> {formatCurrency(sale.amount)}</p>
          <p><strong>Customer:</strong> {sale.leadName || "Anonymous Customer"}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(sale.id)}>
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SalesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [activeTab, setActiveTab] = useState("all")
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string }>>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useState<ViewType>("table")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { currentSite } = useSite()
  const router = useRouter()
  
  // Use the command+k hook
  useCommandK()
  
  // States for dialog controls
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [registerPaymentOpen, setRegisterPaymentOpen] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  
  // Function to load sales data
  const loadSales = async () => {
    if (!currentSite?.id) return

    setLoading(true)
    try {
      const result = await getSales(currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      setSales(result.sales || [])
    } catch (error) {
      console.error("Error loading sales:", error)
      toast.error("Error loading sales")
    } finally {
      setLoading(false)
    }
  }

  // Load sales, segments, and campaigns
  useEffect(() => {
    async function loadSegments() {
      if (!currentSite?.id) return
      
      try {
        const response = await getSegments(currentSite.id)
        if (response.error) {
          console.error(response.error)
          return
        }
        
        if (response.segments) {
          setSegments(response.segments.map(s => ({ id: s.id, name: s.name })))
        }
      } catch (error) {
        console.error("Error loading segments:", error)
      }
    }
    
    async function loadCampaigns() {
      if (!currentSite?.id) return
      
      try {
        const result = await getCampaigns(currentSite.id)
        
        if (result.error) {
          console.error(result.error)
          return
        }
        
        setCampaigns(result.data?.map(c => ({ id: c.id, title: c.title })) || [])
      } catch (error) {
        console.error("Error loading campaigns:", error)
      }
    }

    loadSales()
    loadSegments()
    loadCampaigns()
  }, [currentSite])
  
  // Search query change handler
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  // Create sale success handler
  const handleCreateSuccess = () => {
    loadSales()
  }

  // Effect to handle create dialog state from TopBar
  useEffect(() => {
    const handleCreateSale = () => {
      setIsCreateDialogOpen(true)
    }

    window.addEventListener('sales:create', handleCreateSale)
    return () => {
      window.removeEventListener('sales:create', handleCreateSale)
    }
  }, [])

  // Filter sales based on status and search query
  const getFilteredSales = (status: string) => {
    if (!sales) return []
    
    // First filter by status
    let filtered = sales
    if (status !== "all") {
      filtered = filtered.filter(sale => sale.status === status)
    }
    
    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(sale => 
        sale.title?.toLowerCase().includes(query) || 
        sale.productName?.toLowerCase().includes(query) ||
        sale.leadName?.toLowerCase().includes(query) ||
        formatCurrency(sale.amount).includes(query) ||
        sale.source.toLowerCase().includes(query) ||
        sale.status.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }
  
  const filteredSales = getFilteredSales(activeTab)
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)
  
  // Get sales for current page
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentSales = filteredSales.slice(indexOfFirstItem, indexOfLastItem)
  
  // Page change handler
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Items per page change handler
  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }
  
  // Sale click handler (for future details view)
  const handleSaleClick = (sale: Sale) => {
    router.push(`/sales/${sale.id}`);
  }

  // Send sale handler
  const handleSendSale = (sale: Sale) => {
    setSelectedSale(sale)
    setSendDialogOpen(true)
  }

  // Print sale handler
  const handlePrintSale = (sale: Sale) => {
    setSelectedSale(sale)
    setPrintDialogOpen(true)
  }

  // Register Payment handler
  const handleRegisterPayment = (sale: Sale) => {
    setSelectedSale(sale)
    setRegisterPaymentOpen(true)
  }

  // Handle payment success
  const handlePaymentSuccess = async () => {
    if (!currentSite?.id) return
    
    // Refresh the sales data
    await loadSales()
    toast.success("Payment registered successfully")
  }

  // Save edited sale
  const handleSaveSale = async (updatedSale: Sale) => {
    if (!currentSite?.id) return

    try {
      const result = await updateSale(currentSite.id, updatedSale)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update local state
      setSales(prevSales => 
        prevSales.map(sale => 
          sale.id === updatedSale.id ? updatedSale : sale
        )
      )
      
      toast.success("Sale sent successfully")
      setSendDialogOpen(false)
    } catch (error) {
      console.error("Error sending sale:", error)
      toast.error("Error sending sale")
    }
  }

  // Confirm print sale
  const handleConfirmPrint = async (id: string) => {
    // Simulate printing operation
    toast.success("Sale sent to printer")
    setPrintDialogOpen(false)
  }

  // Function to update sale status (for Kanban view)
  const handleUpdateSaleStatus = async (saleId: string, newStatus: string) => {
    const sale = sales.find(s => s.id === saleId)
    if (!sale || !currentSite?.id) return
    
    try {
      const result = await updateSale(currentSite.id, {
        ...sale,
        status: newStatus as any
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update local state
      setSales(prevSales => 
        prevSales.map(s => 
          s.id === saleId ? { ...s, status: newStatus as any } : s
        )
      )
      
      toast.success("Sale status updated successfully")
    } catch (error) {
      console.error("Error updating sale status:", error)
      toast.error("Error updating sale status")
    }
  }

  return (
    <SalesContext.Provider value={{ segments, campaigns }}>
      <div className="flex-1 p-0">
        <Tabs defaultValue={activeTab} className="h-full space-y-6">
          <StickyHeader>
            <div className="px-16 pt-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-8">
                  <TabsList>
                    <TabsTrigger value="all" className="text-sm font-medium">All Sales</TabsTrigger>
                    <TabsTrigger value="draft" className="text-sm font-medium">Draft</TabsTrigger>
                    <TabsTrigger value="pending" className="text-sm font-medium">Pending</TabsTrigger>
                    <TabsTrigger value="completed" className="text-sm font-medium">Completed</TabsTrigger>
                    <TabsTrigger value="cancelled" className="text-sm font-medium">Cancelled</TabsTrigger>
                    <TabsTrigger value="refunded" className="text-sm font-medium">Refunded</TabsTrigger>
                  </TabsList>
                  <div className="relative w-64">
                    <Input 
                      data-command-k-input
                      placeholder="Search sales..." 
                      className="w-full" 
                      icon={<Search className="h-4 w-4 text-muted-foreground" />}
                      value={searchQuery}
                      onChange={handleSearchChange}
                    />
                    <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <ViewSelector currentView={viewType} onViewChange={setViewType} />
                </div>
              </div>
            </div>
          </StickyHeader>
          
          <div className="p-8 space-y-4">
            <div className="px-8">
              {loading ? (
                <SalesTableSkeleton />
              ) : (
                <>
                  <TabsContent value="all" className="space-y-4">
                    {viewType === "table" ? (
                      <SalesTable
                        sales={currentSales}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalSales={filteredSales.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    ) : (
                      <KanbanView 
                        sales={filteredSales}
                        onUpdateSaleStatus={handleUpdateSaleStatus}
                        segments={segments}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="draft" className="space-y-4">
                    {viewType === "table" ? (
                      <SalesTable
                        sales={currentSales}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalSales={filteredSales.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    ) : (
                      <KanbanView 
                        sales={filteredSales}
                        onUpdateSaleStatus={handleUpdateSaleStatus}
                        segments={segments}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="pending" className="space-y-4">
                    {viewType === "table" ? (
                      <SalesTable
                        sales={currentSales}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalSales={filteredSales.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    ) : (
                      <KanbanView 
                        sales={filteredSales}
                        onUpdateSaleStatus={handleUpdateSaleStatus}
                        segments={segments}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="completed" className="space-y-4">
                    {viewType === "table" ? (
                      <SalesTable
                        sales={currentSales}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalSales={filteredSales.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    ) : (
                      <KanbanView 
                        sales={filteredSales}
                        onUpdateSaleStatus={handleUpdateSaleStatus}
                        segments={segments}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="cancelled" className="space-y-4">
                    {viewType === "table" ? (
                      <SalesTable
                        sales={currentSales}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalSales={filteredSales.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    ) : (
                      <KanbanView 
                        sales={filteredSales}
                        onUpdateSaleStatus={handleUpdateSaleStatus}
                        segments={segments}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    )}
                  </TabsContent>
                  
                  <TabsContent value="refunded" className="space-y-4">
                    {viewType === "table" ? (
                      <SalesTable
                        sales={currentSales}
                        currentPage={currentPage}
                        itemsPerPage={itemsPerPage}
                        totalSales={filteredSales.length}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    ) : (
                      <KanbanView 
                        sales={filteredSales}
                        onUpdateSaleStatus={handleUpdateSaleStatus}
                        segments={segments}
                        onSaleClick={handleSaleClick}
                        onSendSale={handleSendSale}
                        onPrintSale={handlePrintSale}
                        onRegisterPayment={handleRegisterPayment}
                      />
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </div>
        </Tabs>
        
        {/* Send Sale Dialog */}
        <SendSaleDialog
          sale={selectedSale}
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          onSave={handleSaveSale}
        />
        
        {/* Print Sale Dialog */}
        <PrintSaleDialog
          sale={selectedSale}
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          onConfirm={handleConfirmPrint}
        />

        {/* Register Payment Dialog */}
        <RegisterPaymentDialog
          sale={selectedSale}
          open={registerPaymentOpen}
          onOpenChange={setRegisterPaymentOpen}
          onSuccess={handlePaymentSuccess}
        />

        {/* Create Sale Dialog */}
        <CreateSaleDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={handleCreateSuccess}
        />
      </div>
    </SalesContext.Provider>
  )
} 