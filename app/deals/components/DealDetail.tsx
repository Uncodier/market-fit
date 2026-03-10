import { useState, useEffect } from "react"
import { Deal, DEAL_STAGES, DEAL_STATUSES } from "@/app/deals/types"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Checkbox } from "@/app/components/ui/checkbox"
import { DatePicker } from "@/app/components/ui/date-picker"
import { format } from "date-fns"
import { updateDeal, removeDealContact, getDealById, getSiteQualificationCriteriaKeys, removeDealOwner } from "@/app/deals/actions"
import { toast } from "sonner"
import { Briefcase, Building, Calendar, DollarSign, FileText, Target, Users, Settings, Edit, BarChart, User, PlusCircle, Plus } from "@/app/components/ui/icons"
import { CompanySelector } from "@/app/leads/components/CompanySelector"
import { LinkContactDialog } from "./LinkContactDialog"
import { LinkTeamMemberDialog } from "./LinkTeamMemberDialog"
import { DealSalesOrder } from "./DealSalesOrder"

interface DealDetailProps {
  deal: Deal
  onUpdate: (deal: Deal) => void
  tab?: "summary" | "details"
  onTabChange?: (tab: string) => void
}

export function DealDetail({ deal, onUpdate, tab = "summary", onTabChange }: DealDetailProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLinkContactOpen, setIsLinkContactOpen] = useState(false)
  const [isLinkTeamMemberOpen, setIsLinkTeamMemberOpen] = useState(false)
  
  // Qualifications State
  const [availableCriteriaKeys, setAvailableCriteriaKeys] = useState<string[]>([
    "budget_confirmed",
    "authority_identified",
    "need_established",
    "timeline_agreed"
  ])
  const [criteriaForm, setCriteriaForm] = useState<Record<string, boolean>>({})
  const [newCriterion, setNewCriterion] = useState("")
  const [isAddingCriterion, setIsAddingCriterion] = useState(false)

  const [generalForm, setGeneralForm] = useState({
    name: deal.name || "",
    amount: deal.amount?.toString() || "",
    expected_close_date: deal.expected_close_date ? new Date(deal.expected_close_date).toISOString().split('T')[0] : "",
    company_id: deal.company_id || "",
  })
  
  const [stageForm, setStageForm] = useState({
    stage: deal.stage || "prospecting",
    status: deal.status || "open"
  })

  const [notesForm, setNotesForm] = useState({
    notes: deal.notes || ""
  })

  useEffect(() => {
    setGeneralForm({
      name: deal.name || "",
      amount: deal.amount?.toString() || "",
      expected_close_date: deal.expected_close_date ? new Date(deal.expected_close_date).toISOString().split('T')[0] : "",
      company_id: deal.company_id || "",
    })
    setStageForm({
      stage: deal.stage || "prospecting",
      status: deal.status || "open"
    })
    setNotesForm({
      notes: deal.notes || ""
    })
    setCriteriaForm(deal.qualification_criteria || {})
  }, [deal])

  useEffect(() => {
    async function loadCriteriaKeys() {
      if (!deal.site_id) return
      const result = await getSiteQualificationCriteriaKeys(deal.site_id)
      if (result.keys && result.keys.length > 0) {
        setAvailableCriteriaKeys(prev => {
          const combined = new Set([...prev, ...result.keys])
          return Array.from(combined)
        })
      }
    }
    loadCriteriaKeys()
  }, [deal.site_id])

  const handleSaveGeneral = async () => {
    setIsUpdating(true)
    try {
      const updates = {
        id: deal.id,
        name: generalForm.name,
        amount: generalForm.amount ? parseFloat(generalForm.amount) : null,
        expected_close_date: generalForm.expected_close_date || null,
        company_id: generalForm.company_id || null,
      }
      const result = await updateDeal(updates)
      if (result.error) {
        toast.error(result.error)
      } else if (result.deal) {
        toast.success("General information updated")
        onUpdate(result.deal)
      }
    } catch (e) {
      toast.error("Failed to update general information")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveStage = async () => {
    setIsUpdating(true)
    try {
      const updates = {
        id: deal.id,
        stage: stageForm.stage as Deal["stage"],
        status: stageForm.status as Deal["status"]
      }
      const result = await updateDeal(updates)
      if (result.error) {
        toast.error(result.error)
      } else if (result.deal) {
        toast.success("Pipeline stage updated")
        onUpdate(result.deal)
      }
    } catch (e) {
      toast.error("Failed to update pipeline stage")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    setIsUpdating(true)
    try {
      const result = await updateDeal({ id: deal.id, notes: notesForm.notes })
      if (result.error) {
        toast.error(result.error)
      } else if (result.deal) {
        toast.success("Notes updated")
        onUpdate(result.deal)
      }
    } catch (e) {
      toast.error("Failed to update notes")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveCriteria = async () => {
    setIsUpdating(true)
    try {
      const totalKeys = availableCriteriaKeys.length;
      let score = 0;
      
      const fullCriteriaForm: Record<string, boolean> = {};
      availableCriteriaKeys.forEach(key => {
        fullCriteriaForm[key] = criteriaForm[key] || false;
      });

      if (totalKeys > 0) {
        const trueCount = availableCriteriaKeys.filter(k => fullCriteriaForm[k]).length;
        score = Math.round((trueCount / totalKeys) * 100);
      }
      
      const updates = {
        id: deal.id,
        qualification_criteria: fullCriteriaForm,
        qualification_score: score
      }
      const result = await updateDeal(updates)
      if (result.error) {
        toast.error(result.error)
      } else if (result.deal) {
        toast.success("Qualification checklist updated")
        onUpdate(result.deal)
      }
    } catch (e) {
      toast.error("Failed to update qualification checklist")
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleCriterion = (key: string, checked: boolean) => {
    setCriteriaForm(prev => ({
      ...prev,
      [key]: checked
    }))
  }

  const handleAddCriterion = () => {
    if (!newCriterion.trim()) {
      setIsAddingCriterion(false)
      return
    }
    const key = newCriterion.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
    if (!availableCriteriaKeys.includes(key)) {
      setAvailableCriteriaKeys(prev => [...prev, key])
    }
    setCriteriaForm(prev => ({
      ...prev,
      [key]: false
    }))
    setNewCriterion("")
    setIsAddingCriterion(false)
  }

  const formatCurrency = (amount: number | string | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined || amount === "") return "-"
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(numAmount)) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(numAmount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set"
    return new Date(dateString).toLocaleDateString()
  }

  const handleRemoveContact = async (leadId: string) => {
    setIsUpdating(true)
    try {
      const result = await removeDealContact(deal.id, leadId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Contact removed")
        const updatedDealResult = await getDealById(deal.id)
        if (updatedDealResult.deal) {
          onUpdate(updatedDealResult.deal)
        }
      }
    } catch (e) {
      toast.error("Failed to remove contact")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveTeamMember = async (userId: string) => {
    setIsUpdating(true)
    try {
      const result = await removeDealOwner(deal.id, userId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Team member removed")
        const updatedDealResult = await getDealById(deal.id)
        if (updatedDealResult.deal) {
          onUpdate(updatedDealResult.deal)
        }
      }
    } catch (e) {
      toast.error("Failed to remove team member")
    } finally {
      setIsUpdating(false)
    }
  }

  if (tab === "details") {
    return (
      <div className="space-y-6 md:space-y-12">
        <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" /> Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 md:px-8 pb-8">
            <Textarea 
              value={notesForm.notes} 
              onChange={(e) => setNotesForm({...notesForm, notes: e.target.value})} 
              placeholder="Add notes to keep track of this deal..."
              className="min-h-[150px] text-base"
            />
          </CardContent>
          <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
            <Button 
              variant="outline"
              onClick={handleSaveNotes} 
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">Qualification Checklist</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsAddingCriterion(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Criteria
            </Button>
          </CardHeader>
          <CardContent className="px-6 md:px-8 pb-8">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableCriteriaKeys.map((key) => {
                  const isChecked = criteriaForm[key] || false;
                  return (
                    <div key={key} className="flex items-center space-x-3 py-2 border-b last:border-0 md:last:border-b-0 md:border-b-0 md:[&:nth-last-child(-n+2)]:border-0 md:border-b">
                      <Checkbox 
                        id={`criterion-${key}`} 
                        checked={isChecked}
                        onCheckedChange={(checked) => toggleCriterion(key, checked === true)}
                        className="h-5 w-5"
                      />
                      <label 
                        htmlFor={`criterion-${key}`} 
                        className={`text-sm font-medium leading-none cursor-pointer select-none flex-1 capitalize ${isChecked ? '' : 'text-muted-foreground'}`}
                      >
                        {key.replace(/_/g, ' ')}
                      </label>
                    </div>
                  );
                })}
              </div>

              {isAddingCriterion && (
                <div className="flex items-center gap-2 pt-4 mt-2 border-t">
                  <Input 
                    placeholder="Add new criteria..." 
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCriterion();
                      } else if (e.key === 'Escape') {
                        setIsAddingCriterion(false);
                      }
                    }}
                    autoFocus
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm" onClick={handleAddCriterion} type="button">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingCriterion(false)} type="button">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
            <Button 
              variant="outline"
              onClick={handleSaveCriteria} 
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save Checklist"}
            </Button>
          </CardFooter>
        </Card>

        <DealSalesOrder deal={deal} onUpdate={onUpdate} />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 md:space-y-12 relative">
        {/* General Information */}
        <Card id="deal-information" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-visible">
        <CardHeader className="px-6 md:px-8 py-6 pb-2">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" /> General Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-8 space-y-8 relative overflow-visible">
          {/* Deal Metrics Summary (Requested in prompt) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 pt-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 flex flex-col items-center justify-center text-center h-28">
              <p className="text-sm font-medium text-muted-foreground mb-2">Deal Value</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(deal.amount, deal.currency)}</p>
            </div>
            <div className="border rounded-lg p-6 flex flex-col items-center justify-center text-center h-28 bg-muted/10">
              <p className="text-sm font-medium text-muted-foreground mb-2">Win Probability</p>
              <p className="text-3xl font-bold text-foreground">
                {deal.stage === "prospecting" ? "10%" :
                 deal.stage === "qualification" ? "30%" :
                 deal.stage === "proposal" ? "50%" :
                 deal.stage === "negotiation" ? "80%" :
                 deal.stage === "closed_won" ? "100%" : "0%"}
              </p>
            </div>
            <div className="border rounded-lg p-6 flex flex-col items-center justify-center text-center h-28 bg-muted/10">
              <p className="text-sm font-medium text-muted-foreground mb-2">Expected Close</p>
              <p className="text-2xl font-bold text-foreground">{formatDate(deal.expected_close_date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pt-4 border-t relative overflow-visible">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Deal Name</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  className="pl-12 h-12 text-base"
                  value={generalForm.name}
                  onChange={(e) => setGeneralForm({...generalForm, name: e.target.value})}
                  placeholder="e.g. Enterprise License"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Amount ({deal.currency || 'USD'})</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  className="pl-12 h-12 text-base"
                  value={generalForm.amount}
                  onChange={(e) => setGeneralForm({...generalForm, amount: e.target.value})}
                  placeholder="e.g. 10000"
                />
              </div>
            </div>

            <div className="space-y-3 relative z-10">
              <label className="text-sm font-medium text-foreground">Expected Close Date</label>
              <DatePicker 
                date={generalForm.expected_close_date ? new Date(generalForm.expected_close_date + 'T12:00:00') : undefined}
                setDate={(date: Date | undefined) => setGeneralForm({
                  ...generalForm, 
                  expected_close_date: date ? format(date, 'yyyy-MM-dd') : ""
                })}
                className="w-full h-12"
                placeholder="Select close date"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Linked Company</label>
              <CompanySelector 
                selectedCompanyId={generalForm.company_id}
                initialCompany={deal.company_id && deal.companies ? { id: deal.company_id, name: deal.companies.name } : null}
                onCompanyChange={(c) => setGeneralForm({ ...generalForm, company_id: c ? c.id : "" })}
                isEditing={true}
                hideLabel={true}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-6 md:px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={handleSaveGeneral}
            disabled={isUpdating}
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>

      <Card id="pipeline-stage" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-6 md:px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Briefcase className="h-5 w-5" /> Pipeline Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 md:space-y-8 px-6 md:px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Stage</label>
              <Select 
                value={stageForm.stage} 
                onValueChange={(val) => setStageForm({...stageForm, stage: val as "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost"})} 
                disabled={isUpdating}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id} className="py-3">
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select 
                value={stageForm.status} 
                onValueChange={(val) => setStageForm({...stageForm, status: val as "open" | "won" | "lost"})} 
                disabled={isUpdating}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STATUSES.map((status) => (
                    <SelectItem key={status.id} value={status.id} className="py-3">
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-8 border-t">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-muted-foreground" /> Qualification
              </h3>
              <Button variant="outline" size="sm" onClick={() => {
                if (onTabChange) {
                  onTabChange("details");
                } else {
                  const tabsList = document.querySelector('[role="tablist"]');
                  if (tabsList) {
                    const detailsTab = Array.from(tabsList.querySelectorAll('[role="tab"]')).find(
                      (el) => el.getAttribute('data-value') === 'details' || el.getAttribute('value') === 'details' || el.textContent?.includes('Details')
                    );
                    if (detailsTab) (detailsTab as HTMLElement).click();
                  }
                }
              }}>View Details</Button>
            </div>
            
            {deal.qualification_score !== null ? (
              <div className="bg-muted/30 p-6 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium">Overall Score</span>
                  <span className="text-2xl font-bold">{deal.qualification_score} <span className="text-sm text-muted-foreground font-normal">/ 100</span></span>
                </div>
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ease-in-out ${deal.qualification_score >= 80 ? 'bg-green-500' : deal.qualification_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, deal.qualification_score))}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 font-medium">
                  {deal.qualification_score >= 80 ? "🔥 Highly qualified deal with strong potential." : 
                   deal.qualification_score >= 50 ? "⚠️ Moderately qualified, needs more nurturing and information." : 
                   "❌ Low qualification score, might not be a fit at this time."}
                </p>
              </div>
            ) : (
              <EmptyCard
                variant="fancy"
                icon={<Target className="h-10 w-10 text-muted-foreground" />}
                title="No qualification score"
                description="Run a qualification assessment to score this deal and identify potential risks or opportunities."
                className="min-h-[180px] bg-muted/5 border border-dashed rounded-lg"
                showShadow={false}
              />
            )}
          </div>
        </CardContent>
        <CardFooter className="px-6 md:px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={handleSaveStage} 
            disabled={isUpdating}
          >
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>

      <Card id="deal-team" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Deal Team
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsLinkTeamMemberOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Assign Member
          </Button>
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-8">
          {deal.owners && deal.owners.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-6 py-4 text-sm font-semibold text-left">Name / Email</th>
                    <th className="px-6 py-4 text-sm font-semibold text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deal.owners.map((owner) => (
                    <tr key={owner.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {(owner.user?.name || owner.user?.email || "U")[0].toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span>{owner.user?.name || owner.user?.email || "Unknown Member"}</span>
                            {owner.user?.name && owner.user?.email && (
                              <span className="text-xs text-muted-foreground font-normal">{owner.user.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to remove this team member from the deal?")) {
                              handleRemoveTeamMember(owner.user_id)
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCard
              variant="fancy"
              icon={<User />}
              title="No team members assigned"
              description="Assign team members to collaborate on this deal."
              className="min-h-[250px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          )}
        </CardContent>
      </Card>

      <Card id="deal-contacts" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" /> Deal Contacts
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsLinkContactOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Contact
          </Button>
        </CardHeader>
        <CardContent className="px-6 md:px-8 pb-8">
          {deal.contacts && deal.contacts.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-6 py-4 text-sm font-semibold text-left">Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-left">Role in Deal</th>
                    <th className="px-6 py-4 text-sm font-semibold text-center w-24">Primary</th>
                    <th className="px-6 py-4 text-sm font-semibold text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deal.contacts.map((contact) => (
                    <tr key={contact.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {(contact.lead?.name || "U")[0].toUpperCase()}
                          </div>
                          {contact.lead?.name || "Unknown Contact"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{contact.role || contact.lead?.position || "Not specified"}</td>
                      <td className="px-6 py-4 text-sm text-center">
                        {contact.is_primary ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200">Primary</Badge>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-sm text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to remove this contact from the deal?")) {
                              handleRemoveContact(contact.lead?.id || (contact as any).lead_id)
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCard
              variant="fancy"
              icon={<Users />}
              title="No contacts linked"
              description="Add key stakeholders and decision makers for this deal."
              className="min-h-[400px] border border-dashed rounded-lg bg-muted/5"
              showShadow={false}
            />
          )}
        </CardContent>
      </Card>
      </div>
      
      <LinkContactDialog 
        deal={deal}
        isOpen={isLinkContactOpen}
        onOpenChange={setIsLinkContactOpen}
        onLinked={onUpdate}
      />
      <LinkTeamMemberDialog 
        deal={deal}
        isOpen={isLinkTeamMemberOpen}
        onOpenChange={setIsLinkTeamMemberOpen}
        onLinked={onUpdate}
      />
    </>
  )
}
