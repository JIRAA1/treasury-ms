# TreasuryMS — ระบบจัดการการเงินสาขา (Computer Science)

**TreasuryMS** คือระบบเว็บแอปพลิเคชันสำหรับบริหารจัดการเงินกองกลางของนักศึกษาสาขาวิทยาการคอมพิวเตอร์ (Computer Science) ประจำภาคการศึกษาที่ 1/2568 ออกแบบมาเพื่อเพิ่มความโปร่งใส ความรวดเร็วในการตรวจสอบสลิป และการจัดเก็บข้อมูลทางการเงินอย่างเป็นระบบ

---

## 🌟 ฟีเจอร์หลัก (Key Features)

### 1. ระบบจัดการนักศึกษาและเทียร์ (Tier System)
*   **Tier Segmentation:** จัดกลุ่มนักศึกษาเป็น 3 ระดับ (A, B, C) เพื่อกำหนดอัตราเงินสมทบรายสัปดาห์ที่ต่างกัน
    *   **Tier A (฿60):** สมทบพิเศษ
    *   **Tier B (฿50):** มาตรฐาน (Default)
    *   **Tier C (฿30):** ลดหย่อนชั่วคราว (จำกัดโควต้า เช่น 5 คน)
*   **Tier Quota Management:** ระบบควบคุมโควต้า Tier C อัตโนมัติ ป้องกันการใช้สิทธิ์เกินจำนวนที่กำหนด

### 2. ระบบชำระเงินและตรวจสอบสลิปอัตโนมัติ (Payment & OCR)
*   **Slip Verification (Thunder API):** ใช้เทคโนโลยี OCR ตรวจสอบสลิปการโอนเงินอัตโนมัติ (ยอดเงิน, วันที่, เลขอ้างอิง และธนาคาร)
*   **Duplicate Detection:** ตรวจสอบเลขที่อ้างอิงสลิป (Transaction Ref) เพื่อป้องกันการส่งสลิปซ้ำ
*   **Late Fines:** ระบบคำนวณค่าปรับกรณีชำระเงินล่าช้ากว่ากำหนด (Deadline) โดยอัตโนมัติ
*   **Dynamic QR Code:** สร้าง QR Code พร้อมระบุยอดเงินโอนที่ถูกต้องตาม Tier และค่าปรับรายบุคคล

### 3. ระบบเครดิตและผ่อนผัน (Credit & Debt)
*   **Credit Recording:** เหรัญญิกสามารถบันทึก "เครดิต" หรือยอดค้างชำระ (ผ่อนผัน) ให้กับนักศึกษาได้
*   **Auto-Repayment:** เมื่อนักศึกษาโอนเงินคืนและส่งสลิป ระบบจะตัดยอดเครดิตเป็น "ชำระแล้ว" (Repaid) ให้อัตโนมัติ

### 4. ระบบโปร่งใสและรายงาน (Transparency & Reports)
*   **Public Transparency Page:** หน้าเว็บที่เปิดเผยสถานะการเงิน (ยอดรับ/ยอดจ่าย) แบบ Real-time ให้ทุกคนเข้าดูได้โดยไม่ต้องล็อกอิน
*   **Expense Management:** บันทึกรายจ่ายพร้อมแนบหลักฐานใบเสร็จ
*   **Excel Export:** ส่งออกรายงานสรุปรายรับรายสัปดาห์และสถานะนักศึกษาเป็นไฟล์ Excel

### 5. ระบบแจ้งเตือน (Notifications)
*   **LINE Login & Notify:** เข้าใช้งานผ่าน LINE และรับการแจ้งเตือนสลิป (อนุมัติ/ปฏิเสธ) หรือแจ้งเตือนค้างชำระผ่าน Flex Message
*   **In-App Notifications:** ระบบแจ้งเตือนภายในตัวเว็บ

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

