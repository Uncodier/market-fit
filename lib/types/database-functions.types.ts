export interface DatabaseFunctions<TSite> {
  get_my_accessible_sites: {
    Args: Record<PropertyKey, never>
    Returns: TSite[]
  }
  current_user_site_role: {
    Args: { p_site_id: string }
    Returns: string | null
  }
  user_can: {
    Args: { p_site_id: string; p_command: string }
    Returns: boolean
  }
  get_my_site_capabilities: {
    Args: { p_site_id: string }
    Returns: {
      role: string | null
      is_owner: boolean
      select: boolean
      insert: boolean
      update: boolean
      delete: boolean
      can_select?: boolean
      can_insert?: boolean
      can_update?: boolean
      can_delete?: boolean
    }
  }
  mutate_sale_order_item_units: {
    Args: {
      p_site_id: string
      p_unit_ids: string[]
      p_operation: string
      p_assignee_id?: string | null
      p_status?: string | null
    }
    Returns: number
  }
}
