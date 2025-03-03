"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { ChevronLeft, ChevronRight, Search } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"

interface Lead {
  id: string
  name: string
  email: string
  company: string
  position: string
  segment: string
  status: "new" | "contacted" | "qualified" | "converted" | "lost"
  createdAt: string
}

const leads: Lead[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john.smith@company.com",
    company: "Tech Corp",
    position: "CTO",
    segment: "Enterprise",
    status: "new",
    createdAt: "2024-01-15"
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah.j@startup.io",
    company: "Startup.io",
    position: "CEO",
    segment: "SMB",
    status: "contacted",
    createdAt: "2024-01-16"
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "mbrown@enterprise.com",
    company: "Enterprise Inc",
    position: "Head of Product",
    segment: "Enterprise",
    status: "qualified",
    createdAt: "2024-01-17"
  },
  {
    id: "4",
    name: "Emily Davis",
    email: "emily@growthco.com",
    company: "Growth Co",
    position: "Marketing Director",
    segment: "Mid-Market",
    status: "converted",
    createdAt: "2024-01-18"
  },
  {
    id: "5",
    name: "David Wilson",
    email: "david@smallbiz.com",
    company: "Small Biz",
    position: "Owner",
    segment: "SMB",
    status: "lost",
    createdAt: "2024-01-19"
  },
  {
    id: "6",
    name: "Ana Martínez",
    email: "ana.m@techstart.com",
    company: "TechStart",
    position: "CTO",
    segment: "SMB",
    status: "new",
    createdAt: "2024-01-20"
  },
  {
    id: "7",
    name: "Robert Chen",
    email: "robert@bigtech.com",
    company: "BigTech Solutions",
    position: "Engineering Manager",
    segment: "Enterprise",
    status: "contacted",
    createdAt: "2024-01-21"
  },
  {
    id: "8",
    name: "Laura Thompson",
    email: "laura@digitalco.com",
    company: "Digital Co",
    position: "Product Manager",
    segment: "Mid-Market",
    status: "qualified",
    createdAt: "2024-01-22"
  },
  {
    id: "9",
    name: "Carlos Rodriguez",
    email: "carlos@innovate.io",
    company: "Innovate.io",
    position: "CEO",
    segment: "SMB",
    status: "converted",
    createdAt: "2024-01-23"
  },
  {
    id: "10",
    name: "Sophie Wang",
    email: "sophie@techglobal.com",
    company: "TechGlobal",
    position: "VP Sales",
    segment: "Enterprise",
    status: "lost",
    createdAt: "2024-01-24"
  },
  {
    id: "11",
    name: "James Miller",
    email: "james@cloudtech.com",
    company: "CloudTech",
    position: "Solutions Architect",
    segment: "Enterprise",
    status: "new",
    createdAt: "2024-01-25"
  },
  {
    id: "12",
    name: "Elena Popov",
    email: "elena@devshop.com",
    company: "DevShop",
    position: "Lead Developer",
    segment: "SMB",
    status: "contacted",
    createdAt: "2024-01-26"
  },
  {
    id: "13",
    name: "Daniel Kim",
    email: "daniel@aitech.com",
    company: "AITech",
    position: "AI Research Lead",
    segment: "Mid-Market",
    status: "qualified",
    createdAt: "2024-01-27"
  },
  {
    id: "14",
    name: "Isabella Santos",
    email: "isabella@datawise.com",
    company: "DataWise",
    position: "Data Science Director",
    segment: "Enterprise",
    status: "converted",
    createdAt: "2024-01-28"
  },
  {
    id: "15",
    name: "Thomas Anderson",
    email: "thomas@matrix.com",
    company: "Matrix Systems",
    position: "Security Officer",
    segment: "Mid-Market",
    status: "lost",
    createdAt: "2024-01-29"
  }
]

interface LeadsTableProps {
  leads: Lead[]
  currentPage: number
  itemsPerPage: number
  totalLeads: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
}

function LeadsTable({ 
  leads,
  currentPage,
  itemsPerPage,
  totalLeads,
  onPageChange,
  onItemsPerPageChange
}: LeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalLeads / itemsPerPage)

  const statusStyles = {
    new: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
    contacted: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200", 
    qualified: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    converted: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    lost: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Name</TableHead>
            <TableHead className="w-[200px]">Company</TableHead>
            <TableHead className="w-[150px]">Position</TableHead>
            <TableHead className="w-[120px]">Segment</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[120px]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow 
              key={lead.id}
              className="group hover:bg-muted/50 transition-colors"
            >
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {lead.company}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {lead.position}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {lead.segment}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={statusStyles[lead.status]}>
                  {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(lead.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium">{indexOfFirstItem + 1}</span> a{" "}
            <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalLeads)}</span> de{" "}
            <span className="font-medium">{totalLeads}</span> registros
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={onItemsPerPageChange}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder="5" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">por página</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Página anterior</span>
          </Button>
          <div className="flex items-center gap-2">
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
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Página siguiente</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default function LeadsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [activeTab, setActiveTab] = useState("all")
  
  const getFilteredLeads = (status: string) => {
    if (status === "all") return leads
    return leads.filter(lead => lead.status === status)
  }
  
  const filteredLeads = getFilteredLeads(activeTab)
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  
  // Calcular los leads que se mostrarán en la página actual
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem)
  
  // Funciones para cambiar de página
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  // Reset página cuando cambia el tab
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Función para cambiar items por página
  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Leads</TabsTrigger>
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="contacted">Contacted</TabsTrigger>
                  <TabsTrigger value="qualified">Qualified</TabsTrigger>
                  <TabsTrigger value="converted">Converted</TabsTrigger>
                  <TabsTrigger value="lost">Lost</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Input 
                  placeholder="Search leads..." 
                  className="w-full" 
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                />
                <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="new" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="contacted" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="qualified" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="converted" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="lost" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 