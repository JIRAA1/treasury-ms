-- Apply BEFORE deploying the matching application. Transactional and rerunnable.
-- Historical unassigned income/expense rows are intentionally NOT guessed/backfilled.
BEGIN;

ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id);
ALTER TABLE public.special_collections ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id);
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS special_slip_id uuid REFERENCES public.special_collection_slips(id);
CREATE UNIQUE INDEX IF NOT EXISTS incomes_special_slip_unique ON public.incomes(special_slip_id);
CREATE INDEX IF NOT EXISTS incomes_semester_idx ON public.incomes(semester_id);
CREATE INDEX IF NOT EXISTS expenses_semester_idx ON public.expenses(semester_id);
CREATE INDEX IF NOT EXISTS payments_period_status_idx ON public.payments(period_id, status);
CREATE INDEX IF NOT EXISTS payments_verified_idx ON public.payments(verified_at) WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.assign_active_semester() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.semester_id IS NULL THEN
    SELECT id INTO NEW.semester_id FROM public.semesters WHERE is_active LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assign_semester ON public.incomes;
CREATE TRIGGER assign_semester BEFORE INSERT ON public.incomes FOR EACH ROW EXECUTE FUNCTION public.assign_active_semester();
DROP TRIGGER IF EXISTS assign_semester ON public.expenses;
CREATE TRIGGER assign_semester BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.assign_active_semester();
DROP TRIGGER IF EXISTS assign_semester ON public.special_collections;
CREATE TRIGGER assign_semester BEFORE INSERT ON public.special_collections FOR EACH ROW EXECUTE FUNCTION public.assign_active_semester();

-- Resolve identity from server-controlled auth records, never editable user_metadata.
CREATE OR REPLACE FUNCTION public.treasury_profile_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id FROM public.users u JOIN auth.users a ON a.id = auth.uid()
  WHERE u.id = a.id OR (a.email_confirmed_at IS NOT NULL AND
    (lower(u.email) = lower(a.email) OR lower(a.email) = lower(u.student_id || '@treasury.local')))
  ORDER BY (u.id = a.id) DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.treasury_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.treasury_profile_id() TO authenticated, service_role;

-- Remove all old permissive policies on these three tables, including renamed copies.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    AND tablename IN ('special_collections', 'special_collection_items', 'special_collection_slips')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;
ALTER TABLE public.special_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_collection_slips ENABLE ROW LEVEL SECURITY;
CREATE POLICY collections_read ON public.special_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY items_read ON public.special_collection_items FOR SELECT TO authenticated USING (
  user_id = public.treasury_profile_id() OR EXISTS (SELECT 1 FROM public.users WHERE id = public.treasury_profile_id() AND role IN ('admin','treasurer'))
);
CREATE POLICY slips_read ON public.special_collection_slips FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.special_collection_items WHERE id = item_id)
);
REVOKE INSERT, UPDATE, DELETE ON public.special_collections, public.special_collection_items, public.special_collection_slips FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;

-- Serialize duplicate checks across both payment systems. Also protects concurrent inserts.
-- Carry rows share the reference of the main transfer, but cannot cross users/systems.
CREATE OR REPLACE FUNCTION public.guard_transfer_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE root_ref text;
BEGIN
  IF NEW.status = 'rejected' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(928202601);
  root_ref := regexp_replace(NEW.trans_ref, '_carry_.*$', '');
  IF TG_TABLE_NAME = 'payments' THEN
    IF EXISTS (SELECT 1 FROM public.special_collection_slips s WHERE s.status <> 'rejected'
      AND ((root_ref IS NOT NULL AND s.trans_ref = root_ref) OR (NEW.file_hash IS NOT NULL AND s.file_hash = NEW.file_hash))) THEN
      RAISE EXCEPTION 'DUPLICATE_SLIP' USING ERRCODE = '23505';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payments p WHERE p.id <> NEW.id AND p.status <> 'rejected'
      AND ((NEW.file_hash IS NOT NULL AND p.file_hash = NEW.file_hash)
        OR (root_ref IS NOT NULL AND regexp_replace(p.trans_ref, '_carry_.*$', '') = root_ref AND p.user_id <> NEW.user_id))) THEN
      RAISE EXCEPTION 'DUPLICATE_SLIP' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.payments p WHERE p.status <> 'rejected'
      AND ((root_ref IS NOT NULL AND regexp_replace(p.trans_ref, '_carry_.*$', '') = root_ref)
        OR (NEW.file_hash IS NOT NULL AND p.file_hash = NEW.file_hash)))
      OR EXISTS (SELECT 1 FROM public.special_collection_slips s WHERE s.id <> NEW.id AND s.status <> 'rejected'
        AND ((root_ref IS NOT NULL AND s.trans_ref = root_ref) OR (NEW.file_hash IS NOT NULL AND s.file_hash = NEW.file_hash))) THEN
      RAISE EXCEPTION 'DUPLICATE_SLIP' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_transfer ON public.payments;
