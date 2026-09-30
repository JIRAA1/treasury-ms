-- Run after migration_payment_integrity.sql and migration_special_corrections.sql.
BEGIN;
ALTER TABLE public.special_collection_slips ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'transfer' CHECK (payment_method IN ('transfer','cash'));
ALTER TABLE public.special_collection_slips ADD COLUMN IF NOT EXISTS payment_note text;
ALTER TABLE public.special_collection_slips ALTER COLUMN slip_url DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.record_special_cash(
  p_id uuid, p_actor_id uuid, p_request_id uuid, p_amount numeric,
  p_mode text, p_installments integer, p_expected_paid numeric, p_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item public.special_collection_items; collection public.special_collections;
  receipt public.special_collection_slips; next_no integer; result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND role IN ('admin','treasurer')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>999999999.99 OR round(p_amount,2)<>p_amount THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  SELECT * INTO receipt FROM public.special_collection_slips WHERE id=p_request_id;
  IF FOUND THEN
    IF receipt.item_id<>p_id OR receipt.payment_method<>'cash' OR receipt.amount<>p_amount THEN RAISE EXCEPTION 'REQUEST_CONFLICT'; END IF;
    RETURN jsonb_build_object('success',true,'unchanged',true,'receipt_id',receipt.id);
  END IF;
  SELECT * INTO item FROM public.special_collection_items WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  SELECT * INTO collection FROM public.special_collections WHERE id=item.collection_id FOR UPDATE;
  IF NOT collection.is_active THEN RAISE EXCEPTION 'COLLECTION_CLOSED'; END IF;
  IF p_expected_paid IS DISTINCT FROM item.paid_amount THEN RAISE EXCEPTION 'STALE_DATA'; END IF;
  IF EXISTS (SELECT 1 FROM public.special_collection_slips WHERE item_id=p_id AND status='pending') THEN RAISE EXCEPTION 'PENDING_SLIP'; END IF;
  IF item.paid_amount>=item.amount THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF p_amount>item.amount-item.paid_amount THEN RAISE EXCEPTION 'OVERPAYMENT'; END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('full','installment') THEN RAISE EXCEPTION 'INVALID_MODE'; END IF;
  IF p_mode='full' THEN
    p_installments:=1;
    IF p_amount<>item.amount-item.paid_amount THEN RAISE EXCEPTION 'FULL_AMOUNT_REQUIRED'; END IF;
  ELSIF p_installments IS NULL OR p_installments<2 OR
    ((NOT collection.allow_installments OR p_installments>collection.max_installments)
    AND NOT coalesce(item.payment_mode='installment' AND item.chosen_installments=p_installments,false)) THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  SELECT coalesce(max(installment_no),0)+1 INTO next_no FROM public.special_collection_slips WHERE item_id=p_id;
  INSERT INTO public.special_collection_slips(id,item_id,installment_no,amount,is_payoff,slip_url,status,verified_by_api,payment_method,payment_note)
    VALUES(p_request_id,p_id,next_no,p_amount,p_amount=item.amount-item.paid_amount,NULL,'pending',false,'cash',nullif(trim(p_note),''));
  UPDATE public.special_collection_items SET payment_mode=p_mode,chosen_installments=p_installments WHERE id=p_id;
  -- Reuse approval so cash, paid total and its linked income commit together.
  result:=public.review_special_slip(p_request_id,p_actor_id,'approve',NULL);
  UPDATE public.incomes SET description='รับเงินสด' || CASE WHEN nullif(trim(p_note),'') IS NOT NULL THEN ': ' || trim(p_note) ELSE '' END WHERE special_slip_id=p_request_id;
  INSERT INTO public.audit_logs(actor_id,action,target_id,old_value,new_value)
    VALUES(p_actor_id,'special_cash_received',p_id,to_jsonb(item),jsonb_build_object('receipt_id',p_request_id,'amount',p_amount,'payment_method','cash','payment_mode',p_mode,'chosen_installments',p_installments,'note',p_note));
  RETURN result || jsonb_build_object('success',true,'receipt_id',p_request_id);
END $$;
REVOKE ALL ON FUNCTION public.record_special_cash(uuid,uuid,uuid,numeric,text,integer,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_special_cash(uuid,uuid,uuid,numeric,text,integer,numeric,text) TO service_role;
COMMIT;
