-- Run AFTER migration_payment_integrity.sql. Safe to run again.
BEGIN;
CREATE OR REPLACE FUNCTION public.correct_special_item(
  p_id uuid, p_actor_id uuid, p_mode text, p_installments integer,
  p_slips jsonb, p_expected jsonb, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item public.special_collection_items; collection public.special_collections;
  old_slips jsonb; old_incomes jsonb; snapshot jsonb; entry jsonb;
  slip public.special_collection_slips; total_paid numeric; pending_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND role IN ('admin','treasurer')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  SELECT * INTO item FROM public.special_collection_items WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  SELECT * INTO collection FROM public.special_collections WHERE id=item.collection_id FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') INTO old_slips FROM public.special_collection_slips s WHERE item_id=p_id;
  SELECT jsonb_build_object('payment_mode',item.payment_mode,'chosen_installments',item.chosen_installments,
    'amount',item.amount,'paid_amount',item.paid_amount,'slips',coalesce(jsonb_agg(jsonb_build_object('id',s.id,'amount',s.amount,'status',s.status) ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL),'[]'))
    INTO snapshot FROM public.special_collection_slips s WHERE item_id=p_id;
  IF p_expected IS DISTINCT FROM snapshot THEN RAISE EXCEPTION 'STALE_DATA'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('full','installment') THEN RAISE EXCEPTION 'INVALID_MODE'; END IF;
  IF p_mode='full' THEN p_installments:=1;
  ELSIF p_installments IS NULL OR p_installments<2 OR
    ((NOT collection.allow_installments OR p_installments>collection.max_installments)
      AND NOT (item.payment_mode='installment' AND item.chosen_installments=p_installments)) THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  IF p_slips IS NULL OR jsonb_typeof(p_slips)<>'array' THEN RAISE EXCEPTION 'INVALID_SLIPS'; END IF;
  IF jsonb_array_length(p_slips)<>jsonb_array_length(old_slips)
    OR (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_slips))<>jsonb_array_length(old_slips)
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_slips) e WHERE NOT EXISTS (SELECT 1 FROM public.special_collection_slips s WHERE s.id=(e->>'id')::uuid AND s.item_id=p_id)) THEN RAISE EXCEPTION 'INVALID_SLIPS'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') INTO old_incomes FROM public.incomes i WHERE special_slip_id IN (SELECT id FROM public.special_collection_slips WHERE item_id=p_id);
  FOR entry IN SELECT value FROM jsonb_array_elements(p_slips) LOOP
    IF entry->>'status' IS NULL OR entry->>'status' NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
    IF entry->>'amount' IS NULL OR (entry->>'amount')::numeric<=0 OR (entry->>'amount')::numeric>999999999.99 OR round((entry->>'amount')::numeric,2)<>(entry->>'amount')::numeric THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    SELECT * INTO slip FROM public.special_collection_slips WHERE id=(entry->>'id')::uuid FOR UPDATE;
    IF slip.amount IS DISTINCT FROM (entry->>'amount')::numeric OR slip.status IS DISTINCT FROM entry->>'status' THEN
      UPDATE public.special_collection_slips SET amount=(entry->>'amount')::numeric,status=entry->>'status',
        verified_by_api=false,verified_at=CASE WHEN entry->>'status'<>'pending' THEN now() END,
        verified_by=CASE WHEN entry->>'status'<>'pending' THEN p_actor_id END,
        rejection_reason=CASE WHEN entry->>'status'='rejected' THEN p_reason END WHERE id=slip.id;
      IF entry->>'status'='approved' THEN
        INSERT INTO public.incomes(title,description,amount,created_by,approved_by,source,special_slip_id,semester_id)
          VALUES('การเก็บเงินพิเศษ: ' || collection.title,p_reason,(entry->>'amount')::numeric,p_actor_id,p_actor_id,'special_collection',slip.id,collection.semester_id)
          ON CONFLICT (special_slip_id) DO UPDATE SET amount=excluded.amount,description=excluded.description,approved_by=excluded.approved_by;
      ELSE
        DELETE FROM public.incomes WHERE special_slip_id=slip.id;
      END IF;
    END IF;
  END LOOP;
  SELECT coalesce(sum(amount) FILTER (WHERE status='approved'),0),count(*) FILTER (WHERE status='pending') INTO total_paid,pending_count FROM public.special_collection_slips WHERE item_id=p_id;
  IF total_paid>item.amount THEN RAISE EXCEPTION 'OVERPAYMENT'; END IF;
  IF pending_count>1 THEN RAISE EXCEPTION 'MULTIPLE_PENDING'; END IF;
  UPDATE public.special_collection_items SET payment_mode=p_mode,chosen_installments=p_installments,paid_amount=total_paid,
    status=CASE WHEN total_paid>=amount THEN 'approved' WHEN pending_count>0 THEN 'pending' WHEN total_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=p_id;
  INSERT INTO public.audit_logs(actor_id,action,target_id,old_value,new_value)
    VALUES(p_actor_id,'special_item_corrected',p_id,jsonb_build_object('item',to_jsonb(item),'slips',old_slips,'incomes',old_incomes),
      jsonb_build_object('reason',p_reason,'payment_mode',p_mode,'chosen_installments',p_installments,'paid_amount',total_paid,'slips',p_slips));
  RETURN jsonb_build_object('success',true,'paid_amount',total_paid);
END $$;
REVOKE ALL ON FUNCTION public.correct_special_item(uuid,uuid,text,integer,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.correct_special_item(uuid,uuid,text,integer,jsonb,jsonb,text) TO service_role;
COMMIT;
