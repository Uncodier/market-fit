import type { RegisterSession, RegisterSummary } from "./types";
import { registerDate, registerMoney } from "./register-ui-utils";

// Use an isolated document: never print the POS, interpolate HTML, or load assets.
export function printRegisterReport(session: RegisterSession, summary: RegisterSummary, locationName: string) {
  const report = window.open("", "_blank", "width=900,height=700");
  if (!report) throw new Error("Allow pop-ups to print the cash register report.");
  report.opener = null;
  const document = report.document;
  document.title = "Cash Register Report";
  document.documentElement.lang = "en";
  const style = document.createElement("style");
  style.textContent = "body{font:14px system-ui,sans-serif;color:#111;padding:24px}h1{font-size:24px}h2{font-size:18px;margin-top:24px}p{overflow-wrap:anywhere;white-space:pre-wrap}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:8px;border-bottom:1px solid #ccc;text-align:left;overflow-wrap:anywhere}tr{break-inside:avoid}@media print{body{padding:0}}";
  document.head.appendChild(style);
  document.body.replaceChildren();
  const money = (amount: number | null) => amount === null ? "—" : registerMoney(amount, session.currency);
  function text(tag: "h1" | "h2" | "p", value: string) {
    const element = document.createElement(tag);
    element.textContent = value;
    document.body.appendChild(element);
  }
  function table(headers: string[], rows: string[][]) {
    const element = document.createElement("table");
    const heading = document.createElement("thead");
    const headingRow = document.createElement("tr");
    for (const value of headers) { const cell = document.createElement("th"); cell.textContent = value; headingRow.appendChild(cell); }
    heading.appendChild(headingRow);
    element.appendChild(heading);
    const body = document.createElement("tbody");
    for (const row of rows) {
      const line = document.createElement("tr");
      for (const value of row) { const cell = document.createElement("td"); cell.textContent = value; line.appendChild(cell); }
      body.appendChild(line);
    }
    element.appendChild(body);
    document.body.appendChild(element);
  }
  text("h1", "Cash Register Report");
  text("p", `${session.status === "closed" ? "Immutable closing snapshot" : "Live session preview — not a closing report"}\nLocation: ${locationName}\nLocation ID: ${session.location_id}\nSite ID: ${session.site_id}\nSession: ${session.id}\nCurrency: ${session.currency}`);
  text("p", `Opened: ${registerDate(session.opened_at)}\nResponsible (user ID): ${session.opened_by}\nClosed: ${registerDate(session.closed_at)}\nClosed by (user ID): ${session.closed_by || "—"}`);
  text("h2", "Reconciliation");
  table(["Item", "Amount"], [
    ["Opening cash", money(summary.opening_amount)], ["Cash received", money(summary.cash_received)],
    ["Cash in", money(summary.cash_in)], ["Cash out", money(summary.cash_out)], ["Cash refunds", money(summary.cash_refunds)],
    ["Expected drawer cash", money(summary.expected_amount)], ["Counted cash", money(session.counted_amount)],
    ["Closing difference", money(session.difference)], ["Total received (all methods)", money(summary.total_received)],
    ["Receipt count", String(summary.receipt_count)],
  ]);
  text("p", "Expected cash = opening + cash received + cash in − cash out − cash refunds. Non-cash payments do not change expected drawer cash.");
  text("p", "Only receipts recorded with this register feature are included. Historical sales are not reconstructed.");
  if (session.notes) text("p", `Closing notes: ${session.notes}`);
  text("h2", "Payment totals");
  table(["Method", "Amount"], Object.entries(summary.payment_totals).map(([method, amount]) => [method, money(amount)]));
  text("h2", "Cash movements");
  table(["Movement", "Type", "Amount", "Reason", "Responsible (user ID)", "Time"], summary.movements.map((movement) => [movement.id, movement.kind, money(movement.amount), movement.reason, movement.actor_id, registerDate(movement.created_at)]));
  text("h2", "Receipts");
  table(["Receipt / sale", "Method", "Amount", "Tendered", "Change", "Responsible (user ID)", "Time"], summary.receipts.map((receipt) => [`${receipt.id} / ${receipt.sale_id}`, receipt.method, money(receipt.amount), money(receipt.tendered), money(receipt.change), receipt.actor_id, registerDate(receipt.received_at)]));
  report.onafterprint = () => report.close();
  report.focus();
  // Give the isolated document one task to lay out before opening browser print.
  report.setTimeout(() => { if (!report.closed) report.print(); }, 50);
}