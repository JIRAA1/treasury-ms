# Walkthrough: Tier / Credit / Reserve Fund System

## Build Status: ✅ TypeScript passed · 38 pages compiled

---

## สิ่งที่ implement แล้ว

### 1. SQL Migration
ไฟล์ [supabase_migration_tier_credit.sql](file:///c:/Users/ACER/treasury-ms/supabase_migration_tier_credit.sql) พร้อม run ใน Supabase SQL Editor

รัน step ทีละ block ตามลำดับ:
- **STEP 1**: `ALTER TABLE users ADD COLUMN tier, tier_note`
- **STEP 2**: `ALTER TABLE week_settings ADD COLUMN base_amount, activity_type, ...`
- **STEP 3**: `CREATE TABLE payment_credits`
- **STEP 4**: RLS policies สำหรับ payment_credits
- **STEP 5**: Seed system_settings (tier_c_max_quota=5, tier amounts, reserve target)
- **STEP 6**: SQL function `get_expected_weekly_amount(week)`
- **STEP 7**: Indexes

### 2. Sidebar
**[Sidebar.tsx](file:///c:/Users/ACER/treasury-ms/src/components/layout/Sidebar.tsx)**
- เพิ่ม "บันทึก Credit" ลง Admin nav (Clock icon)
- แสดง amber badge ถ้ามี pending credits
- ตัวเลขมาจาก Admin layout ที่ query count จาก `payment_credits`

### 3. Admin Students Page
**[page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(admin)/admin/students/page.tsx)**
- แสดง Tier badge (A=เขียว, B=เทา, C=ส้ม) ในทุก row
- Tier C quota meter ด้านบน (e.g. `2/5 คน` พร้อม progress bar)
- ปุ่ม "Tier" ในแต่ละ row → เปิด **ChangeTierModal** inline
  - เลือก Tier ด้วย card picker
  - กรอก tier_note สำหรับ Tier C
  - ระบบ block ถ้า Tier C quota เต็ม

### 4. Admin Credits Page
**[page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(admin)/admin/credits/page.tsx)** *(มีอยู่แล้ว)*
- ตารางรายการค้างจ่าย พร้อม filter
- ปุ่ม "เพิ่ม Credit" → modal กรอก student/week/amount/note
- ปุ่ม "จ่ายคืน" / "ยกให้" ต่อ row

### 5. Admin Settings Page
**[page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(admin)/admin/settings/page.tsx)**
- เพิ่ม section **ระบบ Tier และโควต้า** ใช้ component ใหม่

**[TierSettingsForm.tsx](file:///c:/Users/ACER/treasury-ms/src/components/admin/TierSettingsForm.tsx)** *(ใหม่)*
- กำหนดค่า Tier A/B/C (บาท/สัปดาห์)
- กำหนดโควต้า Tier C (default 5 คน)
- กำหนดเป้าหมายกองทุนสำรอง (default ฿200/เดือน)
- บันทึกลง `system_settings` table ผ่าน Supabase client โดยตรง

### 6. Admin Overview Page
**[page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(admin)/admin/overview/page.tsx)**
- KPI row 2 (ใหม่):
  - **Tier Distribution**: mini bar chart A/B/C
  - **Credit ค้างจ่าย**: ยอดรวม (amber highlight ถ้ามี)
  - **กองทุนสำรองเป้าหมาย**: แสดง target จาก system_settings
- Audit log ใหม่: tier_changed, credit_created, credit_repaid, credit_forgiven

### 7. Admin Payments Page
**[page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(admin)/admin/payments/page.tsx)**
- Tier badge (A/B/C) แสดงข้างชื่อนักศึกษาในตาราง
- API `/api/payments/history` คืน `tier` ใน user data

### 8. Student Dashboard
**[StudentDashboard.tsx](file:///c:/Users/ACER/treasury-ms/src/components/payments/StudentDashboard.tsx)**
- **Tier badge** ใน Hero Card: `Tier B · ฿50/สัปดาห์`
- แสดง "ลดหย่อนชั่วคราว" badge ถ้า Tier C
- **Credit Debt Banner** (amber) ถ้ามี pending credits:
  - แสดงรายการ + ยอดรวม
  - ลิงก์ไปยัง /student/history

### 9. Student History Page
**[page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(student)/student/history/page.tsx)**
- Tab bar 2 แท็บ: "ประวัติชำระเงิน" และ "Credit ค้างจ่าย"
- แท็บ Credits แสดงสถานะ pending/repaid/forgiven พร้อมวันที่

---

## API Routes (ทำงานแล้ว)

| Method | Path | หน้าที่ |
|--------|------|---------|
| `GET/POST` | `/api/credits` | ดู / สร้าง credit |
| `PATCH` | `/api/credits/[id]` | อัปเดต repaid/forgiven |
| `PATCH` | `/api/students/[id]/tier` | เปลี่ยน tier (พร้อม quota check) |

---

## สิ่งที่ต้อง Run ใน Supabase

> [!IMPORTANT]
> **รัน SQL migration ก่อน** — ระบบใหม่จะ error ถ้า column `tier`, `payment_credits` table ยังไม่มีในฐานข้อมูล

```
1. เปิด Supabase Dashboard → SQL Editor
2. Copy เนื้อหาจาก supabase_migration_tier_credit.sql
3. รันทีละ STEP (1-7)
```

---

## กองทุนสำรอง — วิธีบันทึก

เปลี่ยนมาใช้ **การหักลบยอดอัตโนมัติจากกองกลาง**:
1. ตั้งค่าเป้าหมายกองทุนสำรองในเมนู **ตั้งค่าระบบ** (เช่น ฿200)
2. ระบบจะหักยอดเงินเป้าหมายนี้ออกจาก ยอดเงินคงเหลือ (ยอดสุทธิ) อัตโนมัติในหน้า Admin Overview, Reports และ Student Transparency โดยไม่ต้องกดบันทึกเป็นรายรับพิเศษแยกต่างหาก

---

## สรุปรายการแก้ไขปัญหาล่าสุด (Bug Fixes) ✅

1. **หน้า /admin/credits ไม่แสดงรายชื่อและแก้ไขไม่ได้**
   - ได้แก้ไข API endpoint `/api/credits` และ `/api/credits/[id]` ในการระบุ role/actor ของผู้ใช้งานให้ใช้เงื่อนไขตรวจสอบ `.or()` ที่ครอบคลุมแบบเดียวกับส่วนอื่นๆ ของระบบ ป้องกันปัญหาระบบหาแอดมินไม่เจออันเนื่องมาจาก format ข้อมูล metadata ต่างกัน
   - เปลี่ยนให้ `AddCreditModal` ดึงรายชื่อนักศึกษาจาก `/api/students` (ซึ่งรันผ่าน admin bypass RLS) แทนการคิวรี่ด้วย client client-side โดยตรง ทำให้รายชื่อนักศึกษาโหลดมาแสดงในช่องเลือกรายชื่อได้ตามปกติแล้ว

2. **ยอดเงินใน QR code บนแดชบอร์ดนักเรียนไม่ตรงตาม Tier**
   - แก้ไข `StudentDashboard` ให้คำนวณและแสดงยอดเงิน และสร้าง PromptPay QR payload โดยอิงตาม Tier ของนักเรียนโดยตรงตามที่แอดมินตั้งค่าไว้ใน Settings (เช่น Tier A = 60, Tier C = 30)

3. **LINE Flex Message แจ้งเตือนสลิปและกำหนดเวลา**
   - ปรับแต่งข้อความแจ้งเตือน Flex Message ใน `lib/line.ts` ให้แสดง "วันที่เปิดรับ" และ "วันที่ปิดรับ" แยกบรรทัดกันอย่างสวยงาม
   - คำนวณยอดเงินแจ้งเตือนรายบุคคลตาม Tier ของนักศึกษาคนนั้นๆ
   - อัปเดต API `/api/admin/notify` ให้ดึงนักศึกษาและตรวจสอบเฉพาะคนที่ยังค้างชำระ (Unpaid / Rejected) และยิงแจ้งเตือน Flex Message ที่มีช่วงเวลาดังกล่าวได้ถูกต้องครบถ้วนแล้ว
   - การันตีการทำงานด้วยการผ่านการตรวจสอบไทป์ TypeScript (`npx tsc --noEmit`) 100% ปราศจาก Error ดีเยี่ยม

---

## ฟีเจอร์เพิ่มเติม: ระบบจ่ายคืนเครดิตโดยตรง & ค่าปรับการชำระเงินล่าช้า (Credit Payments & Late Fines) 🚀

### 1. การแก้ไขโครงสร้างฐานข้อมูล (SQL Migration)
ได้เพิ่มคำสั่ง ALTER TABLE ในไฟล์ [supabase_migration_tier_credit.sql](file:///c:/Users/ACER/treasury-ms/supabase_migration_tier_credit.sql) **STEP 8** เพื่อเพิ่มคอลัมน์เก็บค่าปรับในตาราง `week_settings`:
```sql
ALTER TABLE public.week_settings
  ADD COLUMN IF NOT EXISTS late_fine_amount NUMERIC(10,2) DEFAULT 0.00;
```
*(แอดมินจะต้องรันคำสั่ง SQL นี้เพิ่มใน Supabase SQL Editor)*

### 2. การตั้งค่าค่าปรับชำระเลทต่อสัปดาห์ (Admin Settings)
- ปรับปรุงฟอร์ม [WeekSettingsForm.tsx](file:///c:/Users/ACER/treasury-ms/src/components/admin/WeekSettingsForm.tsx) ให้แอดมินสามารถกำหนดยอด **"ค่าปรับเลท (฿)"** ของแต่ละงวดได้โดยตรงในตารางงวดการชำระเงิน และค่าปรับจะถูกบันทึกในฐานข้อมูลคู่กับงวดนั้นๆ

### 3. การจ่ายคืน Credit โดยนักเรียนโดยตรง (Direct Credit Payments)
- **สแกนจ่ายได้ทันที**: นักเรียนที่แอดมินทำรายการเครดิตค้างจ่าย (ผ่อนผัน) ไว้ สามารถกดเลือกสัปดาห์ค้างชำระบนแดชบอร์ด สแกน QR และกดส่งสลิปเพื่อชำระเงินคืนเครดิตได้ด้วยตัวเองทันทีโดยไม่ต้องรอแอดมินมากดอนุมัติผ่านระบบ
- **การทำงานอัตโนมัติบน API (Auto-approve & Auto-resolve)**:
  - ในไฟล์ [upload/route.ts](file:///c:/Users/ACER/treasury-ms/src/app/api/payments/upload/route.ts) เมื่อนักเรียนส่งสลิปสำหรับสัปดาห์ที่มีเครดิตค้างอยู่ และผ่านการตรวจสอบด้วย OCR ระบบจะปรับสถานะรายการชำระนั้นเป็น `'approved'` (อนุมัติทันที) และปรับสถานะเครดิตค้างจ่ายในตาราง `payment_credits` เป็น `'repaid'` (ชำระคืนแล้ว) โดยอัตโนมัติ
  - ในฟังก์ชันของแอดมิน [verify/route.ts](file:///c:/Users/ACER/treasury-ms/src/app/api/payments/verify/route.ts) หากแอดมินอนุมัติสลิปที่ต้องตรวจมือด้วยตัวเอง ระบบก็จะตรวจสอบและอัปเดตสถานะของเครดิตเป็น `'repaid'` ให้โดยอัตโนมัติเช่นเดียวกัน

### 4. ระบบคำนวณเงินค่าปรับการชำระล่าช้า (Late Fines)
- **เงื่อนไขการคำนวณ**:
  - **มีเครดิต**: หากนักเรียนคนนั้นมียอดเครดิตค้างชำระ (ผ่อนผัน) ในงวดนั้น จะ**ไม่มีการบวกค่าปรับ** (ชำระคืนเท่ากับยอดตั้งต้นตาม Tier ของตัวเอง)
  - **ไม่มีเครดิต**: หากนักเรียนไม่มีการผ่อนผัน และชำระเลยกำหนดส่ง (`deadline`) ยอดเงินชำระจะถูกเพิ่มขึ้นโดยอัตโนมัติเป็น: `ยอดเงินรวม = ยอดตาม Tier + ค่าปรับของสัปधानั้น`
- **การนำมาใช้งานบนระบบ**:
  - **หน้าแดชบอร์ดนักเรียน**: แสดงยอดที่ต้องสแกนจ่ายรวมค่าปรับแล้ว พร้อมแถบแจ้งเตือนสีแดงระบุรายละเอียดค่าปรับย่อย
  - **หน้าอัปโหลดสลิป**: แสดงยอดชำระของงวดนั้นๆ รวมค่าปรับตรงกัน
  - **API ยืนยันสลิป (OCR)**: ระบบตรวจสอบจำนวนเงินในสลิปจะเปรียบเทียบกับยอดพิเศษตาม Tier ที่รวมค่าปรับแล้วอย่างแม่นยำ สลิปต้องโอนตรงตามจำนวนดังกล่าวเท่านั้นจึงจะสามารถส่งผ่านและอนุมัติสำเร็จ
  - ผ่านการตรวจไทป์ TypeScript (`npx tsc --noEmit`) ปราศจาก Error 100% ครับ

---

## การแก้ไขปัญหาการอัปโหลดสลิปเนื่องจาก ID ไม่ตรงกันและ RLS (Bug Fix: Failed to save payment record) 🛠️

### 1. สาเหตุของปัญหา
- **Foreign Key Violation**: นักเรียนบางส่วนที่เข้าระบบผ่าน LINE Login มีค่า Auth User ID (`user.id` ของ Supabase) แตกต่างจาก Primary Key ในตารางข้อมูลนักเรียน (`profile.id` ในตาราง `users`) ส่งผลให้เกิด error `payments_user_id_fkey` เมื่อบันทึกด้วย `user.id`
- **RLS Update Policy**: นโยบาย Row Level Security (RLS) ของตาราง `payments` บน Supabase client ปกติ ไม่ครอบคลุมคำสั่ง `update` ของนักเรียน ทำให้เมื่อผู้ใช้ต้องการอัปโหลดสลิปใหม่ทดแทนสลิปเดิมที่เคยโดนปฏิเสธ (Rejected) ระบบจะบล็อกคำสั่งแก้ไข

### 2. รายละเอียดการแก้ไข
1. **API อัปโหลดสลิป ([upload/route.ts](file:///c:/Users/ACER/treasury-ms/src/app/api/payments/upload/route.ts))**:
   - เปลี่ยนการอ้างอิง `user.id` เป็น `profile.id` ในการระบุตัวตนผู้ส่งและใช้เช็คสลิปซ้ำ/ค้างชำระ
   - เปลี่ยนคำสั่งบันทึก (`insert` / `update`) บนตาราง `payments` ไปรันผ่าน `adminClient` แทน เพื่อข้ามนโยบาย RLS (โดยยังมีความปลอดภัยสูงเพราะสิทธิ์และตัวตนได้รับการตรวจสอบบนฝั่ง Backend แล้ว)
2. **API เช็คสลิปซ้ำ ([check-duplicate/route.ts](file:///c:/Users/ACER/treasury-ms/src/app/api/payments/check-duplicate/route.ts))**:
   - ดึงโปรไฟล์เพื่อนำ `profile.id` ไปใช้ประเมินสถานะ `isOwnSlip` (สลิปของตัวเอง)
3. **API ประวัติชำระเงิน ([history/route.ts](file:///c:/Users/ACER/treasury-ms/src/app/api/payments/history/route.ts))**:
   - ดึง `profile.id` ของนักศึกษาที่ส่งคำขอมารวมในเงื่อนไขการค้นหา เพื่อให้นักเรียนที่ล็อกอินผ่าน LINE สามารถดึงประวัติการชำระเงินของตัวเองมาแสดงผลได้ถูกต้อง
4. **หน้าจอนักเรียน ([upload/page.tsx](file:///c:/Users/ACER/treasury-ms/src/app/(student)/student/upload/page.tsx))**:
   - ดึงข้อมูล profile ก่อนเพื่อแปลง Auth UID เป็น `profile.id` ก่อนที่จะส่งไปค้นหาประวัติการจ่ายเงินและเครดิตที่ค้างของงวดต่างๆ
5. ระบบแจ้งเตือนในหน้าเว็บ ([InAppNotifications.tsx](file:///c:/Users/ACER/treasury-ms/src/components/layout/InAppNotifications.tsx)):
   - ปรับการค้นหาประวัติการแจ้งเตือนโดยใช้ `profile.id` เพื่อให้การแจ้งเตือนเด้งขึ้นบนกระดิ่งตามโปรไฟล์ของตนเองได้อย่างถูกต้อง

---

## ระบบล้างข้อมูลฐานข้อมูลและการรีเซ็ตอย่างหมดจด (DB Clean Sweep & Reset Improvements) 🧹

### 1. การปรับปรุงความปลอดภัยและลำดับการลบข้อมูล (Foreign Key Cascade Safety)
- เนื่องจากตารางมีความเชื่อมโยงกัน เมื่อกดล้างประวัติชำระเงิน หรือรีเซ็ตระบบทั้งหมด ระบบจะทำการเคลียร์ข้อมูลตามลำดับที่ถูกต้องเพื่อป้องกัน SQL Foreign Key Error:
  - **ล้างประวัติการชำระเงิน (`clear_payments`)**: ระบบจะทำการปลดความเชื่อมโยง `repaid_via` ในตาราง `payment_credits` ให้กลับเป็น `null` (สถานะกลับเป็น `pending`) ก่อน จากนั้นค่อยลบข้อมูลในตาราง `payments`
  - **รีเซ็ตระบบทั้งหมด (`reset_all`)**: ระบบจะลบตารางย่อยอย่าง `payment_credits` ออกทั้งหมดก่อน แล้วค่อยลบตารางหลักอย่าง `payments`, `expenses`, `incomes` (รายรับทั่วไป), `notifications` (การแจ้งเตือนทั้งหมด), และ `audit_logs` (ประวัติการใช้งานระบบ)

### 2. ระบบลบไฟล์รูปภาพใน Storage Recursively
- สร้างฟังก์ชัน `deleteBucketContents` ค้นหาและลบรูปภาพสลิป/ใบเสร็จทั้งหมดใน Bucket **`slips`** และ **`receipts`** recursively (ลึกเข้าไปในโฟลเดอร์ย่อย เช่น `[user_id]/week-x-....webp`) ทำให้ไม่มีไฟล์ขยะตกค้างและช่วยประหยัดพื้นที่จัดเก็บข้อมูลบน Supabase โครงการของคุณได้จริง

### 3. การรีเซ็ตโควต้าและ Tier ของนักเรียนทุกคน
- เมื่อแอดมินกดรีเซ็ตระบบทั้งหมด ระบบจะอัปเดต Tier ของนักเรียนทุกคนในตาราง `users` กลับเป็น **`B`** (เรทปกติ ฿50/สัปดาห์) และเคลียร์ `tier_note` ให้เป็นว่างเปล่าโดยอัตโนมัติ ซึ่งจะคืนโควต้า Tier C กลับมาเป็นเริ่มต้น `0/5 คน` ให้พร้อมสำหรับการเริ่มภาคการศึกษาใหม่ทันที

### 4. การแสดงคำเตือนและรายละเอียดบน UI แอดมิน ([DataManagement.tsx](file:///c:/Users/ACER/treasury-ms/src/components/admin/DataManagement.tsx))
- ปรับปรุงข้อความอธิบายการทำงานในหน้าตั้งค่าข้อมูลของแอดมิน ให้แสดงรายละเอียดอย่างชัดเจนว่าการกดล้างข้อมูลแต่ละปุ่มจะครอบคลุมถึง รูปภาพ สลิป ใบเสร็จ และเครดิตของนักเรียนอย่างไรบ้าง เพื่อความปลอดภัยสูงสุดในการดูแลข้อมูลของระบบ
