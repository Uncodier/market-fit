import type { RegisterSummary } from "./types";
import { registerDate, registerMoney } from "./register-ui-utils";

export function RegisterSummaryView({ summary, currency }: { summary: RegisterSummary; currency: string }) {
  const money = (amount: number) => registerMoney(amount, currency);
  return (
    <section className="space-y-3" aria-label="Register summary">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt>Opening cash</dt><dd className="text-right tabular-nums">{money(summary.opening_amount)}</dd>
        <dt>Cash received</dt><dd className="text-right tabular-nums">{money(summary.cash_received)}</dd>
        <dt>Cash in</dt><dd className="text-right tabular-nums">{money(summary.cash_in)}</dd>
        <dt>Cash out</dt><dd className="text-right tabular-nums">{money(summary.cash_out)}</dd>
        <dt>Cash refunds</dt><dd className="text-right tabular-nums">{money(summary.cash_refunds)}</dd>
        <dt className="font-semibold">Expected drawer cash</dt><dd className="text-right font-semibold tabular-nums">{money(summary.expected_amount)}</dd>
        <dt>Total received (all methods)</dt><dd className="text-right tabular-nums">{money(summary.total_received)}</dd>
        <dt>Receipt count</dt><dd className="text-right">{summary.receipt_count}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Expected cash = opening + cash received + cash in − cash out − cash refunds. Card and other non-cash payments are excluded from drawer cash.</p>
      <p className="text-xs text-muted-foreground">Only receipts recorded with this register feature are included. Historical sales are not reconstructed.</p>
      <div className="space-y-1 border-t pt-3">
        <h5 className="text-sm font-medium">Payment totals</h5>
        {Object.entries(summary.payment_totals).map(([method, amount]) => <div key={method} className="flex justify-between gap-2 text-sm"><span className="capitalize">{method.replaceAll("_", " ")}</span><span className="tabular-nums">{money(amount)}</span></div>)}
        {Object.keys(summary.payment_totals).length === 0 && <p className="text-xs text-muted-foreground">No payments received.</p>}
      </div>
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Cash movements ({summary.movements.length})</summary>
        <div className="mt-2 space-y-2">
          {summary.movements.map((movement) => <div key={movement.id} className="rounded-md bg-muted/40 p-3 text-xs break-words">
            <div className="flex justify-between gap-2 text-sm"><span className="capitalize">{movement.kind.replaceAll("_", " ")}</span><span>{money(movement.amount)}</span></div>
            <p className="mt-1 whitespace-pre-wrap">{movement.reason}</p>
            <p className="mt-1 text-muted-foreground">{registerDate(movement.created_at)} · Responsible (user ID): {movement.actor_id}</p>
            <p className="text-muted-foreground">Movement: {movement.id}</p>
          </div>)}
          {summary.movements.length === 0 && <p className="text-xs text-muted-foreground">No cash movements.</p>}
        </div>
      </details>
      <details className="border-t pt-3">
        <summary className="cursor-pointer text-sm font-medium">Receipts ({summary.receipts.length})</summary>
        <div className="mt-2 space-y-2">
          {summary.receipts.map((receipt) => <div key={receipt.id} className="rounded-md bg-muted/40 p-3 text-xs break-words">
            <div className="flex justify-between gap-2 text-sm"><span className="capitalize">{receipt.method.replaceAll("_", " ")}</span><span>{money(receipt.amount)}</span></div>
            <p className="mt-1">Tendered: {money(receipt.tendered)} · Change: {money(receipt.change)}</p>
            <p className="mt-1 text-muted-foreground">{registerDate(receipt.received_at)} · Responsible (user ID): {receipt.actor_id}</p>
            <p className="text-muted-foreground">Receipt: {receipt.id} · Sale: {receipt.sale_id}</p>
          </div>)}
          {summary.receipts.length === 0 && <p className="text-xs text-muted-foreground">No receipts.</p>}
        </div>
      </details>
    </section>
  );
}