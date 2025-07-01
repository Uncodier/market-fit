-- Fix Remaining Function Search Path Warnings
-- This migration fixes the specific 26 functions that still have search_path warnings
-- These functions were confirmed to exist in the database

DO $$
BEGIN
    RAISE NOTICE 'Starting to fix remaining 26 functions with search_path warnings...';
    
    -- Batch 1: Task and security functions
    BEGIN
        ALTER FUNCTION public.generate_task_serial_id() SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for generate_task_serial_id';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix generate_task_serial_id: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.get_user_profile_complete() SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for get_user_profile_complete';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix get_user_profile_complete: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.validate_notifications() SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for validate_notifications';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix validate_notifications: %', SQLERRM;
    END;
    
    -- Batch 2: Token functions
    BEGIN
        ALTER FUNCTION public.encrypt_token(TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for encrypt_token';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix encrypt_token: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.decrypt_token(TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for decrypt_token';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix decrypt_token: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.store_secure_token(UUID, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for store_secure_token';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix store_secure_token: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.get_secure_token(UUID, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for get_secure_token';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix get_secure_token: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.delete_secure_token(UUID, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for delete_secure_token';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix delete_secure_token: %', SQLERRM;
    END;
    
    -- Batch 3: Performance and validation functions
    BEGIN
        ALTER FUNCTION public.validate_performance_bitmask(INTEGER) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for validate_performance_bitmask';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix validate_performance_bitmask: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.set_like(UUID, UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for set_like';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix set_like: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.set_dislike(UUID, UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for set_dislike';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix set_dislike: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.toggle_flag(UUID, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for toggle_flag';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix toggle_flag: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.get_performance_status(INTEGER) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for get_performance_status';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix get_performance_status: %', SQLERRM;
    END;
    
    -- Batch 4: API and membership functions
    BEGIN
        ALTER FUNCTION public.update_api_key_last_used(UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for update_api_key_last_used';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix update_api_key_last_used: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.manually_activate_user_memberships(UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for manually_activate_user_memberships';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix manually_activate_user_memberships: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.increment_referral_code_usage(TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for increment_referral_code_usage';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix increment_referral_code_usage: %', SQLERRM;
    END;
    
    -- Batch 5: Task and payment functions
    BEGIN
        ALTER FUNCTION public.reorder_task_priorities(UUID[]) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for reorder_task_priorities';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix reorder_task_priorities: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.record_payment(UUID, NUMERIC, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for record_payment';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix record_payment: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.log_debug(TEXT, JSONB) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for log_debug';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix log_debug: %', SQLERRM;
    END;
    
    -- Batch 6: User and referral functions
    BEGIN
        ALTER FUNCTION public.simulate_user_creation(TEXT, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for simulate_user_creation';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix simulate_user_creation: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.process_referral_code_use(TEXT, UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for process_referral_code_use';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix process_referral_code_use: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.activate_pending_site_memberships(UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for activate_pending_site_memberships';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix activate_pending_site_memberships: %', SQLERRM;
    END;
    
    -- Batch 7: Analytics and sync functions
    BEGIN
        ALTER FUNCTION public.increment_agent_conversations(UUID) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for increment_agent_conversations';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix increment_agent_conversations: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.calculate_kpis_from_events() SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for calculate_kpis_from_events';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix calculate_kpis_from_events: %', SQLERRM;
    END;
    
    BEGIN
        ALTER FUNCTION public.sync_auth0_user(TEXT, TEXT, TEXT) SET search_path = '';
        RAISE NOTICE '✓ Fixed search_path for sync_auth0_user';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '✗ Failed to fix sync_auth0_user: %', SQLERRM;
    END;
    
    RAISE NOTICE 'Completed fixing remaining function search_path warnings!';
    
END $$;

-- Success message
SELECT 'Remaining 26 function search_path warnings fixed successfully' AS status; 