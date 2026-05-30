-- ============================================================
-- TreasuryMS Migration: file_hash duplicate prevention
-- รัน statement นี้ใน Supabase SQL Editor
-- ============================================================

-- STEP 1: เพิ่ม column file_hash ใน payments
-- เก็บ SHA-256 hex ของไฟล์สลิป เพื่อป้องกันส่งสลิปซ้ำ
-- เมื่อ OCR อ่าน trans_ref ไม่ได้ (null ≠ null ใน UNIQUE constraint)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- STEP 2: สร้าง partial unique index
-- NULL คือ "ยังไม่รู้" จึง allow null หลายแถว
-- แต่ถ้ามี hash เดิมที่ไม่ใช่ rejected → block ซ้ำ
CREATE UNIQUE INDEX IF NOT EXISTS payments_file_hash_unique
  ON public.payments (file_hash)
  WHERE file_hash IS NOT NULL AND status != 'rejected';
