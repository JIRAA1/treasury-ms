-- Run after migration_payment_integrity.sql. Safe to run again.
BEGIN;
CREATE OR REPLACE FUNCTION public.assign_accounting_semester(p_actor_id uuid,p_semester_id uuid,p_records jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry jsonb; previous jsonb; saved jsonb; table_name text; record_id uuid;
  changed integer:=0; unchanged integer:=0; semester_name text;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND role IN ('admin','treasurer')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT name INTO semester_name FROM public.semesters WHERE id=p_semester_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SEMESTER_NOT_FOUND'; END IF;
  IF p_records IS NULL OR jsonb_typeof(p_records)<>'array' THEN RAISE EXCEPTION 'INVALID_RECORDS'; END IF;
  IF jsonb_array_length(p_records) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'INVALID_RECORDS'; END IF;
  IF (SELECT count(DISTINCT (value->>'type',value->>'id')) FROM jsonb_array_elements(p_records))<>jsonb_array_length(p_records) THEN RAISE EXCEPTION 'INVALID_RECORDS'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    table_name:=CASE entry->>'type' WHEN 'income' THEN 'incomes' WHEN 'expense' THEN 'expenses' END;
    IF table_name IS NULL OR entry->>'id' IS NULL THEN RAISE EXCEPTION 'INVALID_RECORDS'; END IF;
    record_id:=(entry->>'id')::uuid;
    EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 FOR UPDATE',table_name) INTO previous USING record_id;
    IF previous IS NULL THEN RAISE EXCEPTION 'RECORD_NOT_FOUND'; END IF;
    IF previous->>'semester_id' IS NOT NULL THEN
      IF previous->>'semester_id'=p_semester_id::text THEN unchanged:=unchanged+1; CONTINUE; END IF;
      RAISE EXCEPTION 'SEMESTER_ALREADY_ASSIGNED';
    END IF;
    EXECUTE format('UPDATE public.%I SET semester_id=$1 WHERE id=$2 RETURNING to_jsonb(%I)',table_name,table_name)
      INTO saved USING p_semester_id,record_id;
    INSERT INTO public.audit_logs(actor_id,action,target_id,old_value,new_value)
      VALUES(p_actor_id,'accounting_semester_assigned',record_id,previous || jsonb_build_object('record_type',entry->>'type'),
        saved || jsonb_build_object('record_type',entry->>'type','semester_name',semester_name));
    changed:=changed+1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'changed',changed,'unchanged',unchanged);
END $$;
REVOKE ALL ON FUNCTION public.assign_accounting_semester(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_accounting_semester(uuid,uuid,jsonb) TO service_role;
COMMIT;
