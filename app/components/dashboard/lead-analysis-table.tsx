"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Search, Filter, Eye, Phone, Mail, Calendar, TrendingUp, DollarSign, Users, Target } from "@/app/components/ui/icons";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { getLeadAnalyses, updateLeadStatus } from "@/app/roi-calculator/actions";
import { toast } from "sonner";
import { format } from "date-fns";

interface LeadAnalysis {
  id: string;
  company_name: string;
  industry: string;
  company_size: string;
  annual_revenue: string;
  status: 'draft' | 'completed' | 'reviewed' | 'contacted' | 'converted';
  completion_percentage: number;
  analysis_results: any;
  contact_info: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  completed: "bg-blue-100 text-blue-800",
  reviewed: "bg-yellow-100 text-yellow-800",
  contacted: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
};

const statusLabels = {
  draft: "Draft",
  completed: "Completed",
  reviewed: "Reviewed",
  contacted: "Contacted",
  converted: "Converted",
};

export function LeadAnalysisTable() {
  const [analyses, setAnalyses] = useState<LeadAnalysis[]>([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState<LeadAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [selectedAnalysis, setSelectedAnalysis] = useState<LeadAnalysis | null>(null);

  // Load analyses
  useEffect(() => {
    loadAnalyses();
  }, []);

  // Filter analyses
  useEffect(() => {
    let filtered = analyses;

    if (searchTerm) {
      filtered = filtered.filter(analysis =>
        analysis.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        analysis.industry.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(analysis => analysis.status === statusFilter);
    }

    if (industryFilter !== "all") {
      filtered = filtered.filter(analysis => analysis.industry === industryFilter);
    }

    setFilteredAnalyses(filtered);
  }, [analyses, searchTerm, statusFilter, industryFilter]);

  const loadAnalyses = async () => {
    setLoading(true);
    const result = await getLeadAnalyses();
    if (result.success) {
      setAnalyses(result.data);
    } else {
      toast.error("Failed to load lead analyses");
    }
    setLoading(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: LeadAnalysis['status']) => {
    const result = await updateLeadStatus(id, newStatus);
    if (result.success) {
      setAnalyses(prev => prev.map(analysis => 
        analysis.id === id ? { ...analysis, status: newStatus } : analysis
      ));
      toast.success("Status updated successfully");
    } else {
      toast.error("Failed to update status");
    }
  };

  const getUniqueIndustries = () => {
    const industries = [...new Set(analyses.map(a => a.industry))];
    return industries.filter(Boolean);
  };

  const getAnalysisStats = () => {
    const total = analyses.length;
    const completed = analyses.filter(a => a.status === 'completed').length;
    const contacted = analyses.filter(a => a.status === 'contacted').length;
    const converted = analyses.filter(a => a.status === 'converted').length;
    const avgCompletion = analyses.length > 0 
      ? analyses.reduce((sum, a) => sum + a.completion_percentage, 0) / analyses.length 
      : 0;

    return { total, completed, contacted, converted, avgCompletion };
  };

  const stats = getAnalysisStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Contacted</p>
                <p className="text-2xl font-bold">{stats.contacted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="text-2xl font-bold">{stats.converted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Completion</p>
                <p className="text-2xl font-bold">{Math.round(stats.avgCompletion)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Analyses</CardTitle>
          <CardDescription>
            Manage and track ROI calculator submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or industry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {getUniqueIndustries().map(industry => (
                  <SelectItem key={industry} value={industry}>
                    {industry.charAt(0).toUpperCase() + industry.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnalyses.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell className="font-medium">
                      {analysis.company_name}
                    </TableCell>
                    <TableCell>
                      {analysis.industry?.charAt(0).toUpperCase() + analysis.industry?.slice(1)}
                    </TableCell>
                    <TableCell>{analysis.company_size}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[analysis.status]}>
                        {statusLabels[analysis.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${analysis.completion_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {analysis.completion_percentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(analysis.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedAnalysis(analysis)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{analysis.company_name} - Analysis Details</DialogTitle>
                              <DialogDescription>
                                ROI Calculator submission details and analysis results
                              </DialogDescription>
                            </DialogHeader>
                            {selectedAnalysis && (
                              <AnalysisDetailView 
                                analysis={selectedAnalysis} 
                                onStatusUpdate={handleStatusUpdate}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Select
                          value={analysis.status}
                          onValueChange={(value) => handleStatusUpdate(analysis.id, value as LeadAnalysis['status'])}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="reviewed">Reviewed</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAnalyses.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No lead analyses found matching your criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Analysis Detail View Component
function AnalysisDetailView({ 
  analysis, 
  onStatusUpdate 
}: { 
  analysis: LeadAnalysis; 
  onStatusUpdate: (id: string, status: LeadAnalysis['status']) => void;
}) {
  const analysisResults = analysis.analysis_results || {};
  const contactInfo = analysis.contact_info || {};

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
        <TabsTrigger value="contact">Contact</TabsTrigger>
        <TabsTrigger value="actions">Actions</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Company Information</h4>
            <div className="space-y-1 text-sm">
              <p><strong>Name:</strong> {analysis.company_name}</p>
              <p><strong>Industry:</strong> {analysis.industry}</p>
              <p><strong>Size:</strong> {analysis.company_size}</p>
              <p><strong>Revenue:</strong> {analysis.annual_revenue}</p>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Analysis Status</h4>
            <div className="space-y-1 text-sm">
              <p><strong>Status:</strong> 
                <Badge className={`ml-2 ${statusColors[analysis.status]}`}>
                  {statusLabels[analysis.status]}
                </Badge>
              </p>
              <p><strong>Completion:</strong> {analysis.completion_percentage}%</p>
              <p><strong>Created:</strong> {format(new Date(analysis.created_at), 'PPP')}</p>
              {analysis.completed_at && (
                <p><strong>Completed:</strong> {format(new Date(analysis.completed_at), 'PPP')}</p>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="analysis" className="space-y-4">
        {analysisResults.currentROI !== undefined && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Current ROI</p>
                  <p className="text-2xl font-bold text-red-600">
                    {analysisResults.currentROI?.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Projected ROI</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analysisResults.projectedROI?.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Potential Increase</p>
                  <p className="text-2xl font-bold text-blue-600">
                    +{analysisResults.potentialIncrease?.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Revenue Impact</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(analysisResults.projectedRevenue - (analysisResults.currentRevenue || 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {analysisResults.recommendations && (
          <div>
            <h4 className="font-medium mb-2">Recommendations</h4>
            <div className="space-y-2">
              {analysisResults.recommendations.map((rec: any, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline">{rec.priority}</Badge>
                    <div>
                      <h5 className="font-medium">{rec.category}</h5>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      <p className="text-sm text-green-600 mt-1">{rec.expectedImpact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="contact" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Contact Information</h4>
            <div className="space-y-2">
              {contactInfo.name && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{contactInfo.name}</span>
                  {contactInfo.title && <span className="text-muted-foreground">({contactInfo.title})</span>}
                </div>
              )}
              {contactInfo.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${contactInfo.email}`} className="text-blue-600 hover:underline">
                    {contactInfo.email}
                  </a>
                </div>
              )}
              {contactInfo.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${contactInfo.phone}`} className="text-blue-600 hover:underline">
                    {contactInfo.phone}
                  </a>
                </div>
              )}
              {contactInfo.bestTimeToCall && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Best time: {contactInfo.bestTimeToCall}</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Preferences</h4>
            <div className="space-y-1 text-sm">
              {contactInfo.preferredContactMethod && (
                <p><strong>Preferred Contact:</strong> {contactInfo.preferredContactMethod}</p>
              )}
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="actions" className="space-y-4">
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="font-medium mb-2">Update Status</h4>
            <Select
              value={analysis.status}
              onValueChange={(value) => onStatusUpdate(analysis.id, value as LeadAnalysis['status'])}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            {contactInfo.email && (
              <Button asChild>
                <a href={`mailto:${contactInfo.email}?subject=ROI Analysis Follow-up - ${analysis.company_name}`}>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </a>
              </Button>
            )}
            {contactInfo.phone && (
              <Button variant="outline" asChild>
                <a href={`tel:${contactInfo.phone}`}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </a>
              </Button>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
