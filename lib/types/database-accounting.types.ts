/** Contracts for the forward-only accounting RPC migrations; no remote schema generation. */
export interface AccountingJournalHeader {
  entry_date: string
  memo: string
  source_type: 'manual' | 'opening' | 'sale' | 'expense' | 'purchase'
  source_id: string | null
  idempotency_key: string
  source_hash: string
  currency: string
}

export interface AccountingJournalLine {
  account_code: string
  debit: number
  credit: number
  location_id?: string | null
  lead_id?: string | null
  campaign_id?: string | null
  segment_id?: string | null
  catalog_item_id?: string | null
  catalog_category_id?: string | null
  company_id?: string | null
}

export interface AccountingDatabaseFunctions {
  accounting_report_snapshot: {
    Args: { p_site_id: string; p_from: string | null; p_to_exclusive: string; p_currency: string; p_include_opening: boolean }
    Returns: Record<string, { debit: number; credit: number }>
  }
  accounting_delete_source: {
    Args: { p_site_id: string; p_source_type: 'sale' | 'expense' | 'purchase'; p_source_id: string }
    Returns: undefined
  }
  accounting_update_purchase_items: {
    Args: { p_site_id: string; p_purchase_id: string; p_expected_updated_at: string;
      p_items: { catalog_item_id: string | null; name: string; quantity: number; unit_cost: number; subtotal?: number }[];
      p_update: { title?: string; vendor_company_id?: string | null; status?: string; currency?: string;
        purchase_date?: string; location_id?: string | null; notes?: string | null } }
    Returns: undefined
  }
  accounting_save_journal: {
    Args: { p_site_id: string; p_entry: AccountingJournalHeader; p_lines: AccountingJournalLine[];
      p_entry_id?: string | null; p_expected_hash?: string | null; p_check_version?: boolean }
    Returns: string
  }
  accounting_delete_manual_journal: {
    Args: { p_site_id: string; p_entry_id: string }
    Returns: undefined
  }
  accounting_replace_source_journals: {
    Args: { p_site_id: string; p_source_type: 'sale' | 'expense' | 'purchase'; p_source_id: string;
      p_entries: { entry: AccountingJournalHeader; lines: AccountingJournalLine[] }[];
      p_source_updated_at: string; p_state?: 'posted' | 'unpublished' }
    Returns: undefined
  }
  accounting_record_sale_refund: {
    Args: { p_sale_id: string; p_refund_id: string; p_amount: number; p_currency: string; p_refunded_at: string }
    Returns: undefined
  }
}