-- ============================================================
-- TreasuryMS Complete Schema & Test Data
-- สำหรับรันใน Supabase SQL Editor
-- ============================================================

-- 1. DROP EXISTING TABLES (ระวัง! ข้อมูลเก่าจะหายหมด)
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS incomes;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS week_settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS system_settings;

-- 2. CREATE TABLES
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE NOT NULL,
  fullname TEXT NOT NULL,
  email TEXT,
  line_user_id TEXT UNIQUE,
  line_picture_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'treasurer', 'admin')),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE week_settings (
  week INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10,2) DEFAULT 100.00,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  qr_url TEXT,
  payment_open_at TIMESTAMPTZ,
  payment_close_at TIMESTAMPTZ
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week INTEGER NOT NULL REFERENCES week_settings(week) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  trans_ref TEXT UNIQUE,
  slip_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_by_api BOOLEAN DEFAULT true,
  UNIQUE(user_id, week)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS (SECURITY POLICIES)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- นโยบายสำหรับผู้ใช้ทั่วไป
CREATE POLICY "Users view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users view week settings" ON week_settings FOR SELECT USING (true);
CREATE POLICY "Students view own payments" ON payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Students insert own payments" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Everyone view all incomes" ON incomes FOR SELECT USING (true);
CREATE POLICY "Everyone view all expenses" ON expenses FOR SELECT USING (true);

-- นโยบายสำหรับ ADMIN
CREATE POLICY "Admins manage all users" ON users FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');
CREATE POLICY "Admins manage all week_settings" ON week_settings FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');
CREATE POLICY "Admins manage all payments" ON payments FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');
CREATE POLICY "Admins manage all expenses" ON expenses FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');
CREATE POLICY "Admins manage all incomes" ON incomes FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');
CREATE POLICY "Admins manage all notifications" ON notifications FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');
CREATE POLICY "Admins manage all audit_logs" ON audit_logs FOR ALL USING ((auth.jwt() ->> 'email')::text LIKE '%@treasury.local');

-- 4. SAMPLE TEST DATA
INSERT INTO system_settings (key, value) VALUES ('promptpay_id', '0934589920'), ('promptpay_name', 'ชานน ศ.');

INSERT INTO week_settings (week, title, deadline, amount) VALUES
(1, 'ค่าบำรุงงวดที่ 1', NOW() + INTERVAL '7 days', 100),
(2, 'ค่ากิจกรรมพิเศษ', NOW() + INTERVAL '14 days', 50),
(3, 'ค่าเสื้อช็อป (มัดจำ)', NOW() + INTERVAL '21 days', 200);

-- 5. FUNCTIONS
CREATE OR REPLACE FUNCTION get_treasury_balance() RETURNS NUMERIC AS $$
  SELECT 
    (COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'approved'), 0) +
     COALESCE((SELECT SUM(amount) FROM incomes WHERE approved_by IS NOT NULL), 0)) -
    COALESCE((SELECT SUM(amount) FROM expenses WHERE approved_by IS NOT NULL), 0)
$$ LANGUAGE SQL SECURITY DEFINER;
