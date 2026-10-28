import { supplierInputSchema, type Supplier, type SupplierInput } from "../schema"

export async function supplierResponse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json()
  if (response.status === 401) throw new Error("Your session expired. Sign in again.")
  if (response.status === 403) throw new Error("You do not have permission to access or change suppliers in this workspace.")
  if (response.status === 404) throw new Error("Supplier not found in this workspace.")
  if (response.status === 409) throw new Error("This supplier changed in another session. Reload the latest version before saving.")
  if (response.status === 400) throw new Error("Check the supplier details and linked workspace references.")
  throw new Error("Supplier storage is unavailable. Changes are not confirmed. Reload before retrying; the supplier migration may be missing.")
}
export function supplierDraft(supplier: Supplier): SupplierInput {
  return supplierInputSchema.parse({ expected_version: supplier.version, name: supplier.name, status: supplier.status,
    company_id: supplier.company_id, commercial_terms: supplier.commercial_terms,
    private_notes: supplier.private_notes, contacts: supplier.contacts, category_ids: supplier.category_ids })
}