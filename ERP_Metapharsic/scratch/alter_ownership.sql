-- Change ownership of all tables to erp_user
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner = 'postgres') LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) || ' OWNER TO erp_user';
    END LOOP;
END$$;

-- Change ownership of all views to erp_user
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewowner = 'postgres') LOOP
        EXECUTE 'ALTER VIEW ' || quote_ident(r.viewname) || ' OWNER TO erp_user';
    END LOOP;
END$$;

-- Change ownership of all sequences to erp_user
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM pg_sequences WHERE schemaname = 'public' AND sequence_owner = 'postgres') LOOP
        EXECUTE 'ALTER SEQUENCE ' || quote_ident(r.sequence_name) || ' OWNER TO erp_user';
    END LOOP;
END$$;
