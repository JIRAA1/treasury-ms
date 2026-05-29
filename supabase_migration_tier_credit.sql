-- ============================================================
-- TreasuryMS Migration: Tier, Activity Fee, Credit System
-- รัน statement ทีละ block ใน Supabase SQL Editor
-- ============================================================

-- -----------------------------------------------
-- STEP 1: เพิ่ม tier ใน users
-- -----------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'B'
    CHECK (tier IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS tier_note TEXT;

-- -----------------------------------------------
-- STEP 2: เพิ่ม activity fields ใน week_settings
-- -----------------------------------------------
ALTER TABLE public.week_settings
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS activity_type TEXT CHECK (activity_type IN ('small', 'medium', 'large')),
  ADD COLUMN IF NOT EXISTS activity_extra_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_separate_collection BOOLEAN DEFAULT false;

-- -----------------------------------------------
-- STEP 3: สร้าง payment_credits table
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'repaid', 'forgiven')),
  repaid_at TIMESTAMPTZ,
  repaid_via UUID,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payment_credits_pkey PRIMARY KEY (id),
  CONSTRAINT payment_credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT payment_credits_week_fkey FOREIGN KEY (week) REFERENCES public.week_settings(week) ON DELETE CASCADE,
  CONSTRAINT payment_credits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, week)
);

-- -----------------------------------------------
-- STEP 4: RLS สำหรับ payment_credits
-- -----------------------------------------------
ALTER TABLE public.payment_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own credits" ON public.payment_credits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins manage all credits" ON public.payment_credits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'treasurer')
    )
  );

-- -----------------------------------------------
-- STEP 5: System settings seed data
-- -----------------------------------------------
INSERT INTO public.system_settings (key, value)
VALUES ('reserve_fund_monthly_target', '200')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
VALUES ('tier_c_max_quota', '5')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
VALUES ('base_weekly_amount', '50')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
VALUES ('tier_a_amount', '60')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
VALUES ('tier_b_amount', '50')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value)
VALUES ('tier_c_amount', '30')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------
-- STEP 6: Function คำนวณยอดที่ควรเก็บต่อสัปดาห์ (ตาม tier)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION get_expected_weekly_amount(p_week INTEGER)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(
    CASE u.tier
      WHEN 'A' THEN COALESCE((SELECT value::NUMERIC FROM system_settings WHERE key = 'tier_a_amount'), 60)
      WHEN 'C' THEN COALESCE((SELECT value::NUMERIC FROM system_settings WHERE key = 'tier_c_amount'), 30)
      ELSE COALESCE((SELECT value::NUMERIC FROM system_settings WHERE key = 'tier_b_amount'), 50)
    END
    +
    COALESCE((SELECT ws.activity_extra_amount FROM week_settings ws WHERE ws.week = p_week AND ws.is_separate_collection = false), 0)
  ), 0)
  FROM users u
  WHERE u.role = 'student'
$$ LANGUAGE SQL SECURITY DEFINER;

-- -----------------------------------------------
-- STEP 7: Indexes สำหรับ payment_credits
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payment_credits_user_id ON public.payment_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_credits_status ON public.payment_credits(status);
CREATE INDEX IF NOT EXISTS idx_payment_credits_week ON public.payment_credits(week);
