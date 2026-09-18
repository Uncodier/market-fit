const MIN_PHONE_DIGITS = 8
const MAX_PHONE_DIGITS = 15
const MAX_PHONE_LENGTH = 32
const PHONE_CHARACTERS = /^\+?[0-9().\-\s]+$/

export type ContactPhoneValidation =
  | { valid: true; phone: string }
  | { valid: false; error: string }

export function validateContactPhone(value: unknown): ContactPhoneValidation {
  if (typeof value !== "string") {
    return { valid: false, error: "Phone must be a string" }
  }

  const phone = value.trim()
  if (!phone) return { valid: true, phone: "" }
  if (phone.length > MAX_PHONE_LENGTH || !PHONE_CHARACTERS.test(phone)) {
    return { valid: false, error: "Please enter a valid phone number" }
  }

  const digitCount = phone.replace(/\D/g, "").length
  if (digitCount < MIN_PHONE_DIGITS || digitCount > MAX_PHONE_DIGITS) {
    return { valid: false, error: "Please enter a valid phone number" }
  }

  return { valid: true, phone }
}
