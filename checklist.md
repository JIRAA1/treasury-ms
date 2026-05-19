# TreasuryMS — Build Checklist

> อัปเดต: 18 พฤษภาคม 2568 | ทำตาม TreasuryMS_AI_Prompt_Spec.md

---

## SECTION 0 — Project Bootstrap
- [x] Next.js 16 project ด้วย TypeScript + TailwindCSS + App Router
- [x] Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zustand`, `react-hook-form`, `zod`, `axios`, `date-fns`, `sonner`, `xlsx`, `@hookform/resolvers`
- [x] โครงสร้างโฟลเดอร์ครบตาม spec: `app/`, `components/`, `lib/`, `hooks/`, `store/`, `types/`

---

## SECTION 1 — Design System & Global Styles
- [x] `src/app/globals.css` — Monochrome color tokens (background, border, text, brand, status)
- [x] Font: Sarabun + Noto Sans Thai (Google Fonts)
- [x] Custom scrollbar (thin, monochrome)
- [x] `src/lib/utils.ts` — `cn()`, `formatCurrency()`, `formatDate()` (พ.ศ.), `getWeekLabel()`, `getPaymentStatus()`
- [x] `src/types/index.ts` — User, Payment, Expense, AuditLog, WeekStatus, DashboardStats interfaces

---

## SECTION 2 — Supabase Setup
- [x] SQL schema ใน `supabase_schema.sql`: tables (users, payments, expenses, notifications, audit_logs), indexes, RLS policies, helper functions (`get_treasury_balance`, `get_week_collection_rate`)
- [x] `src/lib/supabase/client.ts` — browser client
- [x] `src/lib/supabase/server.ts` — server client (SSR with cookie)
- [x] `src/lib/supabase/admin.ts` — service role admin client (for auth admin operations)
- [x] `src/lib/supabase/middleware.ts` — session refresh + route protection
- [x] `middleware.ts` — Next.js middleware กรอง session ทุก request
- [x] `.env.local` — variables ครบ (Supabase URL/keys, LINE, Thunder)

---

## SECTION 3 — Shared Components

### Layout
- [x] `src/components/layout/Sidebar.tsx` — role-based nav, active state, pending badge, unpaid dot indicator
- [x] `src/components/layout/Topbar.tsx` — title, subtitle, action slot
- [x] `src/components/layout/AppShell.tsx` — sidebar + content wrapper

### Stores
- [x] `src/store/uiStore.ts` — Zustand sidebar open/close state
- [x] `src/store/authStore.ts` — Zustand user session state

### Shared UI
- [x] `src/components/shared/KpiCard.tsx` — label, value, sub, trend
- [x] `src/components/shared/ActivityFeed.tsx` — icon per type, dividers
- [x] `src/components/shared/EmptyState.tsx` — centered icon + title + action button

### Payments Components
- [x] `src/components/payments/StatusPill.tsx` — paid/pending/rejected/unpaid badges
- [x] `src/components/payments/WeekGrid.tsx` — 6-column grid, color-coded, hover scale
- [x] `src/components/payments/PaymentRow.tsx` — week + date + amount + status
- [x] `src/components/payments/SlipUploader.tsx` — drag-and-drop, OCR animation steps, success/fail states

### Expenses Components
- [x] `src/components/expenses/ExpenseRow.tsx` — icon + title + amount + receipt link
- [x] `src/components/expenses/ExpenseForm.tsx` — Zod validation, category select, receipt upload

---

## SECTION 4 — Authentication
- [x] `src/app/(auth)/login/page.tsx` — LINE OAuth button, link to transparency
- [x] `src/app/(auth)/bind/page.tsx` — 2-step: student ID → OTP → redirect ด้วย magic-link
- [x] `src/app/api/auth/line/callback/route.ts` — exchange LINE code → check DB → **generate magic-link** (`redirectTo=/auth/callback?next=...`) for existing users → redirect; new users → /bind
- [x] `src/app/api/auth/bind/route.ts` — validate student_id, generate OTP, store in cookie, send LINE
- [x] `src/app/api/auth/bind/verify/route.ts` — verify OTP cookie → upsert user → **generateLink** (`redirectTo=/auth/callback?next=...`) → return `redirectUrl` to frontend
- [x] `src/app/auth/callback/route.ts` — **PKCE callback handler**: `exchangeCodeForSession(code)` → sets real sb-* session cookies → redirect to `next`
- [x] `src/lib/line.ts` — generateAuthUrl, exchangeCode, sendLineMessage, sendOTP, sendPaymentApproved, sendPaymentRejected, sendPaymentReminder, sendBulkReminder
- [x] `src/lib/audit.ts` — logAction() helper

---

## SECTION 5 — Student Pages
- [x] `src/app/(student)/layout.tsx` — auth guard + AppShell + unpaid week detection
- [x] `src/app/(student)/dashboard/page.tsx` — Hero status card, KPI grid, WeekGrid, payment history panel, expenses panel
- [x] `src/app/(student)/upload/page.tsx` — week selector → SlipUploader → redirect after success
- [x] `src/app/(student)/history/page.tsx` — summary stats + full payment table
- [x] `src/app/(student)/transparency/page.tsx` — public page, income by week + expenses list + balance

---

## SECTION 6 — Admin Pages
- [x] `src/app/(admin)/layout.tsx` — role guard (admin/treasurer only) + AppShell + pending count
- [x] `src/app/(admin)/overview/page.tsx` — KPI grid, pending payments table, balance card, weekly bar chart, activity feed, quick actions
- [x] `src/app/(admin)/payments/page.tsx` — filter bar, searchable table, pagination, inline detail sheet, approve/reject actions
- [x] `src/app/(admin)/expenses/page.tsx` — expenses table, approve button, add expense slide-over panel
- [x] `src/app/(admin)/students/page.tsx` — stats, search/filter, expandable rows with WeekGrid, send reminder, reset LINE binding
- [x] `src/app/(admin)/reports/page.tsx` — balance sheet, income by week table, student payment matrix
- [x] `src/app/(admin)/audit/page.tsx` — audit log table with color-coded badges, change diffs, CSV export

---

## SECTION 7 — API Routes
- [x] `POST /api/payments/upload` — multipart upload, Supabase Storage, Thunder OCR, duplicate detection, audit log
- [x] `PATCH /api/payments/verify` — approve/reject, role check, audit log, LINE notification
- [x] `GET /api/payments/history` — role-aware: student (own), admin (all + filter/search)
- [x] `GET /api/expenses` — list all expenses with creator/approver join
- [x] `POST /api/expenses` — create expense, receipt upload, audit log
- [x] `PATCH /api/expenses/[id]/approve` — approve expense, role check, audit log
- [x] `POST /api/notify` — bulk LINE reminders or custom messages, audit log
- [x] `GET /api/students` — enriched student list with weekStatuses (admin only)
- [x] `DELETE /api/students/[id]/binding` — reset LINE binding (admin only), audit log
- [x] `GET /api/reports/export` — Excel download: income / students / expenses / audit / full

---

## SECTION 8 — Security & Audit
- [x] `src/lib/audit.ts` — typed logAction() called in every mutating API route
- [x] RLS policies defined in schema (students see own, admins see all)
- [x] Role checks in every API route (401/403 responses)
- [x] OTP expiry validation (5 minutes)

---

## SECTION 9 — Reports & Export
- [x] `src/lib/thunder.ts` — verifySlip() with fallback on error
- [x] `GET /api/reports/export?type=income|students|expenses|audit|full` — generates .xlsx

---

## SECTION 10 — Final Checklist

### Root Layout
- [x] `src/app/layout.tsx` — Sarabun + Noto Sans Thai fonts, Sonner Toaster (4s, top-right)

### Auth Flow Fix
- [x] Magic-link session creation — existing LINE users เข้าได้เลยโดยไม่ต้อง OTP
- [x] Bind flow — หลัง OTP verify ส่ง `redirectUrl` (magic-link) กลับ frontend แล้ว `window.location.href` → Supabase redirect → `/auth/callback` → `exchangeCodeForSession` → set real sb-* cookies → `/student/dashboard`
- [x] **Root cause fix**: server-side `signInWithPassword` ใน Route Handler ไม่สามารถ set cookies ได้ → เปลี่ยนเป็น `generateLink` + `/auth/callback` PKCE handler
- [x] **redirectTo fix**: ทุก `generateLink` call ใช้ `redirectTo=/auth/callback?next=...` แทน destination โดยตรง

### ยังต้องทำ (Manual)
- [ ] Supabase Dashboard: สร้าง Storage buckets `slips` (public, 5MB) + `receipts` (public, 10MB)
- [ ] Supabase Storage RLS policies: users upload to own folder
- [ ] LINE Developer Console: เพิ่ม redirect URI → `{APP_URL}/api/auth/line/callback`
- [ ] อัปเดต `.env.local` ด้วย LINE credentials จริง + Thunder API key
- [ ] ทดสอบ LINE OAuth flow end-to-end
- [ ] ทดสอบ slip upload + Thunder OCR
- [ ] ทดสอบ LINE notification delivery
- [ ] Deploy to Vercel + set production env vars

---

## สถานะโดยรวม

| หมวด | สถานะ |
|------|--------|
| Project Bootstrap | ✅ เสร็จ |
| Design System | ✅ เสร็จ |
| Supabase Setup | ✅ เสร็จ (schema manual) |
| Shared Components | ✅ เสร็จ |
| Authentication | ✅ เสร็จ (รวม session fix) |
| Student Pages | ✅ เสร็จ |
| Admin Pages | ✅ เสร็จ |
| API Routes | ✅ เสร็จ |
| Security & Audit | ✅ เสร็จ |
| Reports & Export | ✅ เสร็จ |
| Production Deploy | ⏳ รอ manual steps |
