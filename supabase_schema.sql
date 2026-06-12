-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  fullname text NOT NULL,
  email text,
  line_user_id text UNIQUE,
  role text NOT NULL DEFAULT 'student'::text CHECK (role = ANY (ARRAY['student'::text, 'treasurer'::text, 'admin'::text])),
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  tier text NOT NULL DEFAULT 'B'::text CHECK (tier = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])),
  tier_note text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  trans_ref text UNIQUE,
  slip_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  note text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  verified_by_api boolean DEFAULT true,
  file_hash text,
  period_id uuid NOT NULL,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_period_unique UNIQUE (user_id, period_id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT payments_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id)
);
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  created_by uuid,
  approved_by uuid,
  receipt_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.system_settings (
  key text NOT NULL,
  value text,
  CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  created_by uuid,
  approved_by uuid,
  source text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incomes_pkey PRIMARY KEY (id),
  CONSTRAINT incomes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT incomes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.payment_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'repaid'::text, 'forgiven'::text])),
  repaid_at timestamp with time zone,
  repaid_via uuid,
  note text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  period_id uuid NOT NULL,
  CONSTRAINT payment_credits_pkey PRIMARY KEY (id),
  CONSTRAINT payment_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT payment_credits_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id)
);
CREATE TABLE public.semesters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT semesters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL,
  label text NOT NULL,
  period_order integer NOT NULL,
  amount numeric DEFAULT 100.00,
  base_amount numeric DEFAULT 50.00,
  late_fine_amount numeric DEFAULT 0.00,
  -- Flexible fine system (backward-compat: fine_type='flat' uses late_fine_amount)
  fine_type text NOT NULL DEFAULT 'flat'::text CHECK (fine_type = ANY (ARRAY['flat'::text, 'daily'::text, 'per_period'::text])),
  fine_rate numeric NOT NULL DEFAULT 0,
  fine_cap numeric DEFAULT NULL,
  fine_grace_days integer NOT NULL DEFAULT 0,
  activity_type text CHECK (activity_type = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text])),
  activity_extra_amount numeric DEFAULT 0,
  is_separate_collection boolean DEFAULT false,
  qr_url text,
  open_at timestamp with time zone,
  close_at timestamp with time zone,
  deadline timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT periods_pkey PRIMARY KEY (id),
  CONSTRAINT periods_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id) ON DELETE CASCADE,
  CONSTRAINT periods_semester_order_unique UNIQUE (semester_id, period_order)
);

-- Only one active semester at a time
-- NOTE: Run this after creating the semesters table
CREATE UNIQUE INDEX IF NOT EXISTS semesters_one_active_idx
  ON public.semesters (is_active)
  WHERE is_active = true;

-- ============================================================
-- Stored Procedure: assign_tier_c_safe
-- Purpose: Atomic Tier C assignment to prevent race condition
--          when two admins assign Tier C simultaneously
-- HOW TO DEPLOY: Run migration_tier_c_rpc.sql in Supabase SQL Editor
-- ============================================================
-- CREATE OR REPLACE FUNCTION assign_tier_c_safe(p_user_id UUID, p_max_quota INT)
-- RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;
-- GRANT EXECUTE ON FUNCTION assign_tier_c_safe(UUID, INT) TO service_role;
-- (See migration_tier_c_rpc.sql for full implementation)