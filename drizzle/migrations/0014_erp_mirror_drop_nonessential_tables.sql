DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'erp_mirror' AND left(tablename,1) <> '_'
    AND NOT (tablename = ANY(public.erp_mirror_essential_tables())) LOOP
    EXECUTE format('DROP TABLE IF EXISTS erp_mirror.%I', t.tablename);
  END LOOP;
  DELETE FROM erp_mirror._tables WHERE NOT (table_name = ANY(public.erp_mirror_essential_tables()));
END $$;