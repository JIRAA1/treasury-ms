-- ============================================================
-- Phase 1: สร้างตารางและคอลัมน์ใหม่
-- ============================================================

-- 1A. สร้างตาราง semesters
CREATE TABLE IF NOT EXISTS public.semesters (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  is_active   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT semesters_pkey PRIMARY KEY (id)
);

-- Partial unique index: มีแค่ 1 active semester ในเวลาเดียวกัน
CREATE UNIQUE INDEX IF NOT EXISTS semesters_one_active_idx
  ON public.semesters (is_active)
  WHERE is_active = true;

-- 1B. สร้างตาราง periods (ทดแทน week_settings)
CREATE TABLE IF NOT EXISTS public.periods (
  id                      uuid        NOT NULL DEFAULT gen_random_uuid(),
  semester_id             uuid        NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  label                   text        NOT NULL,
  period_order            integer     NOT NULL,
  amount                  numeric     DEFAULT 100.00,
  base_amount             numeric     DEFAULT 50.00,
  late_fine_amount        numeric     DEFAULT 0.00,
  activity_type           text        CHECK (activity_type = ANY (ARRAY['small','medium','large'])),
  activity_extra_amount   numeric     DEFAULT 0,
  is_separate_collection  boolean     DEFAULT false,
  qr_url                  text,
  open_at                 timestamptz,
  close_at                timestamptz,
  deadline                timestamptz NOT NULL,
  created_at              timestamptz DEFAULT now(),
  CONSTRAINT periods_pkey PRIMARY KEY (id),
  CONSTRAINT periods_semester_order_unique UNIQUE (semester_id, period_order)
);

-- 1C. เพิ่ม period_id ใน payments (nullable ก่อน)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);

-- 1D. เพิ่ม period_id ใน payment_credits (nullable ก่อน)
ALTER TABLE public.payment_credits
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.periods(id);

-- 1E. RLS สำหรับตารางใหม่
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods   ENABLE ROW LEVEL SECURITY;

-- semesters: ทุกคนดูได้, admin/treasurer เท่านั้นแก้ได้
DROP POLICY IF EXISTS "Anyone can view semesters" ON public.semesters;
CREATE POLICY "Anyone can view semesters" ON public.semesters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage semesters" ON public.semesters;
CREATE POLICY "Admins can manage semesters" ON public.semesters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('admin','treasurer')
    )
  );

-- periods: ทุกคนดูได้, admin/treasurer เท่านั้นแก้ได้
DROP POLICY IF EXISTS "Anyone can view periods" ON public.periods;
CREATE POLICY "Anyone can view periods" ON public.periods
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage periods" ON public.periods;
CREATE POLICY "Admins can manage periods" ON public.periods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id::text = auth.uid()::text
        AND u.role IN ('admin','treasurer')
    )
  );


-- ============================================================
-- Phase 2: Migrate ข้อมูลเดิม
-- ============================================================

DO $$
DECLARE
  v_semester_id uuid;
BEGIN
  -- 2A. สร้าง semester เริ่มต้น (เฉพาะถ้ายังไม่มี semester)
  IF NOT EXISTS (SELECT 1 FROM public.semesters) THEN
    INSERT INTO public.semesters (name, description, is_active)
    VALUES ('1/2567', 'นำเข้าจากระบบเก่า (week_settings)', true)
    RETURNING id INTO v_semester_id;

    -- 2B. คัดลอก week_settings -> periods
    INSERT INTO public.periods (
      semester_id,
      label,
      period_order,
      amount,
      base_amount,
      late_fine_amount,
      activity_type,
      activity_extra_amount,
      is_separate_collection,
      qr_url,
      open_at,
      close_at,
      deadline
    )
    SELECT
      v_semester_id,
      COALESCE(NULLIF(title, ''), 'สัปดาห์ ' || week::text),
      week,
      amount,
      base_amount,
      late_fine_amount,
      activity_type,
      activity_extra_amount,
      is_separate_collection,
      qr_url,
      payment_open_at,
      payment_close_at,
      deadline
    FROM public.week_settings
    ORDER BY week;

    -- 2C. Backfill period_id ใน payments
    UPDATE public.payments p
    SET period_id = pr.id
    FROM public.periods pr
    WHERE pr.period_order = p.week
      AND pr.semester_id  = v_semester_id;

    -- 2D. Backfill period_id ใน payment_credits
    UPDATE public.payment_credits pc
    SET period_id = pr.id
    FROM public.periods pr
    WHERE pr.period_order = pc.week
      AND pr.semester_id  = v_semester_id;
  END IF;
END $$;

-- 2E. ตรวจสอบข้อมูลหลงเหลือ (ต้องได้ 0)
SELECT 'payments orphaned'        AS check, COUNT(*) AS count
  FROM public.payments        WHERE period_id IS NULL AND week IS NOT NULL
UNION ALL
SELECT 'payment_credits orphaned' AS check, COUNT(*) AS count
  FROM public.payment_credits WHERE period_id IS NULL AND week IS NOT NULL;
