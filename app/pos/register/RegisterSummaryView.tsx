import type { RegisterSummary } from "./types";
import { registerDate, registerMoney } from "./register-ui-utils";
import { Banknote, ChevronDown, Receipt, Wallet } from "@/app/components/ui/icons";

export function RegisterSummaryView({ summary, currency }: { summary: RegisterSummary; currency: string }) {
  const money = (amount: number) => registerMoney(amount, currency);
  return (
    <section className="space-y-4" aria-label="Register summary">
      <dl className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <dt className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4 text-primary" aria-hidden={true} />Expected drawer cash</dt>
          <dd className="mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{money(summary.expected_amount)}</dd>
          <dd className="mt-2 text-xs text-muted-foreground">Cash that should be in the drawer. Non-cash payments are excluded.</dd>
        </div>
        <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
          <dt className="text-xs text-muted-foreground">Total received (all methods)</dt>
          <dd className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums">{money(summary.total_received)}</dd>
        </div>
        <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Receipt className="h-4 w-4 shrink-0" aria-hidden={true} />Receipt count</dt>
          <dd className="mt-2 text-xl font-semibold tabular-nums">{summary.receipt_count}</dd>
        </div>
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border p-4" aria-label="Cash breakdown">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Banknote className="h-4 w-4 text-muted-foreground" aria-hidden={true} />Cash breakdown</h4>
          <dl className="space-y-3 text-sm">
            {([
              ["Opening cash", summary.opening_amount, ""],
              ["Cash received", summary.cash_received, "+"],
              ["Cash in", summary.cash_in, "+"],
              ["Cash out", summary.cash_out, "−"],
              ["Cash refunds", summary.cash_refunds, "−"],
            ] as const).map(([label, amount, sign]) => <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 font-medium tabular-nums">{sign && <span className="mr-1 text-muted-foreground">{sign}</span>}{money(amount)}</dd>
            </div>)}
          </dl>
          <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">Expected cash = opening + cash received + cash in − cash out − cash refunds.</p>
        </section>
        <section className="rounded-xl border p-4" aria-label="Payment totals">
          <h4 className="mb-4 text-sm font-semibold">Payment totals</h4>
          <dl className="space-y-3">
            {Object.entries(summary.payment_totals).map(([method, amount]) => <div key={method} className="flex items-baseline justify-between gap-3 text-sm"><dt className="capitalize text-muted-foreground">{method.replaceAll("_", " ")}</dt><dd className="shrink-0 font-medium tabular-nums">{money(amount)}</dd></div>)}
          </dl>
          {Object.keys(summary.payment_totals).length === 0 && <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">No payments received.</p>}
          <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground">Card and other non-cash payments contribute to total received, not drawer cash.</p>
        </section>
      </div>
      <details className="group rounded-xl border p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><span>Cash movements ({summary.movements.length})</span><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden={true} /></summary>
        <div className="mt-4 space-y-2 border-t pt-4">
          {summary.movements.map((movement) => <div key={movement.id} className="rounded-md bg-muted/40 p-3 text-xs break-words">
            <div className="flex justify-between gap-2 text-sm"><span className="capitalize">{movement.kind.replaceAll("_", " ")}</span><span>{money(movement.amount)}</span></div>
            <p className="mt-1 whitespace-pre-wrap">{movement.reason}</p>
            <p className="mt-1 text-muted-foreground">{registerDate(movement.created_at)} · Responsible (user ID): {movement.actor_id}</p>
            <p className="text-muted-foreground">Movement: {movement.id}</p>
          </div>)}
          {summary.movements.length === 0 && <p className="text-xs text-muted-foreground">No cash movements.</p>}
        </div>
      </details>
      <details className="group rounded-xl border p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><span>Receipts ({summary.receipts.length})</span><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden={true} /></summary>
        <div className="mt-4 space-y-2 border-t pt-4">
          {summary.receipts.map((receipt) => <div key={receipt.id} className="rounded-md bg-muted/40 p-3 text-xs break-words">
            <div className="flex justify-between gap-2 text-sm"><span className="capitalize">{receipt.method.replaceAll("_", " ")}</span><span>{money(receipt.amount)}</span></div>
            <p className="mt-1">Tendered: {money(receipt.tendered)} · Change: {money(receipt.change)}</p>
            <p className="mt-1 text-muted-foreground">{registerDate(receipt.received_at)} · Responsible (user ID): {receipt.actor_id}</p>
            <p className="text-muted-foreground">Receipt: {receipt.id} · Sale: {receipt.sale_id}</p>
          </div>)}
          {summary.receipts.length === 0 && <p className="text-xs text-muted-foreground">No receipts.</p>}
        </div>
      </details>
      <p className="text-xs leading-relaxed text-muted-foreground">Only receipts recorded with this register feature are included. Historical sales are not reconstructed.</p>
    </section>
  );
}