CREATE TRIGGER guard_transfer BEFORE INSERT OR UPDATE OF trans_ref, file_hash, status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_reference();
DROP TRIGGER IF EXISTS guard_transfer ON public.special_collection_slips;
CREATE TRIGGER guard_transfer BEFORE INSERT OR UPDATE OF trans_ref, file_hash, status ON public.special_collection_slips
  FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_reference();

CREATE OR REPLACE FUNCTION public.save_regular_payments(p_user_id uuid, p_rows jsonb, p_actor_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_data jsonb; saved public.payments; prior public.payments; results jsonb := '[]'; semester uuid; this_semester uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'INVALID_PAYMENT'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE status <> 'rejected' AND
    regexp_replace(trans_ref, '_carry_.*$', '') = p_rows->0->>'trans_ref') THEN
    RAISE EXCEPTION 'DUPLICATE_SLIP' USING ERRCODE='23505';
  END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    IF (row_data->>'amount')::numeric <= 0 OR (row_data->>'amount')::numeric > 999999999.99
      OR round((row_data->>'amount')::numeric,2) <> (row_data->>'amount')::numeric THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    SELECT semester_id INTO this_semester FROM public.periods WHERE id = (row_data->>'period_id')::uuid
      AND (open_at IS NULL OR open_at <= now());
    IF NOT FOUND OR (semester IS NOT NULL AND semester <> this_semester) THEN RAISE EXCEPTION 'INVALID_PERIOD'; END IF;
    semester := this_semester;
    SELECT * INTO prior FROM public.payments WHERE user_id = p_user_id AND period_id = (row_data->>'period_id')::uuid FOR UPDATE;
    IF FOUND AND prior.status <> 'rejected' THEN RAISE EXCEPTION 'PAYMENT_EXISTS' USING ERRCODE = '23505'; END IF;
    IF row_data->>'status' = 'approved'
      AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND role IN ('admin','treasurer'))
      AND NOT (coalesce((row_data->>'verified_by_api')::boolean,false) AND EXISTS (
        SELECT 1 FROM public.payment_credits WHERE user_id=p_user_id AND period_id=(row_data->>'period_id')::uuid AND status='pending')) THEN
      RAISE EXCEPTION 'ADMIN_REQUIRED';
    END IF;
    INSERT INTO public.payments(id,user_id,period_id,amount,status,trans_ref,file_hash,slip_url,note,verified_by_api,verified_at,created_at)
    VALUES (coalesce(prior.id,gen_random_uuid()),p_user_id,(row_data->>'period_id')::uuid,(row_data->>'amount')::numeric,
      row_data->>'status',row_data->>'trans_ref',row_data->>'file_hash',row_data->>'slip_url',row_data->>'note',
      coalesce((row_data->>'verified_by_api')::boolean,false),
      CASE WHEN row_data->>'status' = 'approved' THEN coalesce((row_data->>'verified_at')::timestamptz,now()) END,now())
    ON CONFLICT (id) DO UPDATE SET amount=excluded.amount,status=excluded.status,trans_ref=excluded.trans_ref,
      file_hash=excluded.file_hash,slip_url=excluded.slip_url,note=excluded.note,verified_by_api=excluded.verified_by_api,
      verified_at=excluded.verified_at,created_at=excluded.created_at RETURNING * INTO saved;
    IF saved.status = 'approved' THEN
      UPDATE public.payment_credits SET status='repaid',repaid_at=now(),repaid_via=saved.id
      WHERE user_id=p_user_id AND period_id=saved.period_id AND status='pending';
    END IF;
    INSERT INTO public.audit_logs(actor_id,action,target_id,new_value)
      VALUES(coalesce(p_actor_id,p_user_id),'payment_recorded',saved.id,to_jsonb(saved));
    results := results || jsonb_build_array(to_jsonb(saved));
  END LOOP;
  RETURN results;
