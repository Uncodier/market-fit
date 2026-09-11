"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
  DialogForm,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useSite } from "@/app/context/SiteContext";
import { useToast } from "@/app/components/ui/use-toast";
import { Key, Lock } from "@/app/components/ui/icons";

interface AddSecretDialogProps {
  onSecretCreated: (id: string, name: string) => void;
  trigger?: React.ReactNode;
  instanceId?: string;
}

export function AddSecretDialog({
  onSecretCreated,
  trigger,
  instanceId,
}: AddSecretDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("custom");
  const [useCase, setUseCase] = useState("");
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentSite } = useSite();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSite) {
      toast({
        title: "Error",
        description: "No site selected",
        variant: "destructive",
      });
      return;
    }

    if (!name || !provider || !useCase || !value) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "store",
          siteId: currentSite.id,
          instanceId: instanceId,
          name: name,
          provider: provider,
          useCase: useCase,
          secretValue: value,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to create secret");
      }

      toast({ title: "Success", description: "Secret created securely" });
      onSecretCreated(data.id, name);
      setOpen(false);
      setName("");
      setProvider("custom");
      setUseCase("");
      setValue("");
    } catch (error: any) {
      console.error("Error creating secret:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Key className="h-4 w-4" />
            Add Secret
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="sm" flush>
        <DialogForm onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Add New Secret
            </DialogTitle>
            <DialogDescription>
              This secret will be encrypted and securely stored.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Environment Variable Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Auto-fill use case if it's empty
                  if (!useCase)
                    setUseCase(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                    );
                }}
                placeholder="e.g. STRIPE_API_KEY"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. stripe, openai, custom"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="useCase">Use Case</Label>
              <Input
                id="useCase"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. payments, llm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Secret Value</Label>
              <Input
                id="value"
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk_..."
                required
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Secret"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
