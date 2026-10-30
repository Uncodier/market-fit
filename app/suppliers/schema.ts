import { z } from "zod"

const uuid = z.string().uuid().transform(value => value.toLowerCase())
export const supplierContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).default(""),
  phone: z.string().trim().max(60).default(""),
  role: z.string().trim().max(120).default(""),
  is_primary: z.boolean().default(false),
}).strict()
export const supplierInputSchema = z.object({
  expected_version: z.number().int().min(0).max(2147483646),
  name: z.string().trim().min(1).max(200),
  status: z.enum(["prospect", "under_review", "approved", "blocked", "archived"]),
  company_id: uuid.nullable(),
  commercial_terms: z.string().trim().max(10000),
  private_notes: z.string().trim().max(20000),
  contacts: z.array(supplierContactSchema).max(50),
  category_ids: z.array(uuid).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.contacts.filter(contact => contact.is_primary).length > 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contacts"], message: "Choose only one primary contact" })
  }
  if (new Set(value.category_ids).size !== value.category_ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["category_ids"], message: "Categories must be unique" })
  }
})
export type SupplierInput = z.infer<typeof supplierInputSchema>
export type SupplierContact = z.infer<typeof supplierContactSchema>
export type Supplier = Omit<SupplierInput, "expected_version"> & {
  id: string; site_id: string; version: number; created_at: string; updated_at: string
}
export const emptySupplier: SupplierInput = {
  expected_version: 0, name: "", status: "prospect", company_id: null,
  commercial_terms: "", private_notes: "", contacts: [], category_ids: [],
}