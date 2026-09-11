import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Globe, Cloud } from "@/app/components/ui/icons";
import { useLocalization } from "@/app/context/LocalizationContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { toast } from "sonner";
import { secretsService } from "@/app/services/secrets-service";
import { apiClient } from "@/app/services/api-client-service";

export function PublishButton({ siteId, previewUrl }: { siteId: string, previewUrl: string }) {
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [isCloudflareConnected, setIsCloudflareConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen && siteId) {
      secretsService.checkSecretExists(siteId, 'cloudflare', 'dns_sync').then(exists => {
        setIsCloudflareConnected(exists);
      });
    }
  }, [isOpen, siteId]);

  const handleSyncCloudflare = async () => {
    if (!customDomain) {
      toast.error("Please enter a custom domain");
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Add domain to Vercel via internal API route
      const vercelRes = await fetch('/api/robots/instance/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: customDomain, siteId })
      });
      
      const vercelData = await vercelRes.json();
      if (!vercelRes.ok) {
        throw new Error(vercelData.error || "Failed to add domain to Vercel");
      }

      // If Cloudflare is not connected, stop here (Vercel is added, user must do manual DNS)
      if (!isCloudflareConnected) {
        toast.success("Domain added to project! Please configure your DNS manually.");
        setIsOpen(false);
        setIsSyncing(false);
        return;
      }

      // 2. Setup Cloudflare CNAME
      const cfResponse = await fetch('/api/integrations/cloudflare/sync/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          customDomain,
          targetUrl: previewUrl
        })
      });

      const cfData = await cfResponse.json();
      if (cfResponse.ok && cfData.success) {
        toast.success("Domain linked and configured successfully via Cloudflare");
        setIsOpen(false);
      } else {
        toast.error(cfData.error || "Failed to configure DNS in Cloudflare");
      }
    } catch (error: any) {
      console.error("Error linking domain:", error);
      toast.error(error.message || "An error occurred while linking the domain");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[240px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
        title="Publish / Link Domain"
        onClick={() => setIsOpen(true)}
      >
        <Globe className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline font-inter font-medium text-sm">
          Publish
        </span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish to Custom Domain</DialogTitle>
            <DialogDescription>
              Link your project to a custom domain using Cloudflare automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Preview URL</Label>
              <div className="p-3 bg-muted/30 rounded-md border font-mono text-sm break-all">
                {previewUrl}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom Domain</Label>
              <Input
                placeholder="e.g. app.yourcompany.com"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain you want to link. Cloudflare will configure the CNAME record for you.
              </p>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg border text-sm space-y-2 mt-4">
              <h4 className="font-semibold text-foreground">Not using Cloudflare?</h4>
              <p className="text-muted-foreground">
                If your domain is hosted elsewhere, you need to manually add a CNAME record pointing to our preview URL.
              </p>
              <div className="grid grid-cols-[80px_1fr] gap-2 mt-2 font-mono text-xs p-2 bg-background rounded border">
                <span className="text-muted-foreground">Type:</span>
                <span>CNAME</span>
                <span className="text-muted-foreground">Name:</span>
                <span>{customDomain || "your-subdomain"}</span>
                <span className="text-muted-foreground">Target:</span>
                <span className="break-all">{previewUrl.replace(/^https?:\/\//, '')}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            {!isCloudflareConnected && (
              <Button
                type="button"
                variant="outline"
                className="mr-auto text-orange-600 hover:text-orange-700"
                onClick={() => {
                  window.location.href = `/api/integrations/cloudflare/oauth/authorize?site_id=${siteId}`;
                }}
              >
                <Cloud className="h-4 w-4 mr-2" />
                Connect Cloudflare
              </Button>
            )}
            
            <Button
              type="button"
              variant="default"
              onClick={handleSyncCloudflare}
              disabled={isSyncing || !customDomain}
            >
              {isSyncing ? "Saving..." : isCloudflareConnected ? "Sync & Publish" : "Publish Manually"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
