-- ============================================================
-- Migration: Add category column to expenses table
-- วัตถุประสงค์: เก็บหมวดหมู่ค่าใช้จ่ายในฐานข้อมูล
--              เพื่อใช้สร้างกราฟวิเคราะห์รายจ่ายตามหมวดหมู่
--
-- วิธีรัน: นำไปวางใน Supabase SQL Editor แล้วกด Run
-- ============================================================

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
  CHECK (category = ANY (ARRAY['supplies'::text, 'activity'::text, 'food'::text, 'transport'::text, 'other'::text]));

COMMENT ON COLUMN public.expenses.category IS 'หมวดหมู่ค่าใช้จ่าย: supplies=อุปกรณ์, activity=กิจกรรม, food=อาหาร/เครื่องดื่ม, transport=ค่าเดินทาง, other=อื่นๆ';
