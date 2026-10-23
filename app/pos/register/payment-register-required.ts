import type { RegisterResult } from "./types"

/** Only a verified missing/ambiguous shift should open register setup. */
export class PaymentRegisterRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PaymentRegisterRequiredError"
  }
}

export function throwPaymentRegisterError(result: Extract<RegisterResult<unknown>, { error: string }>): never {
  if (result.code === "register_required" || result.code === "register_location_required") {
    throw new PaymentRegisterRequiredError(result.error)
  }
  throw new Error(result.error)
}