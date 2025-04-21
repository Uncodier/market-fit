import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { SkeletonCard } from "@/app/components/ui/skeleton-card"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { ClipboardList, PlusCircle } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useRouter } from "next/navigation"

// Status and priority colors
const STATUS_COLORS: Record<string, string> = {
  'backlog': 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  'in-progress': 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  'on-review': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  'done': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  'validated': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  'canceled': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
};

const PRIORITY_COLORS: Record<string, string> = {
  'high': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
  'low': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
};

// Completion status colors and icons
const COMPLETION_STATUS: Record<string, { color: string, label: string }> = {
  'pending': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', label: 'Pending' },
  'completed': { color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', label: 'Completed' },
  'rejected': { color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', label: 'Rejected' }
};

interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  completion_status: string;
  created_at: string;
  budget?: number;
  segmentNames?: string[];
}

interface CampaignRequirementsProps {
  campaignId: string;
  onOpenCreateRequirement?: () => void;
  renderAddButton?: () => React.ReactNode;
  externalRequirements?: Requirement[];
  externalLoading?: boolean;
}

// Interfaces para los tipos de datos de Supabase
interface RelationData {
  requirement_id: string;
}

interface SegmentRelation {
  segment_id: string;
}

interface SegmentData {
  name: string;
}

export function CampaignRequirements({ 
  campaignId, 
  onOpenCreateRequirement,
  renderAddButton,
  externalRequirements,
  externalLoading
}: CampaignRequirementsProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Add debug logging to track requirements updates
  useEffect(() => {
    console.log("CampaignRequirements component:", { 
      campaignId, 
      externalRequirementsLength: externalRequirements?.length,
      externalLoading
    });
    
    if (externalRequirements !== undefined) {
      console.log("Using external requirements:", externalRequirements);
    }
  }, [campaignId, externalRequirements, externalLoading]);

  // Fetch campaign requirements only if external requirements are not provided
  useEffect(() => {
    // If external requirements are provided, use those
    if (externalRequirements !== undefined) {
      console.log("Setting requirements from external source:", externalRequirements);
      setRequirements(externalRequirements);
      return;
    }
    
    const fetchRequirements = async () => {
      // Skip if external requirements are provided
      if (externalRequirements !== undefined) return;
      
      setLoading(true);
      try {
        const supabase = createClient();
        
        // Get requirement IDs related to this campaign
        const { data: relationData, error: relationError } = await supabase
          .from("campaign_requirements")
          .select("requirement_id")
          .eq("campaign_id", campaignId);
        
        if (relationError) {
          throw new Error(relationError.message);
        }
        
        if (!relationData || relationData.length === 0) {
          console.log("No requirements found via internal fetch for campaign:", campaignId);
          setRequirements([]);
          setLoading(false);
          return;
        }
        
        // Get requirement details for those IDs
        const requirementIds = relationData.map((r: RelationData) => r.requirement_id);
        console.log("Found requirement IDs via internal fetch:", requirementIds);
        
        const { data, error } = await supabase
          .from("requirements")
          .select("*")
          .in("id", requirementIds);
        
        if (error) {
          throw new Error(error.message);
        }
        
        console.log("Retrieved requirements via internal fetch:", data);
        
        // Fetch segments for each requirement
        if (data) {
          const requirementsWithSegments = await Promise.all(
            data.map(async (req: any) => {
              const { data: segmentRelations, error: segmentError } = await supabase
                .from("requirement_segments")
                .select("segment_id")
                .eq("requirement_id", req.id);
              
              if (segmentError) {
                console.error("Error fetching segments:", segmentError);
                return req;
              }
              
              if (segmentRelations && segmentRelations.length > 0) {
                const segmentIds = segmentRelations.map((r: SegmentRelation) => r.segment_id);
                const { data: segmentData } = await supabase
                  .from("segments")
                  .select("name")
                  .in("id", segmentIds);
                
                return {
                  ...req,
                  segmentNames: segmentData?.map((s: SegmentData) => s.name) || []
                };
              }
              
              return req;
            })
          );
          
          console.log("Setting requirements from internal fetch:", requirementsWithSegments);
          setRequirements(requirementsWithSegments);
        }
      } catch (error) {
        console.error("Error fetching requirements:", error);
        toast.error("Failed to load requirements");
      } finally {
        setLoading(false);
      }
    };
    
    if (campaignId) {
      fetchRequirements();
    }
  }, [campaignId, externalRequirements]);

  // Use external loading state if provided
  const isLoading = externalLoading !== undefined ? externalLoading : loading;

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  const navigateToRequirement = (requirementId: string) => {
    router.push(`/requirements/${requirementId}`);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Associated Requirements</h3>
          {renderAddButton ? (
            renderAddButton()
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onOpenCreateRequirement}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Requirement
            </Button>
          )}
        </div>
        
        {isLoading ? (
          <SkeletonCard 
            className="border-none shadow-none" 
            showHeader={false}
            contentClassName="space-y-3"
          />
        ) : (
          <ScrollArea className="rounded-md border">
            {requirements.length === 0 ? (
              <EmptyCard
                icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                title="No requirements yet"
                description="No requirements linked to this campaign yet."
                className="border-none shadow-none py-10"
                contentClassName="flex flex-col items-center justify-center"
              />
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[350px]">Title</TableHead>
                    <TableHead className="w-[150px]">Priority</TableHead>
                    <TableHead className="w-[150px]">Status</TableHead>
                    <TableHead className="w-[150px]">Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((req) => (
                    <TableRow 
                      key={req.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigateToRequirement(req.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{req.title}</div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {req.description}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_COLORS[req.priority]}>
                          {req.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[req.status]}>
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.budget ? (
                          <div className="font-medium">${req.budget.toLocaleString()}</div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
} 