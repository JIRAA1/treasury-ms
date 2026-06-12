# TreasuryMS — Detailed Tech Spec & Improvement Plan

> **สถานะโปรเจกต์ปัจจุบัน:** ผ่านการทำ Period Refactor และสร้างระบบ Tier/Credit แล้ว
> **เป้าหมายของเอกสารนี้:** เป็นคู่มือระดับ Technical Spec เจาะลึกถึงระดับ Code, Query และ Database Management เพื่อนำไปสู่ระบบที่สมบูรณ์ 100% ไม่มี Edge Cases

---

## 🔴 PHASE 1: Critical Bug Fixes (ต้องแก้ก่อนเริ่มใช้งานจริง)

### 1.1 แก้ไข Query นับความคืบหน้านักศึกษา (Admin Students Page)
**📍 ไฟล์:** `src/app/(admin)/admin/students/page.tsx`
**🔥 ปัญหา:** ระบบคำนวณ `paidCount` (จำนวนงวดที่จ่ายแล้ว) จากตาราง `payments` ทั้งหมดในอดีต เมื่อขึ้นเทอมใหม่ นักศึกษาจะมียอดจ่ายแล้วติดมาด้วย
**🛠️ วิธีแก้ไข (Implementation):**
1. **เปลี่ยน Query การดึง Payments ของนักศึกษา:** ต้อง `!inner` join กับตาราง `periods` เพื่อเช็คว่า Payment นั้นอยู่ใน `active_semester` เท่านั้น
```typescript
// โค้ดเดิมที่ผิดพลาด:
// const { data: allPayments } = await supabase.from('payments').select('user_id, status')

// โค้ดใหม่ที่ถูกต้อง:
const { data: activeSemester } = await supabase.from('semesters').select('id').eq('is_active', true).single()

const { data: currentSemesterPayments } = await supabase
  .from('payments')
  .select(`
    user_id,
    status,
    period!inner(semester_id)
  `)
  .eq('period.semester_id', activeSemester.id)
  .eq('status', 'approved')
```
2. นำ `currentSemesterPayments` มาจัดกลุ่ม (Group By `user_id`) แทนนับจากทั้งหมด

---

### 1.2 แก้ไขสูตรคำนวณเส้นเป้าหมายในกราฟ (Target Income Chart)
**📍 ไฟล์:** `src/components/admin/ReportCharts.tsx`
**🔥 ปัญหา:** เส้นประเป้าหมายใช้สูตร `studentCount * period.amount` (ทุกคนจ่ายเท่ากัน) ซึ่งผิดเพราะระบบมี Tier A/B/C ที่เรทไม่เท่ากัน
**🛠️ วิธีแก้ไข (Implementation):**
1. ในฝั่ง Server (เช่น `page.tsx` ที่เรียก Component นี้) ต้องส่งข้อมูลโครงสร้างของ Tier มาด้วย
```typescript
interface TierBreakdown {
  countA: number;
  countB: number;
  countC: number;
}
```
2. แก้ไขสูตรใน `ReportCharts.tsx` เปลี่ยนจาก:
```typescript
// เดิม
const t = studentCount * c.amount; 

// ใหม่ (สมมติว่าดึงเรทจาก Database ได้แล้ว หรือรับผ่าน Props)
const baseAmount = c.base_amount; // ดึงจาก Period
const t = (countA * tierA_Rate) + (countB * tierB_Rate) + (countC * tierC_Rate);
```
*หมายเหตุ: ต้องคำนึงถึง `base_amount` ที่อาจเปลี่ยนไปในแต่ละงวดด้วย (ถ้า Tier คิดเป็นส่วนลดจาก base)*

---

