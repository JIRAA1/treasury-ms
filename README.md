# TreasuryMS — ระบบบริหารจัดการกองกลางสาขา คอมพิวเตอร์ศึกษา 69

> ระบบบริหารจัดการการเงินภายในสาขาคอมพิวเตอร์ศึกษา
> ออกแบบเพื่อความโปร่งใส (Transparency) และประสิทธิภาพ (Efficiency) อย่างสูงสุด

**Live Demo:** [treasury-ms.vercel.app](https://treasury-ms.vercel.app)

---

## สารบัญ

- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [Tech Stack](#tech-stack)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [ฐานข้อมูล (Database Schema)](#ฐานข้อมูล-database-schema)
- [ระบบ Tier และการคิดเงิน](#ระบบ-tier-และการคิดเงิน)
- [ระบบ Credit (ยอดค้างชำระ)](#ระบบ-credit-ยอดค้างชำระ)
- [Flow การทำงานหลัก](#flow-การทำงานหลัก)
- [API Endpoints](#api-endpoints)
- [บทบาทและสิทธิ์ (Roles & Permissions)](#บทบาทและสิทธิ์-roles--permissions)
- [ความปลอดภัย (Security & RLS)](#ความปลอดภัย-security--rls)
- [คู่มือการใช้งาน — นักศึกษา](#คู่มือการใช้งาน--นักศึกษา)
- [คู่มือการใช้งาน — เหรัญญิก/แอดมิน](#คู่มือการใช้งาน--เหรัญญิกแอดมิน)
- [การติดตั้งและ Setup](#การติดตั้งและ-setup)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [LINE Integration](#line-integration)
- [OCR — Thunder API](#ocr--thunder-api)
- [Audit Logging](#audit-logging)
- [การ Reset ระบบสำหรับเทอมใหม่](#การ-reset-ระบบสำหรับเทอมใหม่)
- [Troubleshooting](#troubleshooting)
- [เงื่อนไขและข้อควรระวัง](#เงื่อนไขและข้อควรระวัง)

---

## ภาพรวมระบบ

**TreasuryMS** คือระบบ Web Application สำหรับบริหารจัดการการเงินภายในสาขา โดยครอบคลุมตั้งแต่:

- การเก็บเงินรายสัปดาห์จากนักศึกษา (แบบ Tier-based)
- การตรวจสอบสลิปโอนเงินอัตโนมัติด้วย AI/OCR (Thunder API)
- การบันทึกรายจ่ายของสาขาพร้อมใบเสร็จ
- การแจ้งเตือนผ่าน LINE Messaging API
- หน้าแสดงความโปร่งใสทางการเงิน (สาธารณะ ไม่ต้อง Login)
- ระบบ Audit Log บันทึกทุกการกระทำในระบบ

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router) + TypeScript |
| **Styling** | Tailwind CSS + Shadcn UI (Monochrome Theme) |
| **State Management** | Zustand |
| **Backend as a Service** | Supabase (Auth, PostgreSQL, Storage, Realtime) |
| **AI/OCR** | Thunder API (`api.thunder.in.th`) |
| **Messaging** | LINE Messaging API + LINE Login (OAuth 2.0) |
| **Form Validation** | React Hook Form + Zod |
| **HTTP Client** | Axios |
| **Date Utilities** | date-fns |
| **Export** | xlsx (Excel) + jsqr (QR scan) |
| **Deployment** | Vercel |

---

## โครงสร้างโปรเจกต์

```
treasury-ms/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx          # หน้า Login ด้วย LINE
│   │   │   └── bind/page.tsx           # ผูก Student ID กับ LINE Account
│   │   ├── (student)/
│   │   │   ├── layout.tsx              # Layout + Sidebar สำหรับนักศึกษา
│   │   │   ├── dashboard/page.tsx      # แดชบอร์ดหลักนักศึกษา
│   │   │   ├── upload/page.tsx         # อัปโหลดสลิป (Multi-step flow)
│   │   │   ├── history/page.tsx        # ประวัติการชำระเงิน
│   │   │   └── transparency/page.tsx   # หน้าโปร่งใส (Public)
│   │   ├── (admin)/
│   │   │   ├── layout.tsx              # Layout + Sidebar สำหรับแอดมิน
│   │   │   ├── overview/page.tsx       # Dashboard ภาพรวมของเหรัญญิก
│   │   │   ├── payments/page.tsx       # จัดการสลิปทั้งหมด
│   │   │   ├── expenses/page.tsx       # บันทึกรายจ่าย
│   │   │   ├── students/page.tsx       # จัดการข้อมูลนักศึกษา
│   │   │   ├── reports/page.tsx        # รายงานและ Export Excel
│   │   │   ├── audit/page.tsx          # Audit Logs (admin เท่านั้น)
│   │   │   └── settings/page.tsx       # ตั้งค่าระบบ + Data Reset
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── line/callback/      # LINE OAuth Callback
│   │       │   └── bind/               # ผูก Student ID
│   │       ├── payments/
│   │       │   ├── upload/             # อัปโหลด + รัน OCR
│   │       │   ├── verify/             # แอดมิน Approve/Reject
│   │       │   └── history/            # ดึงประวัติ
│   │       ├── credits/                # จัดการ Credit (ยอดค้าง)
│   │       ├── expenses/               # บันทึก/อนุมัติรายจ่าย
│   │       ├── students/[id]/
│   │       │   ├── tier/               # เปลี่ยน Tier นักศึกษา
│   │       │   └── binding/            # Reset LINE Binding
│   │       ├── notify/                 # ส่ง LINE Notification
│   │       └── reports/export/         # Export Excel
│   ├── components/
│   │   ├── ui/                         # Shadcn UI Components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── AppShell.tsx
│   │   ├── payments/
│   │   │   ├── PaymentHero.tsx         # Card แสดงสถานะงวดปัจจุบัน
│   │   │   ├── PaymentRow.tsx
│   │   │   ├── StatusPill.tsx          # Badge สถานะ (paid/pending/rejected)
│   │   │   ├── WeekGrid.tsx            # Grid แสดงทุกสัปดาห์
│   │   │   ├── SlipUploader.tsx        # Multi-step Upload Flow
│   │   │   └── PendingPaymentsTable.tsx
│   │   ├── expenses/
│   │   │   ├── ExpenseRow.tsx
│   │   │   └── ExpenseForm.tsx
│   │   └── shared/
│   │       ├── KpiCard.tsx
│   │       ├── ActivityFeed.tsx
│   │       └── EmptyState.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser client
│   │   │   ├── server.ts               # Server component client
│   │   │   └── middleware.ts           # Session refresh
│   │   ├── line.ts                     # LINE API helpers
│   │   ├── thunder.ts                  # Thunder OCR API
│   │   ├── audit.ts                    # Audit log helper
│   │   ├── reports.ts                  # Excel report generator
│   │   └── utils.ts                    # cn(), formatCurrency(), etc.
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePayments.ts
│   │   └── useExpenses.ts
│   ├── store/
│   │   ├── authStore.ts                # User session state
│   │   └── uiStore.ts                  # Sidebar open/close
│   └── types/
│       └── index.ts                    # TypeScript interfaces ทั้งหมด
├── public/
├── supabase_schema.sql                 # Schema หลัก
├── supabase_migration_tier_credit.sql  # Migration: Tier + Credit system
├── middleware.ts                       # Next.js Route Protection
├── next.config.ts
├── tailwind.config.ts
├── components.json                     # Shadcn config
└── .env.local                          # Environment variables (ไม่ commit)
```

---

## ฐานข้อมูล (Database Schema)

### ตารางหลัก

#### `users` — ข้อมูลผู้ใช้งาน

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `student_id` | text (UNIQUE) | รหัสนักศึกษา 8 หลัก |
| `fullname` | text | ชื่อ-นามสกุล |
| `email` | text | อีเมล (optional) |
| `line_user_id` | text (UNIQUE) | LINE User ID (ผูกแล้ว) |
| `role` | text | `student` / `treasurer` / `admin` |
| `tier` | text | `A` / `B` / `C` (ค่าเริ่มต้น: `B`) |
| `tier_note` | text | หมายเหตุสาเหตุที่ได้ Tier |
| `verified` | boolean | ยืนยันตัวตนแล้วหรือยัง |
| `created_at` | timestamptz | วันที่สร้าง |

---

#### `week_settings` — กำหนดการแต่ละงวด

| Column | Type | Description |
|---|---|---|
| `week` | integer (PK) | เลขสัปดาห์ (1–20) |
| `title` | text | ชื่องวด |
| `deadline` | timestamptz | วันครบกำหนดชำระ |
| `amount` | numeric | ยอดเงินงวดนี้ |
| `base_amount` | numeric | ยอดพื้นฐาน (ค่าเริ่มต้น: 50.00) |
| `activity_type` | text | `small` / `medium` / `large` |
| `activity_extra_amount` | numeric | ค่ากิจกรรมเพิ่มเติม |
| `is_separate_collection` | boolean | เก็บแยกจากเงินปกติไหม |
| `late_fine_amount` | numeric | ค่าปรับจ่ายช้า (ค่าเริ่มต้น: 0.00) |
| `start_date` | timestamptz | วันที่เปิดรับ |
| `payment_open_at` | timestamptz | เปิดรับสลิปตั้งแต่วันที่ |
| `payment_close_at` | timestamptz | ปิดรับสลิปวันที่ |
| `qr_url` | text | URL ของ QR Code สำหรับโอนเงิน |

---

#### `payments` — รายการส่งสลิปชำระเงิน

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `user_id` | uuid (FK → users) | เจ้าของสลิป |
| `week` | integer (FK → week_settings) | งวดที่ชำระ |
| `amount` | numeric | ยอดเงินในสลิป |
| `trans_ref` | text (UNIQUE) | เลข Transaction Reference |
| `slip_url` | text | URL รูปสลิปใน Supabase Storage |
| `status` | text | `pending` / `approved` / `rejected` |
| `note` | text | หมายเหตุ (กรณี reject) |
| `verified_at` | timestamptz | วันที่แอดมิน approve/reject |
| `verified_by_api` | boolean | OCR ตรวจผ่านอัตโนมัติหรือไม่ |
| `created_at` | timestamptz | วันที่ส่งสลิป |

> **Constraint:** `UNIQUE(user_id, week)` — 1 นักศึกษาส่งได้ 1 สลิปต่องวด (ยกเว้น rejected แล้วส่งใหม่)

---

#### `payment_credits` — ยอดค้างชำระ (Credit)

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `user_id` | uuid (FK → users) | นักศึกษาที่ค้าง |
| `week` | integer (FK → week_settings) | งวดที่ค้าง |
| `amount` | numeric | ยอดค้างชำระ |
| `status` | text | `pending` / `repaid` / `forgiven` |
| `repaid_at` | timestamptz | วันที่ชำระคืน |
| `repaid_via` | uuid | payment ID ที่ใช้ชำระคืน |
| `note` | text | หมายเหตุ |
| `created_by` | uuid (FK → users) | เหรัญญิกที่บันทึก |
| `created_at` | timestamptz | วันที่บันทึก |

> **Constraint:** `UNIQUE(user_id, week)` — 1 credit ต่อ 1 คนต่องวด

---

#### `expenses` — รายจ่ายสาขา

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `title` | text | ชื่อรายการจ่าย |
| `description` | text | รายละเอียด |
| `amount` | numeric | ยอดเงิน |
| `created_by` | uuid (FK → users) | ผู้บันทึก |
| `approved_by` | uuid (FK → users) | ผู้อนุมัติ (null = ยังไม่อนุมัติ) |
| `receipt_url` | text | URL ใบเสร็จ |
| `created_at` | timestamptz | วันที่บันทึก |

---

#### `incomes` — รายรับพิเศษ (นอกจากการเก็บเงินรายงวด)

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `title` | text | ชื่อรายรับ |
| `description` | text | รายละเอียด |
| `amount` | numeric | ยอดเงิน |
| `source` | text | แหล่งที่มา |
| `created_by` | uuid (FK → users) | ผู้บันทึก |
| `approved_by` | uuid (FK → users) | ผู้อนุมัติ |
| `created_at` | timestamptz | วันที่บันทึก |

---

#### `notifications` — ประวัติการแจ้งเตือน

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `user_id` | uuid (FK → users) | ผู้รับการแจ้งเตือน |
| `title` | text | หัวข้อ |
| `message` | text | ข้อความ |
| `type` | text | `info` / `warning` / `success` |
| `is_read` | boolean | อ่านแล้วหรือยัง |
| `created_at` | timestamptz | วันที่ส่ง |

---

#### `audit_logs` — ประวัติการกระทำในระบบ

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Primary key |
| `actor_id` | uuid (FK → users) | ผู้กระทำ |
| `action` | text | ประเภทการกระทำ |
| `target_id` | uuid | ID ของข้อมูลที่ถูกกระทำ |
| `old_value` | jsonb | ค่าก่อนเปลี่ยน |
| `new_value` | jsonb | ค่าหลังเปลี่ยน |
| `created_at` | timestamptz | เวลากระทำ |

---

#### `system_settings` — ค่าตั้งค่าระบบ (Key-Value)

| Key | Default | Description |
|---|---|---|
| `tier_a_amount` | `60` | ยอดเก็บรายงวด Tier A |
| `tier_b_amount` | `50` | ยอดเก็บรายงวด Tier B |
| `tier_c_amount` | `30` | ยอดเก็บรายงวด Tier C |
| `tier_c_max_quota` | `5` | จำนวนโควต้า Tier C สูงสุด |
| `base_weekly_amount` | `50` | ยอดพื้นฐานรายงวด |
| `reserve_fund_monthly_target` | `200` | เป้าหมายกองทุนสำรองต่อเดือน |

---

### Database Functions (PostgreSQL)

#### `get_treasury_balance()` → numeric
คำนวณยอดคงเหลือปัจจุบัน:
```
= SUM(approved payments) - SUM(approved expenses)
```

#### `get_week_collection_rate(target_week)` → numeric
คำนวณอัตราการชำระของงวดนั้น:
```
= (จำนวนนักศึกษาที่ approved ÷ จำนวนนักศึกษาทั้งหมด) × 100
```

#### `get_expected_weekly_amount(p_week)` → numeric
คำนวณยอดรวมที่ควรเก็บได้รายงวด (รวม Tier A/B/C + activity extra):
```
= SUM ต่อนักศึกษาแต่ละคน (tier_amount + activity_extra_amount)
```

---

## ระบบ Tier และการคิดเงิน

นักศึกษาแต่ละคนอยู่ใน Tier ใด Tier หนึ่ง ซึ่งกำหนดยอดที่ต้องจ่ายรายงวด:

| Tier | ยอดรายงวด | เงื่อนไข |
|---|---|---|
| **A** | ฿60 | นักศึกษาที่สมัครใจจ่ายมากกว่าปกติ |
| **B** (ค่าเริ่มต้น) | ฿50 | ทุกคนเริ่มต้นที่ Tier B |
| **C** | ฿30 | ลดหย่อนพิเศษ — **มีโควต้าจำกัด** (ค่าเริ่มต้น: 5 คน) |

**กฎของ Tier C:**
- จำนวนคนที่ได้ Tier C พร้อมกันจะไม่เกินค่า `tier_c_max_quota` ใน `system_settings`
- เมื่อมีการเปลี่ยน Tier → ระบบตรวจโควต้าก่อน หากเต็มจะปฏิเสธการเปลี่ยน
- API `/api/students/[id]/tier` จะ validate โควต้าก่อน PATCH

**ยอดที่นักศึกษาต้องจ่ายต่องวด:**
```
= tier_amount + (activity_extra_amount ถ้า is_separate_collection = false)
+ (late_fine_amount ถ้าจ่ายหลัง deadline)
```

---

## ระบบ Credit (ยอดค้างชำระ)

Credit คือกลไกให้นักศึกษาที่ไม่สามารถจ่ายทันกำหนดสามารถ "ค้างไว้ก่อน" โดยไม่โดนปรับ

**Flow ของ Credit:**

```
เหรัญญิกบันทึก Credit (pending)
    ↓
นักศึกษาโอนเงินชำระคืน + ส่งสลิป
    ↓
เหรัญญิก approve สลิปนั้น
    ↓
Credit status เปลี่ยนเป็น "repaid" + บันทึก repaid_via = payment.id
```

**สถานะ Credit:**

| Status | ความหมาย |
|---|---|
| `pending` | ยังค้างอยู่ ยังไม่ได้ชำระ |
| `repaid` | ชำระคืนแล้ว |
| `forgiven` | เหรัญญิกยกหนี้ให้ (ไม่ต้องจ่าย) |

> **หมายเหตุ:** นักศึกษาที่มี Credit `pending` จะไม่ถูกคิดค่าปรับ (`late_fine_amount`) เพราะถือว่าได้รับการผ่อนผันแล้ว

---

## Flow การทำงานหลัก

### 1. การ Login และ Bind Account

```
นักศึกษากด "Login with LINE"
    ↓
Redirect ไป LINE OAuth (scope: profile, openid)
    ↓
LINE ส่ง code กลับมาที่ /api/auth/line/callback
    ↓
Exchange code → ดึง LINE Profile (userId, displayName, pictureUrl)
    ↓
ตรวจว่า line_user_id มีใน users table ไหม?
    ├── มีแล้ว → set session → redirect /student/dashboard
    └── ไม่มี → redirect /bind (พร้อม line_user_id ใน session)
        ↓
    กรอก Student ID (8 หลัก)
        ↓
    ส่ง OTP ยืนยันผ่าน LINE
        ↓
    กรอก OTP ถูก → สร้าง user record → redirect /student/dashboard
```

---

### 2. การส่งสลิปและตรวจสอบอัตโนมัติ

```
นักศึกษาเลือกสัปดาห์ที่ยังไม่ได้จ่าย
    ↓
อัปโหลดรูปสลิป (PNG/JPG/WebP, max 5MB)
    ↓
[Server] อัปโหลดรูปไปที่ Supabase Storage (bucket: slips)
    ↓
[Server] ส่ง URL ไปให้ Thunder API (OCR)
    ↓
Thunder API ส่งกลับ: { amount, trans_ref, date, bank }
    ↓
ตรวจ trans_ref ซ้ำใน payments table?
    ├── ซ้ำ → Reject: "Duplicate Transaction Reference"
    └── ไม่ซ้ำ → ตรวจยอดเงิน vs tier_amount
        ├── ตรงกัน → บันทึก payments (status: pending) → รอเหรัญญิก approve
        └── ไม่ตรง → บันทึก payments (status: pending) + note: "Amount mismatch"
    ↓
เหรัญญิก Approve → status → "approved" → ส่ง LINE แจ้ง
เหรัญญิก Reject  → status → "rejected" + reason → ส่ง LINE แจ้ง
```

> **หมายเหตุ:** ระบบไม่ Auto-approve อัตโนมัติ เหรัญญิกต้องกด approve ทุกครั้ง แต่ OCR ช่วยแสดงข้อมูลล่วงหน้าให้ตรวจง่ายขึ้น

---

### 3. การส่ง LINE Notification

เหรัญญิกสามารถส่งแจ้งเตือนได้ 3 รูปแบบ:

| ประเภท | เงื่อนไข | ข้อความ |
|---|---|---|
| Payment Approved | เมื่อกด approve | `✅ ยืนยันการชำระเงิน สัปดาห์ที่ X ฿YYY` |
| Payment Rejected | เมื่อกด reject | `❌ สลิปถูกปฏิเสธ เหตุผล: ...` |
| Reminder | กดปุ่มแจ้งเตือนในหน้า Payments | `⏰ แจ้งเตือนค้างชำระ สัปดาห์ที่ X ฿YYY` |

**Bulk Reminder:**
- เหรัญญิกกด "Send Reminder" → ระบบดึงรายชื่อทุกคนที่ยังไม่ได้จ่ายงวดนั้น → ส่ง LINE ทุกคน
- มี rate limiting: delay 50ms ต่อข้อความ (LINE API limit)

---

## API Endpoints

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/auth/line/callback` | `GET` | Public | LINE OAuth callback, exchange code |
| `/api/auth/bind` | `POST` | Public | ผูก Student ID กับ LINE + ส่ง OTP |
| `/api/payments/upload` | `POST` | Student | อัปโหลดสลิป + รัน OCR |
| `/api/payments/verify` | `PATCH` | Treasurer/Admin | Approve หรือ Reject สลิป |
| `/api/payments/history` | `GET` | Student/Admin | ดึงประวัติการชำระ |
| `/api/credits` | `GET` | Admin | ดึงรายการ Credit ทั้งหมด |
| `/api/credits` | `POST` | Treasurer/Admin | สร้าง Credit ให้นักศึกษา |
| `/api/expenses` | `GET` | Public | ดึงรายจ่ายที่อนุมัติแล้ว |
| `/api/expenses` | `POST` | Treasurer/Admin | บันทึกรายจ่ายใหม่ |
| `/api/students/[id]/tier` | `PATCH` | Treasurer/Admin | เปลี่ยน Tier + ตรวจโควต้า |
| `/api/students/[id]/binding` | `DELETE` | Admin | Reset LINE Binding |
| `/api/notify` | `POST` | Treasurer/Admin | ส่ง LINE แจ้งเตือน |
| `/api/reports/export` | `GET` | Treasurer/Admin | Export Excel |

---

## บทบาทและสิทธิ์ (Roles & Permissions)

| หน้า / API | student | treasurer | admin |
|---|---|---|---|
| `/student/dashboard` | ✅ เฉพาะตัวเอง | — | — |
| `/student/upload` | ✅ | — | — |
| `/student/history` | ✅ เฉพาะตัวเอง | — | — |
| `/student/transparency` | ✅ | ✅ | ✅ |
| `/admin/overview` | — | ✅ | ✅ |
| `/admin/payments` | — | ✅ | ✅ |
| `/admin/expenses` | — | ✅ | ✅ |
| `/admin/students` | — | ✅ | ✅ |
| `/admin/reports` | — | ✅ | ✅ |
| `/admin/audit` | — | — | ✅ เท่านั้น |
| `/admin/settings` | — | — | ✅ เท่านั้น |
| Reset LINE Binding | — | — | ✅ เท่านั้น |
| เปลี่ยน Role ผู้ใช้ | — | — | ✅ เท่านั้น |

---

## ความปลอดภัย (Security & RLS)

### Row Level Security (Supabase)

**ตาราง `users`:**
- Student ดูได้เฉพาะ row ของตัวเอง (`auth.uid() = id`)
- Treasurer/Admin ดูได้ทุก row

**ตาราง `payments`:**
- Student INSERT/SELECT ได้เฉพาะ `user_id = auth.uid()`
- Treasurer/Admin มีสิทธิ์ ALL

**ตาราง `expenses`:**
- ทุกคน SELECT ได้เฉพาะ row ที่ `approved_by IS NOT NULL` (public transparency)
- Treasurer/Admin จัดการได้ทั้งหมด

**ตาราง `payment_credits`:**
- Student SELECT ได้เฉพาะ `user_id = auth.uid()`
- Treasurer/Admin มีสิทธิ์ ALL

**ตาราง `audit_logs`:**
- Admin SELECT เท่านั้น

### Route Protection (Next.js Middleware)

`middleware.ts` ใช้ `updateSession()` จาก Supabase SSR เพื่อ:
- Refresh session token อัตโนมัติ
- Block request ที่ไม่มี session ก่อนถึง protected routes

การ protect route แยกตาม Role ทำใน layout ของแต่ละ route group:
- `(admin)/layout.tsx` → ตรวจ role ถ้าไม่ใช่ treasurer/admin → redirect
- `(student)/layout.tsx` → ตรวจ session ถ้าไม่มี → redirect ไป /login

### Duplicate Slip Protection

ทุกครั้งที่มีการ upload สลิป ระบบจะตรวจสอบ `trans_ref` ซ้ำก่อนบันทึก — หากเลข Transaction Reference เคยมีในระบบแล้ว จะ reject ทันที ป้องกันการใช้สลิปซ้ำ

---

## คู่มือการใช้งาน — นักศึกษา

### การเข้าสู่ระบบครั้งแรก

1. เปิด [treasury-ms.vercel.app](https://treasury-ms.vercel.app) → กด **"เข้าสู่ระบบด้วย LINE"**
2. อนุญาต LINE Login → กรอก **Student ID 8 หลัก**
3. รับ OTP ทาง LINE Chat → กรอก OTP → เข้าใช้งานได้

### Dashboard (หน้าหลัก)

หน้า Dashboard แสดง:
- **Hero Card** — งวดปัจจุบัน, วันครบกำหนด, ยอดที่ต้องจ่าย, สถานะ (paid/pending/unpaid)
- **Week Grid** — ภาพรวมทุกสัปดาห์ในเทอม (กดดูรายละเอียดแต่ละงวดได้)
- **Payment History** — ประวัติการจ่ายล่าสุด
- **Branch Expenses** — รายจ่ายสาขา (อ่านอย่างเดียว)

### การส่งสลิป

1. กด **"Upload Slip"** → เลือกสัปดาห์ที่ยังไม่จ่าย
2. อัปโหลดรูปสลิป (PNG/JPG, max 5MB)
3. ระบบจะอ่านสลิปอัตโนมัติ แสดงยอดเงิน, วันที่, เลข Ref
4. รอเหรัญญิก **Approve** → จะได้รับแจ้งเตือนทาง LINE

**ข้อควรระวังเมื่อส่งสลิป:**
- ใช้รูปสลิปที่ชัดเจน ไม่เบลอ
- ห้ามใช้สลิปซ้ำกับที่เคยส่งไปแล้ว
- ตรวจสอบว่าโอนเงินมาถูกบัญชี และตรงยอดกับ Tier ของตัวเอง
- ถ้าสลิปถูก Reject ให้ดูเหตุผล แล้วส่งสลิปที่ถูกต้องใหม่

### หน้า Transparency (สาธารณะ)

ทุกคนเข้าดูได้โดยไม่ต้อง Login แสดง:
- ยอดรวมที่เก็บได้ทุกงวด
- รายจ่ายสาขาทั้งหมดที่อนุมัติแล้ว (พร้อมใบเสร็จ)
- ยอดคงเหลือ (Balance)

---

## คู่มือการใช้งาน — เหรัญญิก/แอดมิน

### Admin Overview Dashboard

แสดง KPI หลัก 4 ตัว:
- **Total Balance** — คำนวณจาก `get_treasury_balance()`
- **Collection Rate** — % นักศึกษาที่จ่ายแล้วงวดนี้
- **Pending Review** — จำนวนสลิปรอตรวจ
- **Monthly Expenses** — รายจ่ายเดือนนี้

### การ Approve/Reject สลิป

1. ไปที่ **Admin → Payments**
2. กรองด้วย Status = "Pending"
3. กดที่ row → เปิด Side Sheet ดูรูปสลิป + ข้อมูล OCR
4. ตรวจสอบ: ชื่อผู้โอน, ยอดเงิน, วันที่, เลข Ref
5. กด **Approve** หรือ **Reject** (กรณี Reject ต้องใส่เหตุผล)
6. ระบบจะส่ง LINE แจ้งนักศึกษาอัตโนมัติ + บันทึก Audit Log

### การบันทึกรายจ่าย

1. ไปที่ **Admin → Expenses** → กด **"+ Add Expense"**
2. กรอก: ชื่อรายการ, รายละเอียด, ยอดเงิน, หมวดหมู่
3. แนบใบเสร็จ (รูปภาพหรือ PDF, max 10MB)
4. กด Submit → รายจ่ายจะแสดงสถานะ "Pending Approval"
5. แอดมินคนอื่นกด Approve → รายจ่ายจะแสดงในหน้า Transparency

### การจัดการ Tier นักศึกษา

1. ไปที่ **Admin → Students**
2. ค้นหานักศึกษา → กด Actions → **"Change Tier"**
3. เลือก Tier ใหม่ + ใส่หมายเหตุ
4. ระบบตรวจโควต้า Tier C อัตโนมัติ (ถ้าเต็มจะแจ้งเตือน)

### การส่ง LINE Reminder

**วิธีที่ 1 — Bulk Reminder:**
1. ไปที่ **Admin → Payments** → เลือกสัปดาห์
2. กด **"Send Reminder"** → ระบบส่งหานักศึกษาทุกคนที่ยังไม่จ่ายงวดนั้น

**วิธีที่ 2 — Individual:**
1. ไปที่ **Admin → Students**
2. ค้นหานักศึกษา → กด **"Send Reminder"**

### การ Export รายงาน

ไปที่ **Admin → Reports** → เลือก Report Type:
- **Income Report** — รายรับรายงวด + Collection Rate
- **Expense Report** — รายจ่ายทั้งหมด
- **Student Summary** — สรุปสถานะรายคน (matrix W1–W12)
- **Full Balance Sheet** — รายรับ vs รายจ่าย

กด **"Export Excel"** → ดาวน์โหลดไฟล์ `.xlsx`

---

## การติดตั้งและ Setup

### Requirements

- Node.js 18+
- npm หรือ yarn
- บัญชี [Supabase](https://supabase.com) (free tier ได้)
- บัญชี [LINE Developers](https://developers.line.biz)
- API Key ของ [Thunder API](https://thunder.in.th)

### ขั้นตอนติดตั้ง

```bash
# 1. Clone repository
git clone https://github.com/JIRAA1/treasury-ms.git
cd treasury-ms

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local
# แก้ไขค่าใน .env.local (ดูหัวข้อถัดไป)

# 4. รัน development server
npm run dev
```

เปิดที่ `http://localhost:3000`

---

## Environment Variables

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```env
# ─── Supabase ───────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # ใช้เฉพาะ server-side เท่านั้น

# ─── LINE Developers ────────────────────────────────────────
LINE_CHANNEL_ID=1234567890
LINE_CHANNEL_SECRET=abcdef1234567890abcdef1234567890
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Thunder OCR API ────────────────────────────────────────
THUNDER_API_KEY=th_xxxxxxxxxxxxxxxxxxxxxxxx

# ─── App Config ─────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production: NEXT_PUBLIC_APP_URL=https://treasury-ms.vercel.app
```

> ⚠️ **ห้าม commit `.env.local`** ไปยัง Git — ไฟล์นี้อยู่ใน `.gitignore` แล้ว

---

## Supabase Setup

### 1. สร้าง Project ใน Supabase

ไปที่ [supabase.com](https://supabase.com) → New Project

### 2. รัน Database Schema

ไปที่ **SQL Editor** ใน Supabase Dashboard:

1. รันไฟล์ `supabase_schema.sql` (ตาราง + RLS + Functions หลัก)
2. รันไฟล์ `supabase_migration_tier_credit.sql` (เพิ่ม Tier, Activity, Credit system)

รัน block ทีละ block ตามลำดับ STEP 1–8 ใน migration file

### 3. สร้าง Storage Buckets

ไปที่ **Storage** ใน Supabase Dashboard:

| Bucket | Public | Max Size | Allowed Types |
|---|---|---|---|
| `slips` | ✅ Public | 5MB | `image/*` |
| `receipts` | ✅ Public | 10MB | `image/*, application/pdf` |

เพิ่ม Storage Policy สำหรับ `slips`:
```sql
-- นักศึกษา upload ได้เฉพาะ folder ของตัวเอง
CREATE POLICY "Users upload own slips" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'slips' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ทุกคนอ่านได้ (เพื่อให้ Thunder API เรียกดูได้)
CREATE POLICY "Public read slips" ON storage.objects
FOR SELECT USING (bucket_id = 'slips');
```

### 4. ตั้งค่า Auth Provider

ไปที่ **Authentication → Providers** → เปิดใช้งาน "Custom" (LINE ใช้ Custom OAuth)

---

## LINE Integration

### สร้าง LINE Channel

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider ใหม่ (หากยังไม่มี)
3. สร้าง Channel ประเภท **"Messaging API"**
4. ไปที่ **"LINE Login"** → สร้าง Channel อีกอัน (สำหรับ OAuth)

### LINE Login Channel Settings

- **Callback URL:** `https://your-domain.vercel.app/api/auth/line/callback`
- **Scope:** `profile openid`
- Copy **Channel ID** และ **Channel Secret** → ใส่ใน `.env.local`

### Messaging API Channel Settings

- **Webhook URL:** ไม่จำเป็นสำหรับระบบนี้ (เราส่งเอง ไม่รับ)
- Copy **Channel Access Token (Long-lived)** → ใส่ใน `.env.local`

---

## OCR — Thunder API

ระบบใช้ [Thunder API](https://thunder.in.th) สำหรับอ่านข้อมูลจากสลิปโอนเงิน

### การทำงาน

```typescript
// src/lib/thunder.ts
POST https://api.thunder.in.th/v1/slip-verify
Authorization: Bearer {THUNDER_API_KEY}
Body: { url: "https://...supabase.../slips/..." }

// Response
{
  success: true,
  data: {
    amount: 100,
    transRef: "TH00XXXXXXXXX",
    date: "2568-05-18",
    bank: "KBANK",
    confidence: 0.97
  }
}
```

### กรณีที่ OCR อ่านไม่ได้

- ระบบบันทึก payment ด้วย `amount = null`, `trans_ref = null`
- Status จะเป็น `pending` เหมือนเดิม
- เหรัญญิกต้องตรวจด้วยตาและ Manual Approve + แก้ยอดเงินด้วยมือ

---

## Audit Logging

ทุกการกระทำที่แก้ไขข้อมูลสำคัญจะถูกบันทึกลง `audit_logs` อัตโนมัติ

### Action Types

| Action | ความหมาย |
|---|---|
| `payment_uploaded` | นักศึกษาส่งสลิปใหม่ |
| `payment_approved` | เหรัญญิก approve สลิป |
| `payment_rejected` | เหรัญญิก reject สลิป |
| `expense_created` | บันทึกรายจ่ายใหม่ |
| `expense_approved` | อนุมัติรายจ่าย |
| `expense_deleted` | ลบรายจ่าย |
| `notification_sent` | ส่ง LINE แจ้งเตือน |
| `student_binding_reset` | Reset LINE Binding |
| `user_role_changed` | เปลี่ยน Role |
| `tier_changed` | เปลี่ยน Tier นักศึกษา |

Admin สามารถดู Audit Log ได้ที่ **Admin → Audit Logs** พร้อมกรองตาม: ช่วงวันที่, ประเภท Action, ผู้กระทำ และ Export เป็น CSV

---

## การ Reset ระบบสำหรับเทอมใหม่

เมื่อจบเทอม เหรัญญิกสามารถ Reset ระบบเพื่อเริ่มเทอมใหม่ได้:

### ขั้นตอน

1. ไปที่ **Admin → Settings → Data Management**
2. กด **"Reset All Data"** (ต้องเป็น Admin เท่านั้น)
3. ระบบจะ:
   - ลบประวัติ `payments` ทั้งหมด
   - ลบ `payment_credits` ทั้งหมด
   - ลบ `expenses` ทั้งหมด
   - รีเซ็ต `tier` ของทุกคนกลับเป็น `B`
   - รีเซ็ต `week_settings` เป็นค่าว่าง

4. ตั้งค่า **Week Settings** สำหรับเทอมใหม่:
   - สร้าง Week 1–12 (หรือจำนวนงวดที่ต้องการ)
   - ตั้งวันครบกำหนด (`deadline`)
   - ตั้งยอดเงิน (`amount`, `base_amount`)
   - ตั้งค่าปรับ (`late_fine_amount`) ถ้ามี

> ⚠️ **คำเตือน:** การ Reset ไม่สามารถย้อนกลับได้ ควร Export รายงานก่อนทุกครั้ง

---

## Troubleshooting

| ปัญหา | สาเหตุที่เป็นไปได้ | วิธีแก้ไข |
|---|---|---|
| OCR อ่านยอดเงินไม่ถูกต้อง | สลิปไม่ชัดหรือ Thunder API อ่านผิด | เหรัญญิกไปที่ Payments → เปิดสลิป → แก้ยอดด้วยมือ → Manual Approve |
| สลิปถูก Reject "Duplicate Ref" | เลข trans_ref ถูกใช้ไปแล้ว | ตรวจสอบว่าใช้สลิปซ้ำหรือไม่ ถ้าเป็นสลิปใหม่จริง ให้เหรัญญิก Manual Approve |
| นักศึกษาเปลี่ยน LINE ไม่ได้ Login | LINE Account เดิมถูกผูกไว้ | Admin → Students → ค้นหาชื่อ → "Reset LINE Binding" → นักศึกษา Login ใหม่ |
| ยอดคงเหลือในระบบไม่ตรง | มีการแก้ไขข้อมูลย้อนหลัง | Admin → Audit Logs → กรองช่วงวันที่ → ตรวจว่ามี action ผิดปกติไหม |
| ไม่ได้รับ LINE OTP | LINE Messaging API มีปัญหา | ตรวจสอบ `LINE_CHANNEL_ACCESS_TOKEN` ใน env และ quota ของ LINE API |
| หน้า Transparency ไม่แสดงรายจ่าย | รายจ่ายยังไม่ได้ Approve | เหรัญญิก/Admin ต้อง approve expense ก่อนจึงจะแสดงหน้าสาธารณะ |
| Tier C เต็ม เปลี่ยนไม่ได้ | โควต้าจาก `tier_c_max_quota` เต็ม | Admin → Settings → เพิ่มค่า `tier_c_max_quota` ใน system_settings |
| Export Excel ไม่มีข้อมูล | ไม่มี payment ที่ approved ในช่วงที่เลือก | ตรวจสอบ filter ช่วงวันที่ หรือเลือก All |

---

## เงื่อนไขและข้อควรระวัง

### เงื่อนไขระบบ Payment

- นักศึกษา 1 คน ส่งสลิปได้ 1 ครั้งต่องวด (ยกเว้น rejected แล้วส่งใหม่ได้)
- `trans_ref` ต้อง unique ทั่วทั้งระบบ — ป้องกันการใช้สลิปซ้ำ
- สลิปที่ส่งแล้วจะไม่ถูกลบออกจาก Storage ยกเว้น Admin ลบด้วยมือ
- ถ้า OCR ล้มเหลว ระบบจะบันทึก payment เป็น pending ปกติ (ไม่ขึ้น error ให้นักศึกษา)

### เงื่อนไข Tier

- ค่า default คือ `B` สำหรับทุกคน
- เมื่อ Reset ระบบ Tier จะกลับเป็น `B` ทุกคน
- การเปลี่ยน Tier C มีโควต้า — ถ้าโควต้าเต็ม API จะ return error 409
- การเปลี่ยน Tier จะมีผลทันทีกับงวดถัดไป (ไม่ย้อนหลัง)

### เงื่อนไข Credit

- 1 user ต่อ 1 งวด มีได้ 1 credit เท่านั้น (`UNIQUE(user_id, week)`)
- Credit ที่ `forgiven` จะไม่นับในยอดค้างชำระ
- การ repaid จะต้องมี payment ที่ approved เป็น reference (`repaid_via`)

### เงื่อนไข Transparency

- รายจ่ายที่ `approved_by IS NULL` จะไม่แสดงในหน้าสาธารณะ
- หน้า Transparency ไม่ต้อง login แต่ไม่แสดงข้อมูลนักศึกษารายบุคคล

### เงื่อนไขความปลอดภัย

- `SUPABASE_SERVICE_ROLE_KEY` ต้องไม่ expose ใน client-side (ห้ามขึ้นต้นด้วย `NEXT_PUBLIC_`)
- ทุก API route ที่ mutate ข้อมูลต้องตรวจ session ก่อนทุกครั้ง
- LINE Channel Secret ต้องเป็น secret เสมอ ห้ามส่งไป client

---

## TypeScript Interfaces หลัก

```typescript
// src/types/index.ts

interface User {
  id: string
  student_id: string
  fullname: string
  email?: string
  line_user_id?: string
  role: 'student' | 'treasurer' | 'admin'
  tier: 'A' | 'B' | 'C'
  tier_note?: string
  verified: boolean
  created_at: string
}

interface Payment {
  id: string
  user_id: string
  week: number
  amount: number
  trans_ref?: string
  slip_url?: string
  status: 'pending' | 'approved' | 'rejected'
  note?: string
  verified_at?: string
  verified_by_api: boolean
  created_at: string
  user?: User
}

interface PaymentCredit {
  id: string
  user_id: string
  week: number
  amount: number
  status: 'pending' | 'repaid' | 'forgiven'
  repaid_at?: string
  repaid_via?: string
  note?: string
  created_by?: string
  created_at: string
}

interface WeekSetting {
  week: number
  title: string
  deadline: string
  amount: number
  base_amount: number
  activity_type?: 'small' | 'medium' | 'large'
  activity_extra_amount: number
  is_separate_collection: boolean
  late_fine_amount: number
  payment_open_at?: string
  payment_close_at?: string
  qr_url?: string
}

interface WeekStatus {
  week: number
  status: 'paid' | 'pending' | 'unpaid'
  amount: number
  payment?: Payment
}
```

---

## Color System

ระบบใช้ Monochrome Theme (ไม่มีสีสันจัดจ้าน):

| Token | Hex | ใช้ |
|---|---|---|
| `background` | `#ffffff` | พื้นหลังหลัก |
| `background.secondary` | `#f8f8f7` | Sidebar, Cards |
| `background.tertiary` | `#f2f2f0` | Hover states |
| `text.primary` | `#1a1a18` | ข้อความหลัก |
| `text.secondary` | `#6b6b68` | ข้อความรอง |
| `text.muted` | `#a8a8a4` | Labels, Placeholders |
| `border` | `#e8e8e6` | Dividers |
| `brand` | `#1a1a18` | Primary buttons (black) |

---

*TreasuryMS — Developed by COM_EDU*  
*สร้างเพื่อมาตรฐานความโปร่งใสทางการเงินของสาขาคอมพิวเตอร์ศึกษา*
