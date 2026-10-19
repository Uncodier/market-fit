export function registerMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function registerDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US");
}

export function registerAmount(value: string, allowZero = false) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) {
    throw new Error("Enter an amount with no more than two decimal places.");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || (allowZero ? amount < 0 : amount <= 0)) {
    throw new Error(allowZero ? "Amount must be zero or greater." : "Amount must be greater than zero.");
  }
  return amount;
}

export function requireRegisterOnline() {
  if (!navigator.onLine) throw new Error("You are offline. Reconnect before changing the register.");
}