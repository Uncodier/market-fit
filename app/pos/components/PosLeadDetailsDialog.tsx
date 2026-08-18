"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { ExternalLink } from "@/app/components/ui/icons";
import { getLeadById, updateLead, createLead } from "@/app/leads/actions";
import { Skeleton } from "@/app/components/ui/skeleton";

type LeadFormState = {
  name: string;
  email: string;
  personal_email: string;
  phone: string;
  company: string;
  position: string;
  notes: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
};

const emptyForm: LeadFormState = {
  name: "",
  email: "",
  personal_email: "",
  phone: "",
  company: "",
  position: "",
  notes: "",
  street: "",
  city: "",
  state: "",
  zipcode: "",
  country: "",
};

function companyNameFromLead(lead: any): string {
  if (!lead) return "";
  if (typeof lead.company === "string") return lead.company;
  return lead.company?.name || lead.companies?.name || "";
}

function formFromLead(lead: any): LeadFormState {
  const address = lead?.address || {};
  return {
    name: lead?.name || "",
    email: lead?.email || "",
    personal_email: lead?.personal_email || "",
    phone: lead?.phone || "",
    company: companyNameFromLead(lead),
    position: lead?.position || "",
    notes: lead?.notes || "",
    street: address.street || "",
    city: address.city || "",
    state: address.state || "",
    zipcode: address.zipcode || "",
    country: address.country || "",
  };
}

export function PosLeadDetailsDialog({
  open,
  onOpenChange,
  leadId,
  siteId,
  t,
  onSaved,
  newLeadName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  siteId: string;
  t: (key: string) => string;
  onSaved?: (lead: { id: string; name: string; email: string; phone?: string | null }) => void;
  newLeadName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);

  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  useEffect(() => {
    if (!open) return;

    if (!leadId) {
      setForm(newLeadName ? { ...emptyForm, name: newLeadName } : emptyForm);
      setError(null);
      setLoading(false);
      return;
    }

    if (!siteId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const result = await getLeadById(leadId, siteId);
      if (cancelled) return;
      if (result.error || !result.lead) {
        setError(result.error || "Lead not found");
        setForm(emptyForm);
      } else {
        setForm(formFromLead(result.lead));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, leadId, siteId]);

  const setField = (key: keyof LeadFormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!siteId) return;
    if (!form.name.trim()) {
      setError(getTrans("pos.leadDetails.nameRequired", "Name is required"));
      return;
    }

    if (!form.email.trim() && !form.phone.trim()) {
      setError(getTrans("pos.leadDetails.emailOrPhoneRequired", "Email or phone is required"));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (leadId) {
        const result = await updateLead({
          id: leadId,
          site_id: siteId,
          name: form.name.trim(),
          email: form.email.trim() || null,
          personal_email: form.personal_email.trim() || null,
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          position: form.position.trim() || null,
          notes: form.notes.trim() || null,
          address: {
            street: form.street.trim() || undefined,
            city: form.city.trim() || undefined,
            state: form.state.trim() || undefined,
            zipcode: form.zipcode.trim() || undefined,
            country: form.country.trim() || undefined,
          },
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        toast.success(
          getTrans("pos.leadDetails.saved", "Customer updated"),
        );
        onSaved?.({
          id: leadId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        });
      } else {
        const result = await createLead({
          site_id: siteId,
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          personal_email: form.personal_email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          company: form.company.trim() || undefined,
          position: form.position.trim() || undefined,
          notes: form.notes.trim() || undefined,
          status: "new",
          address: {
            street: form.street.trim() || undefined,
            city: form.city.trim() || undefined,
            state: form.state.trim() || undefined,
            zipcode: form.zipcode.trim() || undefined,
            country: form.country.trim() || undefined,
          },
        });

        if (result.error || !result.lead) {
          setError(result.error || "Failed to create customer");
          return;
        }

        toast.success(
          getTrans("pos.leadDetails.created", "Customer created"),
        );
        onSaved?.({
          id: result.lead.id,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : getTrans("pos.leadDetails.saveError", "Failed to update customer"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent size="md" busy={saving}>
        <DialogHeader>
          <DialogTitle>
            {getTrans("pos.leadDetails.title", "Customer details")}
          </DialogTitle>
          <DialogDescription>
            {getTrans(
              "pos.leadDetails.description",
              "View and edit customer information for this order.",
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">
                  {getTrans("pos.leadDetails.name", "Name")}
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {getTrans("pos.leadDetails.email", "Email")}
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {getTrans("pos.leadDetails.phone", "Phone")}
                </label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {getTrans("pos.leadDetails.personalEmail", "Personal email")}
                </label>
                <Input
                  type="email"
                  value={form.personal_email}
                  onChange={(e) => setField("personal_email", e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {getTrans("pos.leadDetails.company", "Company")}
                </label>
                <Input
                  value={form.company}
                  onChange={(e) => setField("company", e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium">
                  {getTrans("pos.leadDetails.position", "Position")}
                </label>
                <Input
                  value={form.position}
                  onChange={(e) => setField("position", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {getTrans("pos.leadDetails.address", "Address")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Input
                    placeholder={getTrans("pos.leadDetails.street", "Street")}
                    value={form.street}
                    onChange={(e) => setField("street", e.target.value)}
                    disabled={saving}
                  />
                </div>
                <Input
                  placeholder={getTrans("pos.leadDetails.city", "City")}
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  disabled={saving}
                />
                <Input
                  placeholder={getTrans("pos.leadDetails.state", "State")}
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value)}
                  disabled={saving}
                />
                <Input
                  placeholder={getTrans("pos.leadDetails.zipcode", "ZIP")}
                  value={form.zipcode}
                  onChange={(e) => setField("zipcode", e.target.value)}
                  disabled={saving}
                />
                <Input
                  placeholder={getTrans("pos.leadDetails.country", "Country")}
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {getTrans("pos.leadDetails.notes", "Notes")}
              </label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                disabled={saving}
                rows={3}
              />
            </div>
          </div>
        )}
        </DialogBody>

        <DialogFooter>
          {leadId ? (
            <Button asChild variant="outline" className="gap-2 sm:mr-auto">
              <Link href={`/leads/${leadId}`}>
                <ExternalLink className="h-4 w-4" />
                {getTrans("pos.leadDetails.openFull", "Open full profile")}
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {getTrans("pos.leadDetails.cancel", "Cancelar")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving
              ? getTrans("pos.leadDetails.saving", "Guardando...")
              : getTrans("pos.leadDetails.saveBtn", "Guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
