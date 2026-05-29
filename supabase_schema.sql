-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week integer NOT NULL,
  amount numeric NOT NULL,
  trans_ref text UNIQUE,
  slip_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  note text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  verified_by_api boolean DEFAULT true,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT payments_week_fkey FOREIGN KEY (week) REFERENCES public.week_settings(week)
);
CREATE TABLE public.system_settings (
  key text NOT NULL,
  value text,
  CONSTRAINT system_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL UNIQUE,
  fullname text NOT NULL,
  email text,
  line_user_id text UNIQUE,
  role text NOT NULL DEFAULT 'student'::text CHECK (role = ANY (ARRAY['student'::text, 'treasurer'::text, 'admin'::text])),
  verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.week_settings (
  week integer NOT NULL,
  title text NOT NULL,
  deadline timestamp with time zone NOT NULL,
  amount numeric DEFAULT 100.00,
  start_date timestamp with time zone DEFAULT now(),
  qr_url text,
  payment_open_at timestamp with time zone,
  payment_close_at timestamp with time zone,
  CONSTRAINT week_settings_pkey PRIMARY KEY (week)
);