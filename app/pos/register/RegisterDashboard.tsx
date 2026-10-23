"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import type { CashRegisterOptionsProps } from "./CashRegisterOptions";
import { fetchRegisterDashboard as getRegisterDashboard, openPosRegister as openRegister } from "../operation-client";
import type { RegisterDashboard as Dashboard, RegisterSession } from "./types";
import { registerAmount } from "./register-ui-utils";
import { useRegisterMutation } from "./use-register-mutation";
import { RegisterSessionPanel } from "./RegisterSessionPanel";
import { RegisterActionScope, RegisterActions, RegisterLayout } from "./RegisterLayout";
import { RegisterHistoryTable } from "./RegisterHistoryTable";

export default function RegisterDashboard({ siteId, locationId, onLocationChange, locations, currency, onOpened }: CashRegisterOptionsProps) {
  const [selectedLocation, setSelectedLocation] = useState(locations.some((location) => location.id === locationId) ? locationId : locations.length === 1 ? locations[0].id : "");
  useEffect(() => {
    if (!locationId && locations.length === 1) onLocationChange?.(locations[0].id);
  }, [locationId, locations, onLocationChange]);
  return (
    <RegisterLayout>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="register-location">Register location</Label>
          <select id="register-location" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={selectedLocation} onChange={(event) => { setSelectedLocation(event.target.value); onLocationChange?.(event.target.value); }}>
            <option value="">Select a location</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name || location.id}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">This selection is independent of order fulfillment, including carryout.</p>
        </div>
        {!siteId ? <p role="alert">Select a site to use the cash register.</p>
          : !selectedLocation ? <p>Select a register location to continue.</p>
          : <LocationDashboard key={`${siteId}:${selectedLocation}`} siteId={siteId} locationId={selectedLocation} currency={currency} onOpened={onOpened} locationName={locations.find((location) => location.id === selectedLocation)?.name || selectedLocation} />}
      </div>
    </RegisterLayout>
  );
}

function LocationDashboard({ siteId, locationId, currency, locationName, onOpened }: { siteId: string; locationId: string; currency: string; locationName: string; onOpened?: () => void }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<RegisterSession | null>(null);
  const [view, setView] = useState("today");
  const readVersion = useRef(0);

  const refresh = useCallback(() => {
    readVersion.current += 1;
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const version = ++readVersion.current;
    async function load() {
      try {
        const result = await getRegisterDashboard({ siteId, locationId, page });
        if (cancelled || version !== readVersion.current) return;
        if (result.error !== undefined) throw new Error(result.error);
        setDashboard(result.data);
        setError(null);
      } catch (failure) {
        if (!cancelled && version === readVersion.current) setError(failure instanceof Error ? failure.message : "Cash register is unavailable. Close and reopen this dialog to try again.");
      } finally {
        if (!cancelled && version === readVersion.current) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [siteId, locationId, page, revision]);

  function applyPage(nextPage: number) {
    readVersion.current += 1;
    setLoading(true);
    setPage(nextPage);
  }
  const fresh = !loading && !error;
  const active = dashboard?.active;
  const canManage = !!dashboard && (dashboard.role === "owner" || dashboard.role === "admin" || active?.opened_by === dashboard.userId);

  return (
    <Tabs value={view} onValueChange={setView} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2" aria-label="Cash register views">
        <TabsTrigger value="today">Today</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      {loading && view === "today" && <p role="status">Loading register…</p>}
      {error && <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm"><p>{error}</p><p className="mt-1">The register may be unavailable until its database migration is installed. No balance has been reset. Close and reopen this dialog after recovery.</p></div>}
      <RegisterActionScope active={view === "today"}>
        <TabsContent value="today" forceMount hidden={view !== "today"} className="space-y-4 data-[state=inactive]:hidden">
          {dashboard ? (active ? (
            <RegisterSessionPanel key={active.id} siteId={siteId} session={active} locationName={locationName} revision={revision} writable={fresh && canManage} onChanged={(closed) => { if (closed) { setDetail(closed); setView("history"); } refresh(); }} />
          ) : (
            <OpenRegisterForm siteId={siteId} locationId={locationId} currency={currency} disabled={!fresh} onOpened={() => { refresh(); onOpened?.(); }} />
          )) : (
            <Card className="overflow-hidden">
              <CardHeader><CardTitle className="text-base">Current register</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{loading ? "Checking the current register for this location." : "Register data is unavailable. Close and reopen this dialog to try again."}</p></CardContent>
            </Card>
          )}
        </TabsContent>
      </RegisterActionScope>
      <RegisterActionScope active={view === "history"}>
        <TabsContent value="history" forceMount hidden={view !== "history"} className="space-y-4 data-[state=inactive]:hidden">
          <Card className="overflow-hidden" role="region" aria-label="Register history">
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
              <CardDescription>Review all closed shifts for this location, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterHistoryTable
                sessions={dashboard?.history ?? []}
                loading={loading}
                error={error}
                onSelect={setDetail}
              />
            </CardContent>
            <RegisterActions>
              <nav aria-label="Register history pagination" className="flex w-full items-center justify-between gap-3 sm:mr-auto sm:w-auto">
                <Button type="button" variant="outline" size="sm" disabled={loading || page === 0} onClick={() => applyPage(page - 1)}>Previous</Button>
                <span className="whitespace-nowrap text-sm">Page {page + 1}</span>
                <Button type="button" variant="outline" size="sm" disabled={loading || !dashboard?.hasMore || !!error} onClick={() => applyPage(page + 1)}>Next</Button>
              </nav>
            </RegisterActions>
          </Card>
          {detail && <section className="space-y-3" aria-label="Session detail">
            <h3 className="font-semibold">Session detail</h3>
            <RegisterSessionPanel key={detail.id} siteId={siteId} session={detail} locationName={locationName} revision={revision} writable={false} onHideDetail={() => setDetail(null)} />
          </section>}
        </TabsContent>
      </RegisterActionScope>
    </Tabs>
  );
}

function OpenRegisterForm({ siteId, locationId, currency, disabled, onOpened }: { siteId: string; locationId: string; currency: string; disabled: boolean; onOpened: () => void }) {
  const formId = useId();
  const [openingAmount, setOpeningAmount] = useState("");
  const mutation = useRegisterMutation();
  return (
    <Card className="overflow-hidden">
      <form id={formId} onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        try {
          const amount = registerAmount(openingAmount, true);
          mutation.run(JSON.stringify(["open", siteId, locationId, currency, amount]), async (requestId) => openRegister({ siteId, locationId, currency, openingAmount: amount, requestId }), onOpened);
        } catch (failure) { mutation.setError(failure instanceof Error ? failure.message : "Invalid opening cash."); }
      }}>
        <CardHeader>
          <CardTitle className="text-base">Current register</CardTitle>
          <CardDescription>No open register at this location. Enter the opening cash amount to start a new shift.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="register-opening">Opening cash ({currency})</Label>
            <Input id="register-opening" inputMode="decimal" placeholder="0.00" aria-describedby={`${formId}-opening-help`} value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} disabled={mutation.pending} autoFocus required />
            <p id={`${formId}-opening-help`} className="text-xs text-muted-foreground">Enter the cash currently in the drawer, or 0 to start with no cash.</p>
          </div>
          {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error}</p>}
        </CardContent>
        <RegisterActions>
          <Button type="submit" form={formId} disabled={disabled || mutation.pending}>{mutation.pending ? "Opening…" : "Open register"}</Button>
        </RegisterActions>
      </form>
    </Card>
  );
}