END $$;

CREATE OR REPLACE FUNCTION public.review_regular_payment(p_id uuid,p_actor_id uuid,p_action text,p_amount numeric DEFAULT NULL,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payment public.payments; old_payment public.payments; desired text;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND role IN ('admin','treasurer')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  SELECT * INTO payment FROM public.payments WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;
  old_payment := payment;
  IF p_action = 'edit_amount' THEN
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 999999999.99 OR round(p_amount,2) <> p_amount THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    UPDATE public.payments SET amount=p_amount WHERE id=p_id RETURNING * INTO payment;
  ELSE
    desired := CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' WHEN 'pending' THEN 'pending' END;
    IF desired IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
    IF payment.status = desired THEN RETURN jsonb_build_object('payment',to_jsonb(payment),'unchanged',true); END IF;
    IF payment.status = 'rejected' AND desired = 'approved' THEN RAISE EXCEPTION 'RESUBMIT_REQUIRED'; END IF;
    UPDATE public.payments SET status=desired,verified_at=CASE WHEN desired='approved' THEN now() END
      WHERE id=p_id RETURNING * INTO payment;
    IF desired = 'approved' THEN
      UPDATE public.payment_credits SET status='repaid',repaid_at=now(),repaid_via=p_id
        WHERE user_id=payment.user_id AND period_id=payment.period_id AND status='pending';
    ELSE
      UPDATE public.payment_credits SET status='pending',repaid_at=NULL,repaid_via=NULL WHERE repaid_via=p_id AND status='repaid';
    END IF;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,target_id,old_value,new_value) VALUES(p_actor_id,'payment_' || p_action,p_id,to_jsonb(old_payment),to_jsonb(payment) || jsonb_build_object('reason',p_note));
  RETURN jsonb_build_object('payment',to_jsonb(payment),'unchanged',false);
END $$;

