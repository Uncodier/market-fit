-- Migration: Auto-activate pending site members when user registers
-- This trigger automatically links new users to their pending site member invitations
-- and creates site_ownership records when the user is an owner

-- Function to activate pending site memberships when a user registers
CREATE OR REPLACE FUNCTION activate_pending_site_memberships()
RETURNS TRIGGER AS $$
DECLARE
    member_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Find all pending site_members with this email
    FOR member_record IN 
        SELECT id, site_id, role, email
        FROM site_members 
        WHERE email = NEW.email 
        AND user_id IS NULL
        AND status = 'pending'
    LOOP
        -- Update the site_member with the new user_id and set status to active
        UPDATE site_members 
        SET 
            user_id = NEW.id,
            status = 'active',
            updated_at = NOW()
        WHERE id = member_record.id;
        
        updated_count := updated_count + 1;
        
        -- If this member is an owner, create the site_ownership record
        IF member_record.role = 'owner' THEN
            INSERT INTO site_ownership (site_id, user_id, created_at)
            VALUES (member_record.site_id, NEW.id, NOW())
            ON CONFLICT (site_id, user_id) DO NOTHING; -- Prevent duplicates
            
            RAISE NOTICE 'Created site_ownership for user % on site %', NEW.email, member_record.site_id;
        END IF;
        
        RAISE NOTICE 'Activated site membership for user % on site % with role %', 
                     NEW.email, member_record.site_id, member_record.role;
    END LOOP;
    
    -- Log the total activations
    IF updated_count > 0 THEN
        RAISE NOTICE 'Activated % pending site memberships for user %', updated_count, NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on profiles table (after user registration)
DROP TRIGGER IF EXISTS activate_pending_memberships_trigger ON profiles;

CREATE TRIGGER activate_pending_memberships_trigger
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION activate_pending_site_memberships();

-- Also create a function to handle manual activation (useful for existing users)
CREATE OR REPLACE FUNCTION manually_activate_user_memberships(user_email TEXT)
RETURNS INTEGER AS $$
DECLARE
    member_record RECORD;
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- First, find the user by email
    SELECT id, email INTO user_record
    FROM profiles 
    WHERE email = user_email
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Find all pending site_members with this email
    FOR member_record IN 
        SELECT id, site_id, role, email
        FROM site_members 
        WHERE email = user_email 
        AND user_id IS NULL
        AND status = 'pending'
    LOOP
        -- Update the site_member with the user_id and set status to active
        UPDATE site_members 
        SET 
            user_id = user_record.id,
            status = 'active',
            updated_at = NOW()
        WHERE id = member_record.id;
        
        updated_count := updated_count + 1;
        
        -- If this member is an owner, create the site_ownership record
        IF member_record.role = 'owner' THEN
            INSERT INTO site_ownership (site_id, user_id, created_at)
            VALUES (member_record.site_id, user_record.id, NOW())
            ON CONFLICT (site_id, user_id) DO NOTHING; -- Prevent duplicates
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION activate_pending_site_memberships() IS 'Automatically activates pending site memberships when a user registers and creates site_ownership for owners';
COMMENT ON FUNCTION manually_activate_user_memberships(TEXT) IS 'Manually activates pending memberships for an existing user by email';
COMMENT ON TRIGGER activate_pending_memberships_trigger ON profiles IS 'Automatically links new users to their pending site member invitations'; 