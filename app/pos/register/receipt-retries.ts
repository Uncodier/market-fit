type Receipt = { [key: string]: unknown }
const FIELDS = ["register_session_id", "payment_id", "recorded_by", "method", "amount", "tendered", "change", "status"]

/** A later checkout failure must not apply an already committed register receipt twice. */
export function newRegisterReceipts<T extends Receipt>(previous: Receipt[], incoming: T[]): T[] {
  return incoming.filter((receipt) => {
    if (!receipt.payment_id) return true
    const recorded = previous.find((payment) => payment.payment_id === receipt.payment_id)
    if (!recorded) return true
    if (FIELDS.some((field) => recorded[field] !== receipt[field])) {
      throw new Error("A recorded register receipt cannot be changed. Refresh the order before retrying.")
    }
    return false
  })
}