CREATE OR REPLACE FUNCTION public.save_special_slip(p_user_id uuid,p_collection_id uuid,p_item_id uuid,p_mode text,p_installments integer,p_slip jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item public.special_collection_items; collection public.special_collections; saved public.special_collection_slips; due numeric; count_slips integer;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  SELECT * INTO item FROM public.special_collection_items WHERE id=p_item_id AND user_id=p_user_id AND collection_id=p_collection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
  SELECT * INTO collection FROM public.special_collections WHERE id=p_collection_id;
  IF NOT collection.is_active THEN RAISE EXCEPTION 'COLLECTION_CLOSED'; END IF;
  IF EXISTS (SELECT 1 FROM public.special_collection_slips WHERE item_id=p_item_id AND status='pending') THEN RAISE EXCEPTION 'PAYMENT_EXISTS' USING ERRCODE='23505'; END IF;
  p_mode := coalesce(item.payment_mode,p_mode);
  p_installments := CASE WHEN item.payment_mode IS NOT NULL THEN item.chosen_installments ELSE p_installments END;
  IF p_mode IS NULL OR p_mode NOT IN ('full','installment') THEN RAISE EXCEPTION 'INVALID_MODE'; END IF;
  IF p_mode='full' THEN p_installments:=1;
  ELSIF NOT collection.allow_installments OR p_installments IS NULL OR p_installments < 2 OR p_installments > collection.max_installments THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  due := item.amount-item.paid_amount;
  IF due <= 0 THEN RAISE EXCEPTION 'ALREADY_PAID'; END IF;
  IF p_mode='installment' AND NOT coalesce((p_slip->>'is_payoff')::boolean,false) THEN due:=least(ceil(item.amount/p_installments),due); END IF;
  IF (p_slip->>'amount')::numeric IS DISTINCT FROM due THEN RAISE EXCEPTION 'AMOUNT_CHANGED'; END IF;
  SELECT count(*) INTO count_slips FROM public.special_collection_slips WHERE item_id=p_item_id AND status <> 'rejected';
  INSERT INTO public.special_collection_slips(item_id,installment_no,amount,is_payoff,slip_url,trans_ref,file_hash,status,verified_by_api)
    VALUES(p_item_id,count_slips+1,due,coalesce((p_slip->>'is_payoff')::boolean,false),p_slip->>'slip_url',p_slip->>'trans_ref',p_slip->>'file_hash','pending',coalesce((p_slip->>'verified_by_api')::boolean,false)) RETURNING * INTO saved;
  UPDATE public.special_collection_items SET status='pending',payment_mode=p_mode,chosen_installments=p_installments WHERE id=p_item_id;
  INSERT INTO public.audit_logs(actor_id,action,target_id,new_value) VALUES(p_user_id,'special_slip_uploaded',saved.id,to_jsonb(saved));
  RETURN to_jsonb(saved);
END $$;

CREATE OR REPLACE FUNCTION public.review_special_slip(p_id uuid,p_actor_id uuid,p_action text,p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE slip public.special_collection_slips; item public.special_collection_items; collection public.special_collections; total_paid numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(928202601);
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_actor_id AND role IN ('admin','treasurer')) THEN RAISE EXCEPTION 'ADMIN_REQUIRED'; END IF;
  IF p_action NOT IN ('approve','reject') OR p_action IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
  SELECT * INTO slip FROM public.special_collection_slips WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SLIP_NOT_FOUND'; END IF;
  SELECT * INTO item FROM public.special_collection_items WHERE id=slip.item_id FOR UPDATE;
  SELECT * INTO collection FROM public.special_collections WHERE id=item.collection_id;
  IF slip.status = (CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END) THEN
    RETURN jsonb_build_object('unchanged',true,'item_status',item.status,'user_id',item.user_id,'amount',slip.amount,'title',collection.title);
  END IF;
  -- Reversal must be an explicit accounting operation; never silently rewrite approved history.
  IF slip.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  IF p_action='approve' THEN
    total_paid := item.paid_amount+slip.amount;
    IF slip.amount <= 0 OR total_paid > item.amount THEN RAISE EXCEPTION 'OVERPAYMENT'; END IF;
    UPDATE public.special_collection_slips SET status='approved',verified_at=now(),verified_by=p_actor_id WHERE id=p_id;
    UPDATE public.special_collection_items SET paid_amount=total_paid,status=CASE WHEN total_paid=item.amount THEN 'approved' ELSE 'partial' END WHERE id=item.id RETURNING * INTO item;
    INSERT INTO public.incomes(title,description,amount,created_by,approved_by,source,special_slip_id,semester_id)
      VALUES('การเก็บเงินพิเศษ: ' || collection.title,'สลิป ' || p_id,slip.amount,p_actor_id,p_actor_id,'special_collection',p_id,collection.semester_id);
  ELSE
    IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
    UPDATE public.special_collection_slips SET status='rejected',rejection_reason=p_reason,verified_at=now(),verified_by=p_actor_id WHERE id=p_id;
    UPDATE public.special_collection_items SET status=CASE WHEN paid_amount>=amount THEN 'approved' WHEN paid_amount>0 THEN 'partial' ELSE 'unpaid' END WHERE id=item.id RETURNING * INTO item;
  END IF;
  INSERT INTO public.audit_logs(actor_id,action,target_id,new_value) VALUES(p_actor_id,'special_slip_' || p_action,p_id,jsonb_build_object('amount',slip.amount,'reason',p_reason));
  RETURN jsonb_build_object('unchanged',false,'item_status',item.status,'user_id',item.user_id,'amount',slip.amount,'title',collection.title);
END $$;

-- All mutation RPCs are service-only. The HTTP handlers authenticate and authorize first.
REVOKE ALL ON FUNCTION public.save_regular_payments(uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_regular_payment(uuid,uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_special_slip(uuid,uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.review_special_slip(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_regular_payments(uuid,jsonb,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_regular_payment(uuid,uuid,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_special_slip(uuid,uuid,uuid,text,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_special_slip(uuid,uuid,text,text) TO service_role;
COMMIT;
