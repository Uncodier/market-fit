import { z } from "zod"
import { validateContactPhone } from "@/app/auth/phone-validation"

export const authFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
  phone: z
    .string()
    .max(32, "Please enter a valid phone number")
    .refine((value) => validateContactPhone(value).valid, {
      message: "Please enter a valid phone number",
    })
    .optional(),
  referralCode: z.string().optional(),
})

export const resetPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

export type AuthFormValues = z.infer<typeof authFormSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export type AuthMode = "sign_in" | "sign_up" | "reset_password"
export type ReferralCodeStatus =
  | "unchecked"
  | "valid"
  | "invalid"
  | "checking"
