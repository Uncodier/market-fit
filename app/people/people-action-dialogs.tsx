
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import type { PeopleWorkspace } from "./use-people-workspace"

export function PeopleActionDialogs({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    totalResults,
    addingToLeads,
    isSegmentModalOpen,
    setIsSegmentModalOpen,
    creditsAvailable,
    showBillingLimit,
    requiredCredits,
    hasEnoughCredits,
    segmentsLoading,
    availableSegments,
    selectedSegmentId,
    setSelectedSegmentId,
    icpName,
    setIcpName,
    isIcpModalOpen,
    setIsIcpModalOpen,
    availableIcps,
    icpListLoading,
    icpListError,
    refreshIcps,
    setSelectedIcpId,
    selectedPersonIds,
    isEnriching,
    isConfirmModalOpen,
    setIsConfirmModalOpen,
    isEditIcpModalOpen,
    setIsEditIcpModalOpen,
    setEditingIcp,
    editingIcpName,
    setEditingIcpName,
    editingIcpSegmentValue,
    setEditingIcpSegmentValue,
    editingIcpSegmentsLoading,
    handleLoadIcp,
    handleDeleteIcp,
    handleEditIcp,
    handleConfirmAddToLeads,
    handleEnrich,
  } = workspace
  return (
<>
      {/* Segment selection modal */}
      <Dialog open={isSegmentModalOpen} onOpenChange={setIsSegmentModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add to Campaign / Segment</DialogTitle>
            <DialogDescription>Choose a segment and optional campaign to enrich these leads. This will consume your credits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="mb-4 p-4 rounded-lg border bg-muted/50 space-y-2">
              <div className="flex justify-between items-center text-sm font-medium">
                <span>Total Leads Selected:</span>
                <span>{totalResults.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <span>Estimated Cost:</span>
                <span>{requiredCredits} Credits</span>
              </div>
              <div className="flex justify-between items-center text-sm font-medium">
                <span>Available Credits:</span>
                <span className={cn(hasEnoughCredits ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                  {creditsAvailable.toLocaleString()} Credits
                </span>
              </div>
              {!hasEnoughCredits && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-destructive">
                    You don't have enough credits to execute this enrichment query.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => showBillingLimit({
                      kind: "credits",
                      current: creditsAvailable,
                      limit: requiredCredits,
                    })}
                  >
                    Buy credits
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Segment</p>
            <Select value={selectedSegmentId} onValueChange={(v) => setSelectedSegmentId(v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={segmentsLoading ? 'Loading segments…' : 'Select segment'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No segment</SelectItem>
                {availableSegments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">Campaign (Optional)</p>
              <Input
                placeholder="e.g. Summer 2026 Outreach"
                value={icpName}
                onChange={(e) => setIcpName(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSegmentModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAddToLeads} disabled={addingToLeads || segmentsLoading || !hasEnoughCredits}>
              {addingToLeads ? 'Processing...' : 'Enrich & Start Campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ICP selection modal */}
      <Dialog open={isIcpModalOpen} onOpenChange={setIsIcpModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Load saved lists</DialogTitle>
            <DialogDescription>Select a saved list to load its query.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {icpListLoading ? (
          <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Card key={idx} className="border border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                        <Skeleton className="h-9 w-20 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
            ) : icpListError ? (
              <div role="alert" className="text-center py-8 space-y-3">
                <p className="text-muted-foreground">Could not load saved lists. Please try again.</p>
                <Button variant="outline" size="sm" onClick={refreshIcps}>Retry</Button>
              </div>
            ) : availableIcps.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No saved lists found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableIcps.map((icp) => (
                  <Card
                    key={icp.id}
                    className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedIcpId(icp.id)
                      // Auto-load the selected list
                      handleLoadIcp(icp.id)
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {(icp.name && icp.name.trim()) ? icp.name.charAt(0).toUpperCase() : "L"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">
                              {(icp.name && icp.name.trim()) ? icp.name : `List ${icp.id.slice(0,8)}…`}
                            </h3>
                            {icp.status && (
                              <Badge
                                variant={icp.status === 'completed' ? 'default' : icp.status === 'mining' ? 'secondary' : 'outline'}
                                className="h-5 px-2 text-xs"
                              >
                                {icp.status}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            {icp.status === 'mining' && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Progress: {icp.progress_percent || '0.00'}%</span>
                                  <span className="text-muted-foreground">
                                    {icp.processed_targets || 0} / {icp.total_targets || 0} targets
                                  </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${icp.progress_percent || '0'}%` }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Found {icp.found_matches || 0} matches
                                </p>
                              </div>
                            )}
                            {icp.status === 'completed' && (
                              <p className="text-sm text-muted-foreground">
                                Ready to load • {icp.found_matches || 0} matches found
                              </p>
                            )}
                            {icp.status === 'pending' && (
                              <p className="text-sm text-muted-foreground">
                                Queued for mining
                              </p>
                            )}
                            {!icp.status && (
                              <p className="text-sm text-muted-foreground">
                                Status unknown
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
            <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteIcp(icp.id)
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
            </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLoadIcp(icp.id)
                            }}
                          >
                            Load
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIcpModalOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Enrich confirmation modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Save to lists, enrich and prospect selected people</DialogTitle>
            <DialogDescription>
              Are you sure you want to save to lists, enrich and prospect {selectedPersonIds.length} {selectedPersonIds.length === 1 ? 'person' : 'people'}? This will call the enrich API for each selected person.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)} disabled={isEnriching}>
              Cancel
            </Button>
            <Button onClick={handleEnrich} disabled={isEnriching}>
              {isEnriching ? 'Saving...' : 'Save to lists, enrich and prospect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit ICP name modal */}
      <Dialog open={isEditIcpModalOpen} onOpenChange={setIsEditIcpModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Saved List</DialogTitle>
            <DialogDescription>
              Update the name and segment for this saved list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Name</p>
              <Input
                placeholder="e.g. SaaS US - Heads of Growth"
                value={editingIcpName}
                onChange={(e) => setEditingIcpName(e.target.value)}
                className="h-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleEditIcp()
                  }
                }}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Segment</p>
              {editingIcpSegmentsLoading ? (
                <div className="h-10 flex items-center">
                  <p className="text-xs text-muted-foreground">Loading segments…</p>
                </div>
              ) : (
                <RelationSelect
                  options={availableSegments.map((s) => ({ id: s.id, label: s.name }))}
                  value={editingIcpSegmentValue}
                  onValueChange={setEditingIcpSegmentValue}
                  placeholder="Select segment"
                  emptyMessage="No segments found"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditIcpModalOpen(false)
              setEditingIcp(null)
              setEditingIcpName("")
              setEditingIcpSegmentValue(null)
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditIcp} disabled={!editingIcpName.trim() || editingIcpSegmentsLoading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
</>
  )
}
