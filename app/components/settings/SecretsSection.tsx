"use client";

import React, { useState, useEffect } from "react";
import { useSite } from "@/app/context/SiteContext";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { PlusCircle, Trash2, Eye, EyeOff } from "@/app/components/ui/icons";
import { useToast } from "@/app/components/ui/use-toast";
import { SectionCard } from "@/app/components/ui/section-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { useLocalization } from "@/app/context/LocalizationContext";

export function SecretsSection({ instanceId }: { instanceId?: string }) {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    useCase: "",
    secretValue: "",
  });

  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [decryptedValues, setDecryptedValues] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (currentSite?.id) {
      loadSecrets();
    }
  }, [currentSite?.id, instanceId]);

  const loadSecrets = async () => {
    if (!currentSite?.id) return;
    setLoading(true);

    try {
      const supabase = createClient();

      let query = supabase
        .from("site_secrets")
        .select("id, name, provider, use_case, created_at")
        .eq("site_id", currentSite.id);

      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      } else {
        query = query.is("instance_id", null);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSecrets(data || []);
    } catch (error: any) {
      console.error("Error loading secrets:", error);
      toast({
        title: "Error loading secrets",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecret = async () => {
    if (!currentSite?.id) return;
    if (
      !formData.name ||
      !formData.provider ||
      !formData.useCase ||
      !formData.secretValue
    ) {
      toast({
        title: "Missing fields",
        description: "Please fill out all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "store",
          siteId: currentSite.id,
          instanceId: instanceId,
          name: formData.name,
          provider: formData.provider,
          useCase: formData.useCase,
          secretValue: formData.secretValue,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to save secret");
      }

      toast({
        title: "Secret saved",
        description: "The secret has been securely stored.",
      });

      setFormData({ name: "", provider: "", useCase: "", secretValue: "" });
      setIsDialogOpen(false);
      loadSecrets();
    } catch (error: any) {
      toast({
        title: "Error saving secret",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteSecret = async (secret: any) => {
    if (!currentSite?.id) return;

    if (!confirm(`Are you sure you want to delete the secret ${secret.name}?`))
      return;

    try {
      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "delete",
          siteId: currentSite.id,
          instanceId: instanceId,
          provider: secret.provider,
          useCase: secret.use_case,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete secret");
      }

      toast({
        title: "Secret deleted",
        description: "The secret has been removed.",
      });

      loadSecrets();
    } catch (error: any) {
      toast({
        title: "Error deleting secret",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleSecretVisibility = async (secret: any) => {
    const isVisible = showValues[secret.id];

    if (isVisible) {
      setShowValues((prev) => ({ ...prev, [secret.id]: false }));
      return;
    }

    if (decryptedValues[secret.id]) {
      setShowValues((prev) => ({ ...prev, [secret.id]: true }));
      return;
    }

    try {
      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "retrieve",
          siteId: currentSite?.id,
          instanceId: instanceId,
          provider: secret.provider,
          useCase: secret.use_case,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to retrieve secret");
      }

      const { secretValue } = await response.json();

      setDecryptedValues((prev) => ({ ...prev, [secret.id]: secretValue }));
      setShowValues((prev) => ({ ...prev, [secret.id]: true }));
    } catch (error: any) {
      toast({
        title: "Error retrieving secret",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div id="secrets" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t("settings.nav.secrets") || "Environment Variables & Secrets"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("settings.secrets.description") ||
              "Manage sensitive keys used by integrations and runtime environments."}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" type="button">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Secret
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Secret</DialogTitle>
              <DialogDescription>
                This secret will be encrypted and securely stored.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Environment Variable Name</Label>
                <Input
                  placeholder="e.g. STRIPE_API_KEY"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  placeholder="e.g. stripe, openai, custom"
                  value={formData.provider}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      provider: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Use Case</Label>
                <Input
                  placeholder="e.g. payments, llm"
                  value={formData.useCase}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      useCase: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Value</Label>
                <Input
                  type="password"
                  placeholder="sk_..."
                  value={formData.secretValue}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      secretValue: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveSecret}>Save Secret</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Loading...
                  </td>
                </tr>
              ) : secrets.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No secrets found. Add one to get started.
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => (
                  <tr
                    key={secret.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{secret.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                        {secret.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {showValues[secret.id] && decryptedValues[secret.id]
                        ? decryptedValues[secret.id]
                        : "••••••••••••••••"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => toggleSecretVisibility(secret)}
                        >
                          {showValues[secret.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSecret(secret)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
