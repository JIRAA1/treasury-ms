-- Migration script for Special Collections (การเก็บเงินพิเศษ / ค่าเสื้อ / ค่ากิจกรรมเฉพาะ)
-- Execute this script in your Supabase SQL Editor

-- 1. ตารางหัวข้อการเก็บเงินพิเศษ (Special Collections)
CREATE TABLE IF NOT EXISTS public.special_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  default_amount numeric NOT NULL DEFAULT 0.00,
  due_date timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  allow_installments boolean NOT NULL DEFAULT false, -- แอดมินเปิดให้ผ่อนได้หรือไม่
  max_installments integer NOT NULL DEFAULT 1,       -- จำนวนงวดผ่อนสูงสุด (เช่น 2 หรือ 3)
  qr_url text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT special_collections_pkey PRIMARY KEY (id)
);

-- 2. ตารางรายการชำระเงินรายบุคคล (Special Collection Items)
CREATE TABLE IF NOT EXISTS public.special_collection_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.special_collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,                   -- ยอดรวมทั้งหมดที่ต้องชำระ
  paid_amount numeric NOT NULL DEFAULT 0.00, -- ยอดที่ชำระและอนุมัติแล้วสะสม
  payment_mode text CHECK (payment_mode = ANY (ARRAY['full'::text, 'installment'::text])), -- ล็อคเมื่อจ่ายครั้งแรก
  chosen_installments integer DEFAULT 1,     -- จำนวนงวดที่เลือกผ่อน
  status text NOT NULL DEFAULT 'unpaid'::text CHECK (status = ANY (ARRAY['unpaid'::text, 'partial'::text, 'pending'::text, 'approved'::text, 'rejected'::text])),
  note text,                                 -- หมายเหตุ เช่น ไซส์เสื้อ (S, M, L)
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT special_collection_items_pkey PRIMARY KEY (id),
  CONSTRAINT special_collection_items_user_collection_unique UNIQUE (collection_id, user_id)
);

-- 3. ตารางสลิปการชำระเงินแต่ละครั้ง/แต่ละงวด (Special Collection Slips)
CREATE TABLE IF NOT EXISTS public.special_collection_slips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.special_collection_items(id) ON DELETE CASCADE,
  installment_no integer NOT NULL DEFAULT 1, -- ครั้งที่ส่งสลิป (1, 2, ...)
  amount numeric NOT NULL,                  -- ยอดเงินในสลิปนี้
  is_payoff boolean NOT NULL DEFAULT false, -- ระบุว่าเป็นสลิปปิดยอดค้างทั้งหมดหรือไม่
  slip_url text NOT NULL,
  trans_ref text,
  file_hash text,                           -- SHA-256 Hash เพื่อป้องกันไฟล์ซ้ำ
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  verified_by_api boolean DEFAULT true,    -- ระบุว่าผ่าน OCR หรือรอแอดมินตรวจมือ
  verified_at timestamp with time zone,
  verified_by uuid REFERENCES public.users(id),
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT special_collection_slips_pkey PRIMARY KEY (id)
);

-- RLS & Enable Policies (Allow authenticated access)
ALTER TABLE public.special_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_collection_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to authenticated users for special_collections"
  ON public.special_collections FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to authenticated users for special_collection_items"
  ON public.special_collection_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to authenticated users for special_collection_slips"
  ON public.special_collection_slips FOR ALL TO authenticated USING (true) WITH CHECK (true);
