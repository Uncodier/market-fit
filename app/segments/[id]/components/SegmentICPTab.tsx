import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Users, Settings } from "@/app/components/ui/icons"
import { Segment } from "../page"

interface SegmentICPTabProps {
  segment: Segment
}

export function SegmentICPTab({ segment }: SegmentICPTabProps) {
  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="px-6 pb-2">
        <CardTitle className="text-lg">Ideal Customer Profile</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {segment.icp ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segment.icp.role && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Role</h4>
                <p className="text-base">{segment.icp.role}</p>
              </div>
            )}
            {segment.icp.company_size && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Company Size</h4>
                <p className="text-base">{segment.icp.company_size}</p>
              </div>
            )}
            {segment.icp.industry && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Industry</h4>
                <p className="text-base">{segment.icp.industry}</p>
              </div>
            )}
            {segment.icp.age_range && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Age Range</h4>
                <p className="text-base">{segment.icp.age_range}</p>
              </div>
            )}
            {segment.icp.location && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                <p className="text-base">{segment.icp.location}</p>
              </div>
            )}
            {segment.icp.experience && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Experience</h4>
                <p className="text-base">{segment.icp.experience}</p>
              </div>
            )}
            {segment.icp.budget && (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Budget</h4>
                <p className="text-base">{segment.icp.budget}</p>
              </div>
            )}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Decision Maker</h4>
              <p className="text-base">{segment.icp.decision_maker ? "Yes" : "No"}</p>
            </div>
            {segment.icp.pain_points && segment.icp.pain_points.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg md:col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Pain Points</h4>
                <div className="flex flex-wrap gap-2">
                  {segment.icp.pain_points.map((point, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1">
                      {point}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {segment.icp.goals && segment.icp.goals.length > 0 && (
              <div className="bg-muted/30 p-4 rounded-lg md:col-span-2">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Goals</h4>
                <div className="flex flex-wrap gap-2">
                  {segment.icp.goals.map((goal, idx) => (
                    <Badge key={idx} variant="outline" className="px-2.5 py-1">
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No ICP data available</p>
            <Button variant="outline" className="mt-4">
              <Settings className="mr-2 h-4 w-4" />
              Configure ICP
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 