"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

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
    email: "john@techcorp.com",
    company: "TechCorp",
    position: "CTO",
    segment: "Enterprise Decision Makers",
    status: "qualified",
    createdAt: "2024-01-05",
  },
  {
    id: "2",
    name: "Sarah Johnson",
    email: "sarah@innovate.io",
    company: "Innovate.io",
    position: "Product Manager",
    segment: "Product Managers",
    status: "contacted",
    createdAt: "2024-01-10",
  },
  {
    id: "3",
    name: "Michael Chen",
    email: "michael@startupx.com",
    company: "StartupX",
    position: "Founder",
    segment: "Small Business Owners",
    status: "new",
    createdAt: "2024-01-15",
  },
  {
    id: "4",
    name: "Emily Rodriguez",
    email: "emily@growthco.com",
    company: "GrowthCo",
    position: "Marketing Director",
    segment: "Marketing Professionals",
    status: "converted",
    createdAt: "2024-01-08",
  },
  {
    id: "5",
    name: "David Kim",
    email: "david@techblog.com",
    company: "TechBlog",
    position: "Editor",
    segment: "Tech Enthusiasts",
    status: "contacted",
    createdAt: "2024-01-12",
  },
  {
    id: "6",
    name: "Lisa Wang",
    email: "lisa@enterprise.com",
    company: "Enterprise Inc",
    position: "VP of Engineering",
    segment: "Enterprise Decision Makers",
    status: "qualified",
    createdAt: "2024-01-07",
  },
  {
    id: "7",
    name: "James Wilson",
    email: "james@digitalagency.com",
    company: "Digital Agency",
    position: "CEO",
    segment: "Small Business Owners",
    status: "lost",
    createdAt: "2023-12-20",
  },
  {
    id: "8",
    name: "Olivia Martinez",
    email: "olivia@techstartup.com",
    company: "Tech Startup",
    position: "Product Owner",
    segment: "Early Adopters",
    status: "new",
    createdAt: "2024-01-18",
  },
]

export default function LeadsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  const totalPages = Math.ceil(leads.length / itemsPerPage)
  const [activeTab, setActiveTab] = useState("1")
  
  // Calcular los leads que se mostrarán en la página actual
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLeads = leads.slice(indexOfFirstItem, indexOfLastItem)
  
  // Funciones para cambiar de página
  function goToNextPage() {
    setCurrentPage(page => Math.min(page + 1, totalPages))
    setActiveTab((Math.min(currentPage + 1, totalPages)).toString())
  }
  
  function goToPreviousPage() {
    setCurrentPage(page => Math.max(page - 1, 1))
    setActiveTab((Math.max(currentPage - 1, 1)).toString())
  }
  
  function goToPage(pageNumber: number) {
    setCurrentPage(pageNumber)
    setActiveTab(pageNumber.toString())
  }

  // Actualizar activeTab cuando cambia currentPage
  useEffect(() => {
    setActiveTab(currentPage.toString())
  }, [currentPage])

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-end pr-0">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-8" />
          <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>All Leads</CardTitle>
          <CardDescription>
            Manage your leads and track their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <div>
                      {lead.name}
                      <div className="text-sm text-muted-foreground">{lead.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      {lead.company}
                      <div className="text-sm text-muted-foreground">{lead.position}</div>
                    </div>
                  </TableCell>
                  <TableCell>{lead.segment}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        lead.status === "new"
                          ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
                          : lead.status === "contacted"
                          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                          : lead.status === "qualified"
                          ? "bg-purple-100 text-purple-800 hover:bg-purple-100"
                          : lead.status === "converted"
                          ? "bg-green-100 text-green-800 hover:bg-green-100"
                          : "bg-red-100 text-red-800 hover:bg-red-100"
                      }
                    >
                      {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Paginación */}
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium">{indexOfFirstItem + 1}</span> a{" "}
              <span className="font-medium">{Math.min(indexOfLastItem, leads.length)}</span> de{" "}
              <span className="font-medium">{leads.length}</span> registros
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Página anterior</span>
              </Button>
              <Tabs value={activeTab} onValueChange={(value) => goToPage(parseInt(value))}>
                <TabsList className="h-8">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <TabsTrigger
                      key={page}
                      value={page.toString()}
                      className="px-3 py-0 h-full data-[state=active]:shadow-none"
                    >
                      {page}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="h-8 px-2"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Página siguiente</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 