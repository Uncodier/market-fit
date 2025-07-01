-- Fix Function Search Path Mutable Warnings
-- This migration fixes all functions that have mutable search_path by setting it to empty string
-- This prevents schema injection attacks and improves security

-- Set search_path for all functions to prevent security warnings
-- Each function will use an empty search_path making it secure

-- Use DO block to handle functions that may not exist
DO $$
BEGIN
    -- Batch 1: Core utility functions (with error handling)
    BEGIN
        ALTER FUNCTION public.is_valid_task_type(TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for is_valid_task_type';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function is_valid_task_type does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_updated_at() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_updated_at';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_updated_at does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.add_credits(UUID, INTEGER) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for add_credits';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function add_credits does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.upsert_billing(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, TEXT, TIMESTAMP) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for upsert_billing';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function upsert_billing does not exist or has different signature, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_command_update() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_command_update';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_command_update does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_command_insert() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_command_insert';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_command_insert does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.generate_task_serial_id() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for generate_task_serial_id';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function generate_task_serial_id does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.set_task_serial_id() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for set_task_serial_id';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function set_task_serial_id does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_event_insert() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_event_insert';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_event_insert does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.user_has_access_to_site(UUID, UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for user_has_access_to_site';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function user_has_access_to_site does not exist or has different signature, skipping';
    END;

    -- Batch 2: Logging and asset functions
    BEGIN
        ALTER FUNCTION public.log_asset_insert() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for log_asset_insert';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function log_asset_insert does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.set_current_timestamp_updated_at() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for set_current_timestamp_updated_at';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function set_current_timestamp_updated_at does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.delete_site_safely(UUID) SET search_path = 'public';
        RAISE NOTICE 'Fixed search_path for delete_site_safely to "public"';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function delete_site_safely does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.update_conversation_last_message_time() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for update_conversation_last_message_time';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function update_conversation_last_message_time does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.is_superadmin() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for is_superadmin';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function is_superadmin does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.get_user_profile_complete() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for get_user_profile_complete';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function get_user_profile_complete does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.validate_notifications() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for validate_notifications';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function validate_notifications does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.sync_site_ownership() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for sync_site_ownership';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function sync_site_ownership does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.migrate_team_members_to_site_members() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for migrate_team_members_to_site_members';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function migrate_team_members_to_site_members does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.sync_site_members_to_team_members() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for sync_site_members_to_team_members';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function sync_site_members_to_team_members does not exist, skipping';
    END;

    -- Batch 3: Security and token functions
    BEGIN
        ALTER FUNCTION public.encrypt_token(TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for encrypt_token';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function encrypt_token does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.decrypt_token(TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for decrypt_token';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function decrypt_token does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.store_secure_token(UUID, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for store_secure_token';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function store_secure_token does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.get_secure_token(UUID, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for get_secure_token';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function get_secure_token does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.delete_secure_token(UUID, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for delete_secure_token';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function delete_secure_token does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.validate_performance_bitmask(INTEGER) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for validate_performance_bitmask';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function validate_performance_bitmask does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.set_like(UUID, UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for set_like';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function set_like does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.update_timestamp() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for update_timestamp';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function update_timestamp does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.set_dislike(UUID, UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for set_dislike';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function set_dislike does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.toggle_flag(UUID, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for toggle_flag';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function toggle_flag does not exist, skipping';
    END;

    -- Batch 4: Performance and status functions
    BEGIN
        ALTER FUNCTION public.get_performance_status(INTEGER) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for get_performance_status';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function get_performance_status does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.sync_site_members_to_settings() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for sync_site_members_to_settings';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function sync_site_members_to_settings does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_session_active_state() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_session_active_state';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_session_active_state does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_session_events_updated_at() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_session_events_updated_at';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_session_events_updated_at does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.update_sale_orders_updated_at() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for update_sale_orders_updated_at';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function update_sale_orders_updated_at does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for update_updated_at_column';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function update_updated_at_column does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.expire_old_api_keys() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for expire_old_api_keys';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function expire_old_api_keys does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.update_api_key_last_used(UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for update_api_key_last_used';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function update_api_key_last_used does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_campaign_deletion() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_campaign_deletion';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_campaign_deletion does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.set_task_priority_from_serial() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for set_task_priority_from_serial';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function set_task_priority_from_serial does not exist, skipping';
    END;

    -- Batch 5: Command and campaign functions
    BEGIN
        ALTER FUNCTION public.delete_command_cascade(UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for delete_command_cascade';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function delete_command_cascade does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.delete_command_simple(UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for delete_command_simple';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function delete_command_simple does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_campaign_deletion_orphans_only() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_campaign_deletion_orphans_only';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_campaign_deletion_orphans_only does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.prevent_last_admin_role_change() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for prevent_last_admin_role_change';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function prevent_last_admin_role_change does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.prevent_last_admin_deletion() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for prevent_last_admin_deletion';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function prevent_last_admin_deletion does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.register_referral_code_use(TEXT, UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for register_referral_code_use';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function register_referral_code_use does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.manually_activate_user_memberships(UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for manually_activate_user_memberships';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function manually_activate_user_memberships does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.increment_referral_code_usage(TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for increment_referral_code_usage';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function increment_referral_code_usage does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.add_to_waitlist(TEXT, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for add_to_waitlist';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function add_to_waitlist does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.validate_referral_code(TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for validate_referral_code';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function validate_referral_code does not exist, skipping';
    END;

    -- Batch 6: Task and priority functions
    BEGIN
        ALTER FUNCTION public.reorder_task_priorities(UUID[]) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for reorder_task_priorities';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function reorder_task_priorities does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.record_payment(UUID, NUMERIC, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for record_payment';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function record_payment does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_new_user() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_new_user';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_new_user does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_new_user_simple() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_new_user_simple';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_new_user_simple does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.log_debug(TEXT, JSONB) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for log_debug';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function log_debug does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.handle_new_user_debug() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for handle_new_user_debug';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function handle_new_user_debug does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.simulate_user_creation(TEXT, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for simulate_user_creation';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function simulate_user_creation does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.check_referral_system_status() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for check_referral_system_status';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function check_referral_system_status does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.process_referral_code_use(TEXT, UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for process_referral_code_use';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function process_referral_code_use does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.activate_pending_site_memberships(UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for activate_pending_site_memberships';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function activate_pending_site_memberships does not exist, skipping';
    END;

    -- Batch 7: Cron and analytics functions
    BEGIN
        ALTER FUNCTION public.update_cron_status_updated_at() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for update_cron_status_updated_at';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function update_cron_status_updated_at does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.increment_agent_conversations(UUID) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for increment_agent_conversations';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function increment_agent_conversations does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.calculate_kpis_from_events() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for calculate_kpis_from_events';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function calculate_kpis_from_events does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.get_auth_user_id() SET search_path = '';
        RAISE NOTICE 'Fixed search_path for get_auth_user_id';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function get_auth_user_id does not exist, skipping';
    END;
    
    BEGIN
        ALTER FUNCTION public.sync_auth0_user(TEXT, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE 'Fixed search_path for sync_auth0_user';
    EXCEPTION
        WHEN undefined_function THEN
            RAISE NOTICE 'Function sync_auth0_user does not exist, skipping';
    END;

END $$;

-- Success message
SELECT 'Function search_path security warnings fixed successfully - all existing functions updated' AS status; 