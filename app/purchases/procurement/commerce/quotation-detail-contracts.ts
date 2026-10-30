import type { ProcurementQuotation } from "./contracts"

export interface ProcurementQuotationSupplier {
  id: string
  name: string
  status: "prospect" | "under_review" | "approved" | "blocked" | "archived"
  commercial_terms: string
  contacts: {
    name: string
    email: string
    phone: string
    role: string
    is_primary: boolean
  }[]
}

export interface ProcurementQuotationDetail {
  quotation: ProcurementQuotation
  supplier: ProcurementQuotationSupplier | null
}