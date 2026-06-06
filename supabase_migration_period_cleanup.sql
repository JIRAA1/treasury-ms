-- ============================================================
-- Phase 3: Finalize & Cleanup
-- รันหลังจากอัปเดตโค้ดและทดสอบระบบทั้งหมดเรียบร้อยแล้ว
-- WARNING: การรันส่วนนี้ลบข้อมูล/ตารางเก่าอย่างถาวร กรุณา Backup ก่อนรัน
-- ============================================================

-- 3A. ทำ period_id เป็น NOT NULL
ALTER TABLE public.payments
  ALTER COLUMN period_id SET NOT NULL;

ALTER TABLE public.payment_credits
  ALTER COLUMN period_id SET NOT NULL;

-- 3B. เพิ่ม UNIQUE constraint ใหม่ (แทน user+week)
ALTER TABLE public.payments
  ADD CONSTRAINT payments_user_period_unique UNIQUE (user_id, period_id);

-- 3C. Drop week column และ FK เดิม
-- payments
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_week_fkey,
  DROP COLUMN IF EXISTS week;

-- payment_credits
ALTER TABLE public.payment_credits
  DROP CONSTRAINT IF EXISTS payment_credits_week_fkey,
  DROP COLUMN IF EXISTS week;

-- 3D. Backup แล้ว Drop week_settings
CREATE TABLE IF NOT EXISTS public.week_settings_backup
  AS SELECT * FROM public.week_settings;

DROP TABLE IF EXISTS public.week_settings CASCADE;

-- 3E. อัปเดต SQL Helper Functions
DROP FUNCTION IF EXISTS get_week_collection_rate(integer);

CREATE OR REPLACE FUNCTION get_period_collection_rate(target_period_id uuid)
RETURNS numeric AS $$
  SELECT ROUND(
    COUNT(CASE WHEN status = 'approved' THEN 1 END)::numeric /
    NULLIF((SELECT COUNT(*) FROM public.users WHERE role = 'student'), 0) * 100,
    1
  )
  FROM public.payments
  WHERE period_id = target_period_id
$$ LANGUAGE SQL SECURITY DEFINER;

-- 3F. อัปเดต get_treasury_balance (ไม่เปลี่ยน logic)
CREATE OR REPLACE FUNCTION get_treasury_balance()
RETURNS numeric AS $$
  SELECT
    COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END), 0) -
    COALESCE((SELECT SUM(e.amount) FROM public.expenses e WHERE e.approved_by IS NOT NULL), 0)
  FROM public.payments p
$$ LANGUAGE SQL SECURITY DEFINER;