### 1.3 แก้ไข Race Condition การแย่งโควต้า Tier C
**📍 ไฟล์:** `src/app/api/students/[id]/tier/route.ts` และ SQL Database
**🔥 ปัญหา:** ถ้าโควต้าตั้งไว้ 5 คน มีแอดมิน 2 คนกดเปลี่ยน Tier ให้นักศึกษา 2 คนพร้อมกัน โค้ดที่ดึงมาเช็ค (Select) อาจจะเห็นว่าเพิ่งมี 4 คน จึงสั่ง Update ทั้งคู่ ทำให้กลายเป็น 6/5
**🛠️ วิธีแก้ไข (Implementation):**
ต้องย้าย Logic ไปไว้ที่ Database ระดับ Transaction ป้องกันการเขียนทับ
1. **สร้าง Postgres RPC Function:**
```sql
CREATE OR REPLACE FUNCTION assign_tier_c_safe(p_user_id UUID, p_max_quota INT)
RETURNS BOOLEAN AS $$
DECLARE
  current_c_count INT;
BEGIN
  -- ล็อกตาราง/แถวที่จำเป็น (Optional แต่ดี)
  -- เช็คจำนวนปัจจุบัน
  SELECT COUNT(*) INTO current_c_count FROM public.users WHERE tier = 'C';
  
  IF current_c_count >= p_max_quota THEN
    RETURN FALSE; -- โควต้าเต็ม
  END IF;

  -- อัปเดตข้อมูล
  UPDATE public.users SET tier = 'C' WHERE id = p_user_id;
  RETURN TRUE; -- สำเร็จ
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
2. **ฝั่ง API (`route.ts`):** เรียกใช้งาน `supabase.rpc('assign_tier_c_safe', { p_user_id: id, p_max_quota: quota })` แทนการ `UPDATE` ตรงๆ

---

## 🟡 PHASE 2: Code & Tech Debt Cleanup (ทำความสะอาดระบบ)

### 2.1 กำจัด Legacy 'Week' Types & DB Columns
**📍 ไฟล์:** `src/types/index.ts` และ DB
**🛠️ วิธีแก้ไข:**
1. ลบ Interface `WeekSetting` ออกให้หมด
2. ใน Interface `Payment` และ `PaymentCredit` ให้ลบ `week: number` ออก (ใช้แค่ `period_id`)
3. **ตรวจสอบ Database:** ตรวจดูว่า `ALTER TABLE payments DROP COLUMN week;` ได้รันไปหรือยัง ถ้ายังให้รันเพื่อลบให้เกลี้ยง

### 2.2 เปลี่ยนค่า Hardcode Tier เป็น Dynamic (System Settings)
**📍 ไฟล์:** `src/lib/utils.ts` หรือจุดที่มีการใช้ `tierAmount`
**🔥 ปัญหา:** โค้ดอาจมีการเขียน `const amount = tier === 'A' ? 120 : ...` ไว้ลึกๆ ใน Component
**🛠️ วิธีแก้ไข:**
1. ดึง `tier_a_amount`, `tier_b_amount`, `tier_c_amount` จากตาราง `system_settings` ตอนโหลดหน้า Dashboard / Upload
2. สร้าง React Context หรือ Zustand Store ชื่อ `useSystemStore` เพื่อเก็บค่า Config เหล่านี้ให้ดึงใช้ได้ทั่วแอป โดยไม่ต้องยิง API ใหม่ทุกครั้ง

### 2.3 ปรับจูน Daily Fine Logic (ค่าปรับรายวัน)
**📍 ไฟล์:** `src/lib/fine.ts`
**🛠️ วิธีแก้ไข:**
เปลี่ยน `Math.floor` เป็น `Math.ceil` ถ้าต้องการบังคับว่าช้า 1 นาทีถือว่าช้า 1 วัน (หรือตามข้อตกลงธุรกิจ)
```typescript
// เดิม
const daysLate = Math.floor((now.getTime() - graceEnd.getTime()) / msPerDay)

// ใหม่ (ตัวอย่างการปัดขึ้น)
const daysLate = Math.ceil((now.getTime() - graceEnd.getTime()) / msPerDay)
```

---

## 🔵 PHASE 3: Feature Enhancements (ยกระดับการใช้งาน)

### 3.1 Individual Student Statement (ใบแจ้งหนี้รายบุคคล)
**📍 ไฟล์เป้าหมาย:** `src/app/(admin)/admin/students/[id]/statement/page.tsx`
**💡 แนวคิด:** 
แอดมินคลิกที่ชื่อนักศึกษา จะเปิดหน้าแสดงข้อมูล:
1. **ประวัติการจ่าย (Payment History):** งวดที่ 1 จ่ายแล้ว, งวดที่ 2 ขาดจ่าย (แสดงค่าปรับที่วิ่งอยู่)
2. **เครดิตค้าง (Pending Credits):** ยอดที่เคยผ่อนผันไว้ และยังไม่ได้ชำระคืน
3. **ปุ่ม Actions:** "แจ้งหนี้ผ่าน LINE ส่วนตัว", "ยกยอดหนี้ (Forgive)"

### 3.2 Semester End Transition (ระบบปิดเทอม)
**📍 ไฟล์เป้าหมาย:** `src/app/api/semesters/end/route.ts`
**💡 แนวคิด:**
เมื่อแอดมินสร้าง Semester ใหม่ และกด "ปิดเทอมเก่า":
1. ระบบบันทึก `total_balance` สุดท้ายของเทอมเก่าไว้เป็นหลักฐาน
2. (Optional) ถ้านักศึกษามีหนี้ `payment_credits` ค้างอยู่ ระบบจะโคลนหนี้นั้นข้ามไปยังเทอมใหม่ หรือเก็บไว้ในโหมด "หนี้สะสมข้ามเทอม" 
3. รีเซ็ตสถานะนักศึกษาทุกคนให้เริ่มนับใหม่สำหรับงวดในเทอมใหม่

### 3.3 Dynamic LINE Notifications
**📍 ไฟล์:** `src/lib/line.ts`
**💡 แนวคิด:**
อัปเดตฟังก์ชัน `sendPaymentReminder` และ `sendPaymentApproved`
*   แทนที่จะส่งว่า "ค่าส่วนกลางสัปดาห์ที่ {week}" 
*   ให้ส่งค่า `{period_label}` เข้าไปแทน เช่น "ค่าส่วนกลาง {เดือน กรกฎาคม}" หรือ "งวด {ค่ากีฬาสี}"
*   รวมถึงแนบข้อความ **ค่าปรับ ณ ปัจจุบัน (ถ้ามี)** ไปใน LINE Reminder ด้วย เพื่อกระตุ้นการจ่ายเงิน

---

**สรุปแผน:**
หากทำตามแผนด้านบน TreasuryMS จะเป็นระบบที่ **Scale ได้รองรับหลายปีการศึกษา** **มีความถูกต้องทางการเงินระดับ Transaction** และ **UI/UX สะดวกต่อคนคุมเงินที่สุด** ครับ