import * as z from "zod";

// Define MFA factor interface
export interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  verified: boolean;
}

// Password schema with validation
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string()
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// MFA settings schema
export const mfaSchema = z.object({
  enabled: z.boolean().default(false)
});

export type PasswordFormValues = z.infer<typeof passwordSchema>;
export type MfaFormValues = z.infer<typeof mfaSchema>;

// Default values for password form
export const defaultPasswordValues: PasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: ""
};

// Default values for MFA form
export const defaultMfaValues: MfaFormValues = {
  enabled: false
};