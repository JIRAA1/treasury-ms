-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- ============================================================
-- CORE TABLES
-- ============================================================

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
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  label text NOT NULL,
  period_order integer NOT NULL,
  amount numeric DEFAULT 100.00,
  base_amount numeric DEFAULT 50.00,
  late_fine_amount numeric DEFAULT 0.00,
  activity_type text CHECK (activity_type = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text])),
  activity_extra_amount numeric DEFAULT 0,
  is_separate_collection boolean DEFAULT false,
  qr_url text,
  open_at timestamp with time zone,
  close_at timestamp with time zone,
  deadline timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT periods_pkey PRIMARY KEY (id),
  CONSTRAINT periods_semester_order_unique UNIQUE (semester_id, period_order)
);

-- Note: week_settings is being replaced by periods in newer versions
CREATE TABLE public.week_settings (
  week integer NOT NULL,
  title text NOT NULL,
  deadline timestamp with time zone NOT NULL,
  amount numeric DEFAULT 100.00,
  start_date timestamp with time zone DEFAULT now(),
  qr_url text,
  payment_open_at timestamp with time zone,
  payment_close_at timestamp with time zone,
  activity_type text CHECK (activity_type = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text])),
  activity_extra_amount numeric DEFAULT 0,
  is_separate_collection boolean DEFAULT false,
  base_amount numeric DEFAULT 50.00,
  late_fine_amount numeric DEFAULT 0.00,
  CONSTRAINT week_settings_pkey PRIMARY KEY (week)
);

-- ============================================================
-- TRANSACTIONAL TABLES
-- ============================================================

CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  period_id uuid REFERENCES public.periods(id),
  week integer REFERENCES public.week_settings(week),
  amount numeric NOT NULL,
  trans_ref text UNIQUE,
  slip_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  note text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  verified_by_api boolean DEFAULT true,
  file_hash text,
  CONSTRAINT payments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.payment_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  period_id uuid REFERENCES public.periods(id),
  week integer REFERENCES public.week_settings(week),
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'repaid'::text, 'forgiven'::text])),
  repaid_at timestamp with time zone,
  repaid_via uuid,
  note text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_credits_pkey PRIMARY KEY (id)
);

CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  created_by uuid REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  receipt_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT expenses_pkey PRIMARY KEY (id)
);

CREATE TABLE public.incomes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  created_by uuid REFERENCES public.users(id),
  approved_by uuid REFERENCES public.users(id),
  source text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incomes_pkey PRIMARY KEY (id)
);

-- ============================================================
-- SYSTEM TABLES
-- ============================================================

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.users(id),
  action text NOT NULL,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE public.system_settings (
  key text NOT NULL,
  value text,
  CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);
