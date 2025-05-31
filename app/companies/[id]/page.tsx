"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { getCompanyById, updateCompany, deleteCompany, getSubsidiaries } from "@/app/companies/actions"
import { Company } from "@/app/companies/types"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { CompanyLegalTab } from "@/app/leads/components/CompanyLegalTab"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { COMPANY_INDUSTRIES, COMPANY_SIZES, COMPANY_ANNUAL_REVENUES, getDisplayName } from "@/app/companies/types"
import { Globe, Tag, User, ExternalLink, Home, CalendarIcon, DollarSign, Users, Phone, Mail, Copy } from "@/app/components/ui/icons"
import { MapPin } from "@/app/leads/components/custom-icons"
import { Badge } from "@/app/components/ui/badge"
import { cn } from "@/lib/utils"

export default function CompanyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [company, setCompany] = useState<Company | null>(null)
  const [subsidiaries, setSubsidiaries] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Company | null>(null)

  useEffect(() => {
    if (params?.id) {
      loadCompany()
      loadSubsidiaries()
    }
  }, [params?.id])

  useEffect(() => {
    if (company) {
      document.title = `${getDisplayName(company)} | Companies`
    }
    
    return () => {
      document.title = 'Companies | Market Fit'
    }
  }, [company])

  const loadCompany = async () => {
    if (!params?.id) return
    
    setLoading(true)
    try {
      const { company: companyData, error } = await getCompanyById(params.id as string)
      
      if (error || !companyData) {
        toast.error(error || "Company not found")
        router.push("/companies")
        return
      }
      
      setCompany(companyData)
      setEditForm(companyData)
    } catch (error) {
      console.error("Error loading company:", error)
      toast.error("Error loading company")
      router.push("/companies")
    } finally {
      setLoading(false)
    }
  }

  const loadSubsidiaries = async () => {
    if (!params?.id) return
    
    try {
      const { subsidiaries: subsidiariesData, error } = await getSubsidiaries(params.id as string)
      
      if (error) {
        console.error(error)
        return
      }
      
      setSubsidiaries(subsidiariesData || [])
    } catch (error) {
      console.error("Error loading subsidiaries:", error)
    }
  }

  const handleSave = async () => {
    if (!editForm) return

    try {
      const { company: updatedCompany, error } = await updateCompany(editForm)
      
      if (error) {
        toast.error(error)
        return
      }

      if (updatedCompany) {
        setCompany(updatedCompany)
        setEditForm(updatedCompany)
        setIsEditing(false)
        toast.success("Company updated successfully")
      }
    } catch (error) {
      console.error("Error updating company:", error)
      toast.error("Error updating company")
    }
  }

  const handleCancel = () => {
    setEditForm(company)
    setIsEditing(false)
  }

  const handleFieldUpdate = (field: keyof Company, value: any) => {
    if (!editForm) return
    setEditForm(prev => prev ? { ...prev, [field]: value } : null)
  }

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      toast.success("Profile link copied to clipboard")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        {/* Loading Cover */}
        <div className="h-48 sm:h-80 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse relative">
          {/* Avatar skeleton positioned over cover */}
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
            <div className="w-32 h-32 sm:w-40 sm:h-40 bg-gray-200 rounded-2xl animate-pulse"></div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Company Info Bar Skeleton */}
          <div className="pt-20 sm:pt-24 pb-6">
            <div className="text-center space-y-4">
              <div className="h-10 bg-gray-200 rounded w-1/3 mx-auto animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-1/4 mx-auto animate-pulse"></div>
              <div className="flex justify-center gap-4">
                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
              </div>
              <div className="flex justify-center gap-3">
                <div className="h-10 bg-gray-200 rounded w-28 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded w-20 animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-96 bg-gray-200 rounded-xl animate-pulse"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Home className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Company not found</h1>
          <p className="text-muted-foreground mb-6">The company you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => router.push("/companies")}>
            Back to Companies
          </Button>
        </div>
      </div>
    )
  }

  // Helper function to generate company avatar
  const getCompanyInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  // Helper function to generate random gradient based on company name
  const getCompanyGradient = (name: string) => {
    // Create a simple hash from the company name
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    // Define color palettes for gradients
    const gradients = [
      'from-blue-600 via-purple-600 to-indigo-700',
      'from-emerald-500 via-teal-600 to-cyan-700',
      'from-orange-500 via-red-500 to-pink-600',
      'from-violet-500 via-purple-500 to-indigo-600',
      'from-green-500 via-emerald-500 to-teal-600',
      'from-yellow-500 via-orange-500 to-red-500',
      'from-pink-500 via-rose-500 to-red-500',
      'from-indigo-500 via-blue-500 to-cyan-500',
      'from-purple-500 via-pink-500 to-rose-500',
      'from-teal-500 via-cyan-500 to-blue-500',
      'from-rose-500 via-pink-500 to-purple-500',
      'from-amber-500 via-yellow-500 to-orange-500'
    ]
    
    // Use hash to select gradient
    const index = Math.abs(hash) % gradients.length
    return gradients[index]
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Cover Image Section */}
      <div className={`relative h-48 sm:h-80 bg-gradient-to-br ${getCompanyGradient(getDisplayName(company))}`}>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
        
        {/* Company Avatar positioned over cover */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
          <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white border-4 border-white rounded-2xl shadow-xl flex items-center justify-center overflow-hidden">
            <span className="text-2xl sm:text-3xl font-bold text-gray-700">
              {getCompanyInitials(getDisplayName(company))}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Company Info Bar */}
        <div className="pt-20 sm:pt-24 pb-6">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{getDisplayName(company)}</h1>
            {company.legal_name && company.legal_name !== company.name && (
              <p className="text-gray-600 text-lg mb-4">Legal name: {company.legal_name}</p>
            )}
            
            {/* Industry & Location - Centered */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
              {company.industry && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors text-base px-4 py-2">
                  {COMPANY_INDUSTRIES.find(i => i.id === company.industry)?.name || company.industry}
                </Badge>
              )}
              {company.address?.city && (
                <div className="flex items-center text-gray-600 text-base">
                  <MapPin className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>
                    {company.address.city}{company.address.country && `, ${company.address.country}`}
                  </span>
                </div>
              )}
              {company.website && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => window.open(company.website, '_blank')}
                  className="text-blue-600 hover:text-blue-700 text-base font-normal transition-colors"
                >
                  <Globe className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>Visit website</span>
                </Button>
              )}
            </div>

            {/* Action Buttons - Centered */}
            <div className="flex gap-3 justify-center">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleCancel} className="transition-all hover:bg-gray-50 px-6">
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="transition-all hover:shadow-md px-6">
                    Save Changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="transition-all hover:bg-gray-50 hover:shadow-sm px-6"
                  >
                    Edit Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleShare}
                    className="transition-all hover:bg-gray-50 hover:shadow-sm px-6"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* About Section */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  About
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-[5px]">Description</p>
                    {isEditing ? (
                      <Textarea
                        value={editForm?.description || ""}
                        onChange={(e) => handleFieldUpdate('description', e.target.value)}
                        className="min-h-[120px] text-base resize-none transition-all focus:ring-2 focus:ring-blue-500 w-full"
                        placeholder="Tell us about this company..."
                      />
                    ) : (
                      <div className="prose prose-gray max-w-none">
                        <p className="text-sm font-medium leading-relaxed break-words">
                          {company.description || (
                            <span className="text-muted-foreground italic">No description available for this company.</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Tabs */}
            <Card className="transition-shadow hover:shadow-md">
              <Tabs defaultValue="details" className="w-full">
                <CardHeader className="pb-4">
                  <TabsList className="grid w-full grid-cols-3 bg-gray-100">
                    <TabsTrigger value="details" className="transition-all">Details</TabsTrigger>
                    <TabsTrigger value="location" className="transition-all">Location</TabsTrigger>
                    <TabsTrigger value="legal" className="transition-all">Legal</TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent>
                  <TabsContent value="details" className="space-y-6 mt-0">
                    {/* Website */}
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                        <Globe className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-[5px]">Website</p>
                        {isEditing ? (
                          <Input
                            value={editForm?.website || ""}
                            onChange={(e) => handleFieldUpdate('website', e.target.value)}
                            placeholder="https://company.com"
                            className="h-12 text-sm"
                          />
                        ) : (
                          <div className="flex items-center justify-between min-w-0">
                            <p className="text-sm font-medium truncate pr-2">
                              {company?.website || "Not specified"}
                            </p>
                            {company?.website && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(company.website, '_blank')}
                                className="h-8 ml-2 flex-shrink-0"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Industry */}
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                        <Tag className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-[5px]">Industry</p>
                        {isEditing ? (
                          <Select
                            value={editForm?.industry || "none"}
                            onValueChange={(value) => handleFieldUpdate('industry', value === "none" ? undefined : value)}
                          >
                            <SelectTrigger className="h-12 text-sm">
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not specified</SelectItem>
                              {COMPANY_INDUSTRIES.map(industry => (
                                <SelectItem key={industry.id} value={industry.id}>
                                  {industry.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm font-medium truncate">
                            {company?.industry ? 
                              COMPANY_INDUSTRIES.find(i => i.id === company.industry)?.name || company.industry 
                              : "Not specified"
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Company Size */}
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-[5px]">Company Size</p>
                        {isEditing ? (
                          <Select
                            value={editForm?.size || "none"}
                            onValueChange={(value) => handleFieldUpdate('size', value === "none" ? undefined : value)}
                          >
                            <SelectTrigger className="h-12 text-sm">
                              <SelectValue placeholder="Select company size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not specified</SelectItem>
                              {COMPANY_SIZES.map(size => (
                                <SelectItem key={size.id} value={size.id}>
                                  {size.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm font-medium truncate">
                            {company?.size ? 
                              COMPANY_SIZES.find(s => s.id === company.size)?.name || company.size 
                              : "Not specified"
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Founded */}
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                        <CalendarIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-[5px]">Founded</p>
                        {isEditing ? (
                          <Input
                            value={editForm?.founded || ""}
                            onChange={(e) => handleFieldUpdate('founded', e.target.value)}
                            placeholder="2020"
                            className="h-12 text-sm"
                          />
                        ) : (
                          <p className="text-sm font-medium truncate">
                            {company?.founded || "Not specified"}
                          </p>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="location" className="space-y-6 mt-0">
                    <div className="grid gap-4">
                      {/* Street */}
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">Street</p>
                          <p className="text-sm font-medium break-words">
                            {company?.address?.street || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* City */}
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">City</p>
                          <p className="text-sm font-medium truncate">
                            {company?.address?.city || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* State */}
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">State</p>
                          <p className="text-sm font-medium truncate">
                            {company?.address?.state || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* Zip Code */}
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">Zip Code</p>
                          <p className="text-sm font-medium truncate">
                            {company?.address?.zipcode || "Not specified"}
                          </p>
                        </div>
                      </div>

                      {/* Country */}
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">Country</p>
                          <p className="text-sm font-medium truncate">
                            {company?.address?.country || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="legal" className="mt-0">
                    {company && editForm && (
                      <CompanyLegalTab
                        company={editForm}
                        isEditing={isEditing}
                        onFieldUpdate={handleFieldUpdate}
                      />
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Subsidiaries */}
            {subsidiaries.length > 0 && (
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Subsidiaries</span>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                      {subsidiaries.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {subsidiaries.slice(0, 3).map((subsidiary) => (
                    <div 
                      key={subsidiary.id} 
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-gray-200 hover:shadow-sm" 
                      onClick={() => router.push(`/companies/${subsidiary.id}`)}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700">
                          {getCompanyInitials(getDisplayName(subsidiary))}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{getDisplayName(subsidiary)}</p>
                        <p className="text-xs text-gray-600 truncate">
                          {subsidiary.industry && COMPANY_INDUSTRIES.find(i => i.id === subsidiary.industry)?.name}
                        </p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    </div>
                  ))}
                  {subsidiaries.length > 3 && (
                    <Button variant="outline" size="sm" className="w-full transition-all hover:bg-gray-50">
                      View all {subsidiaries.length} subsidiaries
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Contact Info */}
            {(company?.phone || company?.email || company?.address) && (
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {company?.phone && (
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <Phone className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">Phone</p>
                          <p className="text-sm font-medium break-all">{company.phone}</p>
                        </div>
                      </div>
                    )}
                    {company?.email && (
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <Mail className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">Email</p>
                          <p className="text-sm font-medium break-all">{company.email}</p>
                        </div>
                      </div>
                    )}
                    {company?.address && (
                      <div className="flex items-start gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground mb-[5px]">Address</p>
                          <div className="text-sm font-medium">
                            {company.address.street && <div className="mb-1 break-words">{company.address.street}</div>}
                            <div className="break-words">
                              {company.address.city && company.address.city}
                              {company.address.state && `, ${company.address.state}`}
                              {company.address.zipcode && ` ${company.address.zipcode}`}
                            </div>
                            {company.address.country && <div className="mt-1 text-gray-600 break-words">{company.address.country}</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Company Overview */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  Company Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-[5px]">Employees</p>
                      <p className="text-sm font-medium truncate">
                        {company?.size ? COMPANY_SIZES.find(s => s.id === company.size)?.name || company.size : "N/A"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-[5px]">Revenue</p>
                      <p className="text-sm font-medium truncate">
                        {company?.annual_revenue ? COMPANY_ANNUAL_REVENUES.find(r => r.id === company.annual_revenue)?.name || company.annual_revenue : "N/A"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                      <CalendarIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-[5px]">Founded</p>
                      <p className="text-sm font-medium truncate">
                        {company?.founded || "N/A"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                      <Tag className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-[5px]">Industry</p>
                      <p className="text-sm font-medium truncate">
                        {company?.industry ? COMPANY_INDUSTRIES.find(i => i.id === company.industry)?.name || company.industry : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Public Company Profile</h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                This public company profile is created collectively by system users and AI agents. 
                Lead information and commercial data are not shared publicly and remain private 
                to ensure privacy protection and commercial confidentiality.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 