-- Fix database permissions for goblinhelper user
-- Run this script as postgres user on the database server

-- Grant permissions on applications table
GRANT SELECT, INSERT , UPDATE, DELETE ON applications TO goblinhelper;

-- Grant permissions on sequences (for auto-increment columns)
GRANT USAGE,
SELECT
    ON ALL SEQUENCES IN SCHEMA public TO goblinhelper;

-- Grant permissions on any other tables that might be missing
GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON ALL TABLES IN SCHEMA public TO goblinhelper;

-- Verify permissions
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE
    grantee = 'goblinhelper'
    AND table_name = 'applications'
ORDER BY table_name, privilege_type;