*   **Frontend:** [Next.js](https://nextjs.org/) (App Router), [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
*   **Backend & Database:** [Supabase](https://supabase.com/) (Postgres, Auth, Storage, RLS)
*   **State Management:** [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)
*   **Validation:** [Zod](https://zod.dev/) & [React Hook Form](https://react-hook-form.com/)
*   **OCR Engine:** [Thunder API](https://thunder.in.th/)
*   **Messaging:** [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)

---

## 📖 คู่มือการใช้งาน (Usage Guide)

### สำหรับนักศึกษา (Student Flow)
1.  **Login:** เข้าสู่ระบบด้วย LINE Account
2.  **Binding:** ผูกบัญชีด้วยรหัสนักศึกษา 8 หลัก (ในครั้งแรก)
3.  **Dashboard:** ดูสถานะการจ่ายเงินของตนเอง และยอดที่ต้องชำระในงวดปัจจุบัน
4.  **Upload:** สแกนจ่ายผ่าน QR Code และอัปโหลดสลิป ระบบจะตรวจเบื้องต้นด้วย AI ทันที
5.  **History:** ตรวจสอบประวัติการชำระเงินและยอดเครดิตค้างจ่าย

### สำหรับเหรัญญิก/แอดมิน (Admin Flow)
1.  **Overview:** ดูภาพรวมการเงิน ยอดคงเหลือ และอัตราการจัดเก็บ (Collection Rate)
2.  **Payments:** ตรวจสอบและอนุมัติสลิปที่รอการยืนยัน (กรณี AI ตรวจไม่ผ่าน)
3.  **Students:** จัดการ Tier ของนักศึกษาและดูประวัติการจ่ายเงินรายบุคคล
4.  **Credits:** บันทึกและจัดการยอดค้างชำระ
5.  **Settings:** ตั้งค่ากำหนดส่ง (Deadline), ยอดเงินแต่ละงวด, ค่าปรับ และโควต้า Tier

---

## ⚙️ การตั้งค่าระบบ (Internal Workings)

### ระบบคำนวณยอดเงินที่ต้องชำระ
ยอดเงินที่นักศึกษาต้องจ่ายในแต่ละงวด คำนวณจาก:
`ยอดตาม Tier + ค่าปรับเลท (ถ้ามี และไม่ใช่ผู้ที่ได้รับสิทธิ์เครดิต)`

### ระบบกองทุนสำรอง (Reserve Fund)
ระบบจะหักลบยอดเงินเป้าหมายออกจากยอดเงินคงเหลือสุทธิโดยอัตโนมัติ เพื่อสำรองไว้สำหรับกรณีฉุกเฉิน โดยตั้งค่าได้ในเมนู "ตั้งค่าระบบ"

### ความปลอดภัยของข้อมูล (Security)
*   **Row Level Security (RLS):** ควบคุมการเข้าถึงข้อมูลในระดับฐานข้อมูล (นักศึกษาดูได้เฉพาะข้อมูลตนเอง, แอดมินจัดการได้ทั้งหมด)
*   **Audit Logs:** บันทึกทุกกิจกรรมสำคัญที่เกิดขึ้นในระบบ (เช่น ใครเป็นคนอนุมัติสลิป, ใครเปลี่ยน Tier) เพื่อความตรวจสอบได้ 100%

---

## 🚀 เริ่มต้นพัฒนา (Getting Started)

1.  **Clone repository:**
    ```bash
    git clone https://github.com/JIRAA1/treasury-ms.git
    cd treasury-ms
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Setup Environment Variables:**
    สร้างไฟล์ `.env.local` และระบุค่าต่างๆ (ดูตัวอย่างใน `TreasuryMS_AI_Prompt_Spec.md`)

4.  **Database Migration:**
    รัน SQL จากไฟล์ `supabase_schema.sql` และ `supabase_migration_tier_credit.sql` ใน Supabase SQL Editor

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```

---

## 📄 License
ระบบนี้พัฒนาขึ้นเพื่อใช้ภายในสาขาวิทยาการคอมพิวเตอร์เท่านั้น
