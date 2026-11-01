import { registerMoney } from "./register-ui-utils";

export function RegisterReconciliation({ currency, amount, difference, preview = false }: {
  currency: string;
  amount: number | null;
  difference: number | null;
  preview?: boolean;
}) {
  const money = (value: number | null) => value === null ? "Unavailable" : registerMoney(value, currency);
  return (
    <dl className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2" aria-label={preview ? "Closing preview" : "Closing reconciliation"}>
      <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
        <dt className="text-xs text-muted-foreground">{preview ? "Expected cash" : "Counted cash"}</dt>
        <dd className="mt-2 break-words text-xl font-semibold tabular-nums">{money(amount)}</dd>
      </div>
      <div className={`min-w-0 rounded-xl border p-4 ${difference === null ? "bg-muted/20" : difference === 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
        <dt className="text-xs text-muted-foreground">{preview ? "Preview difference" : "Closing difference"}</dt>
        <dd className="mt-2 break-words text-xl font-semibold tabular-nums">{preview && difference === null ? "Enter counted cash" : money(difference)}</dd>
        {difference !== null && <dd className="mt-1 text-xs text-muted-foreground">{difference === 0 ? "Balanced" : difference < 0 ? "Cash shortage" : "Cash surplus"}</dd>}
      </div>
    </dl>
  );
}