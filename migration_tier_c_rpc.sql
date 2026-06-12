-- ============================================================
-- Migration: assign_tier_c_safe RPC function
-- วัตถุประสงค์: ป้องกัน Race Condition เมื่อแอดมิน 2 คน
--              กดเปลี่ยน Tier C พร้อมกันจนเกิน quota
--
-- วิธีรัน: นำไปวางใน Supabase SQL Editor แล้วกด Run
-- ============================================================

CREATE OR REPLACE FUNCTION assign_tier_c_safe(
  p_user_id  UUID,
  p_max_quota INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_c_count INT;
BEGIN
  -- Lock rows ที่เป็น Tier C เพื่อป้องกัน concurrent write
  -- (SHARE lock ทำให้ transaction อื่นอ่านได้ แต่ไม่สามารถ UPDATE ได้จนกว่า tx นี้จะ commit)
  PERFORM id
  FROM public.users
  WHERE tier = 'C' AND role = 'student'
  FOR SHARE;

  -- นับจำนวน Tier C ปัจจุบัน (ไม่นับตัว user เอง เพื่อรองรับกรณีที่เป็น C อยู่แล้ว)
  SELECT COUNT(*) INTO current_c_count
  FROM public.users
  WHERE tier = 'C'
    AND role = 'student'
    AND id != p_user_id;

  -- ถ้าเกิน quota → คืนค่า FALSE ไม่ทำการ UPDATE
  IF current_c_count >= p_max_quota THEN
    RETURN FALSE;
  END IF;

  -- อัปเดต tier ของ user
  UPDATE public.users
  SET tier = 'C'
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Grant execute ให้ service_role เพื่อให้ supabase admin client เรียกได้
GRANT EXECUTE ON FUNCTION assign_tier_c_safe(UUID, INT) TO service_role;
