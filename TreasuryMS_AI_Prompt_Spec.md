# TreasuryMS — AI Prompt Specification Document
### ระบบจัดการการเงินสาขา | Complete Build Guide for AI Coding Assistants

> **วิธีใช้เอกสารนี้:** แต่ละ Section มี Prompt พร้อมส่งให้ AI (Cursor, Claude, v0, Copilot)
> เริ่มจาก Section 1 → 2 → 3 ตามลำดับ แต่ละ prompt เป็น self-contained สามารถส่งแยกได้

---

## SECTION 0 — Project Bootstrap

### Prompt: Initialize Project

```
Create a new Next.js 14 project with the following setup:

Tech stack:
- Next.js 14 (App Router)
- TypeScript (strict mode)
- TailwindCSS
- shadcn/ui (New York style)
- Zustand (global state)
- Supabase JS client (@supabase/supabase-js, @supabase/ssr)
- React Hook Form + Zod (forms & validation)
- Axios (HTTP client)
- date-fns (date utilities)

Run these commands:
1. npx create-next-app@latest treasury-ms --typescript --tailwind --app
2. cd treasury-ms
3. npx shadcn@latest init (choose: New York, Zinc, CSS variables: yes)
4. npm install @supabase/supabase-js @supabase/ssr zustand react-hook-form zod axios date-fns
5. npx shadcn@latest add button card badge input label select table dialog sheet toast avatar separator skeleton

Create the folder structure:
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── bind/page.tsx
│   ├── (student)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── upload/page.tsx
│   │   ├── history/page.tsx
│   │   └── transparency/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── overview/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── expenses/page.tsx
│   │   ├── students/page.tsx
│   │   ├── reports/page.tsx
│   │   └── audit/page.tsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── bind/route.ts
│       ├── payments/
│       │   ├── upload/route.ts
│       │   ├── verify/route.ts
│       │   └── history/route.ts
│       ├── expenses/
│       │   └── route.ts
│       └── notify/
│           └── route.ts
├── components/
│   ├── ui/           (shadcn auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── AppShell.tsx
│   ├── payments/
│   │   ├── PaymentRow.tsx
│   │   ├── StatusPill.tsx
│   │   ├── WeekGrid.tsx
│   │   └── SlipUploader.tsx
│   ├── expenses/
│   │   ├── ExpenseRow.tsx
│   │   └── ExpenseForm.tsx
│   └── shared/
│       ├── KpiCard.tsx
│       ├── ActivityFeed.tsx
│       └── EmptyState.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── line.ts
│   ├── thunder.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── usePayments.ts
│   └── useExpenses.ts
├── store/
│   ├── authStore.ts
│   └── uiStore.ts
├── types/
│   └── index.ts
└── middleware.ts
```

---

## SECTION 1 — Design System & Global Styles

### Prompt: Design System Setup

```
Set up the global design system for TreasuryMS.
Theme: Minimal/Monochrome (inspired by Linear, Notion — clean, no bright colors)

1. Update tailwind.config.ts with this color palette:

colors: {
  background: {
    DEFAULT: '#ffffff',
    secondary: '#f8f8f7',
    tertiary: '#f2f2f0',
    muted: '#ebebea',
  },
  border: {
    DEFAULT: '#e8e8e6',
    strong: '#d4d4d1',
  },
  text: {
    primary: '#1a1a18',
    secondary: '#6b6b68',
    muted: '#a8a8a4',
    disabled: '#c8c8c4',
  },
  brand: {
    DEFAULT: '#1a1a18',
    hover: '#2d2d2a',
  },
  status: {
    paid: { bg: '#1a1a18', text: '#ffffff' },
    unpaid: { bg: '#f2f2f0', text: '#6b6b68' },
    pending: { bg: '#faf8f0', text: '#8a7a40' },
    rejected: { bg: '#fff5f5', text: '#9a3a3a' },
  }
}

2. Create src/styles/globals.css with:
- Base font: Inter (import from Google Fonts or next/font)
- Body: text-text-primary, bg-background, antialiased
- Custom scrollbar: thin, monochrome
- Transition defaults: 150ms ease for colors and backgrounds

3. Create src/lib/utils.ts:
- cn() utility (merge tailwind classes)
- formatCurrency(amount: number): string — format as "฿1,000"
- formatDate(date: string | Date): string — format as "18 May 2568" (Thai Buddhist year)
- getWeekLabel(week: number): string — returns "W1", "W2", etc.
- getPaymentStatus(status: string): { label, variant } object

4. Create src/types/index.ts with all TypeScript interfaces:

interface User {
  id: string
  student_id: string
  fullname: string
  email: string
  line_user_id: string
  role: 'student' | 'treasurer' | 'admin'
  verified: boolean
  created_at: string
}

interface Payment {
  id: string
  user_id: string
  week: number
  amount: number
  trans_ref: string
  slip_url: string
  status: 'pending' | 'approved' | 'rejected'
  verified_at: string | null
  created_at: string
  user?: User
}

interface Expense {
  id: string
  title: string
  description: string
  amount: number
  created_by: string
  approved_by: string | null
  receipt_url: string | null
  created_at: string
  creator?: User
  approver?: User
}

interface AuditLog {
  id: string
  actor_id: string
  action: string
  target_id: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
  actor?: User
}

interface WeekStatus {
  week: number
  status: 'paid' | 'pending' | 'unpaid'
  amount: number
  payment?: Payment
}

interface DashboardStats {
  totalBalance: number
  totalIncome: number
  totalExpense: number
  collectionRate: number
  paidCount: number
  totalStudents: number
  pendingCount: number
}
```

---

## SECTION 2 — Supabase Setup

### Prompt: Database Schema & RLS

```
Create the complete Supabase database schema for TreasuryMS.

Run these SQL migrations in Supabase SQL Editor:

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE NOT NULL,
  fullname TEXT NOT NULL,
  email TEXT,
  line_user_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'treasurer', 'admin')),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week INTEGER NOT NULL CHECK (week >= 1 AND week <= 20),
  amount NUMERIC(10,2) NOT NULL,
  trans_ref TEXT UNIQUE,
  slip_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week)
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_week ON payments(week);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can view all users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'treasurer'))
  );

-- Payments policies
CREATE POLICY "Students can view own payments" ON payments
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Students can insert own payments" ON payments
  FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can manage all payments" ON payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'treasurer'))
  );

-- Expenses policies (public read for transparency)
CREATE POLICY "Anyone can view approved expenses" ON expenses
  FOR SELECT USING (approved_by IS NOT NULL);

CREATE POLICY "Admins can manage expenses" ON expenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role IN ('admin', 'treasurer'))
  );

-- Audit logs (admin only)
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id::text = auth.uid()::text AND u.role = 'admin')
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Calculate treasury balance
CREATE OR REPLACE FUNCTION get_treasury_balance()
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END), 0) -
         COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.approved_by IS NOT NULL), 0)
  FROM payments p
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get collection rate for a specific week
CREATE OR REPLACE FUNCTION get_week_collection_rate(target_week INTEGER)
RETURNS NUMERIC AS $$
  SELECT ROUND(
    COUNT(CASE WHEN status = 'approved' THEN 1 END)::NUMERIC /
    NULLIF((SELECT COUNT(*) FROM users WHERE role = 'student'), 0) * 100,
    1
  )
  FROM payments WHERE week = target_week
$$ LANGUAGE SQL SECURITY DEFINER;
```

### Prompt: Supabase Client Setup

```
Create Supabase client configuration for Next.js App Router.

1. Create src/lib/supabase/client.ts (for client components):

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

2. Create src/lib/supabase/server.ts (for server components):

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

3. Create src/middleware.ts to protect routes:

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Protect /student/* and /admin/* routes
  // Redirect to /login if no session
  // Redirect student to /student if trying to access /admin
  // Allow /transparency without auth
}

export const config = {
  matcher: ['/(student|admin)/:path*'],
}

4. Create .env.local template:

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_access_token
THUNDER_API_KEY=your_thunder_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## SECTION 3 — Shared Components

### Prompt: Layout Components

```
Build the shared layout components for TreasuryMS.
Design: Minimal/Monochrome — white/gray/black, no bright colors.

1. Create src/components/layout/Sidebar.tsx

Props:
- role: 'student' | 'treasurer' | 'admin'
- currentPath: string

Student nav items:
- Dashboard (/student/dashboard) — icon: LayoutDashboard
- Upload Slip (/student/upload) — icon: Upload, show orange dot if has unpaid week
- History (/student/history) — icon: Clock
- Transparency (/student/transparency) — icon: Eye
- Notifications (/student/notifications) — icon: Bell

Admin nav items:
- Overview (/admin/overview) — icon: LayoutDashboard
- Payments (/admin/payments) — icon: CreditCard, show count badge if pending > 0
- Expenses (/admin/expenses) — icon: Receipt
- Students (/admin/students) — icon: Users
- Reports (/admin/reports) — icon: BarChart3
- Audit Logs (/admin/audit) — icon: Shield (admin only)
- Settings (/admin/settings) — icon: Settings

Design specs:
- Width: 220px, fixed position
- Background: bg-background-secondary (#f8f8f7)
- Border right: 1px solid border-DEFAULT (#e8e8e6)
- Logo area: top, 50px height, brand square (26x26px black) + "Treasury" text
- Nav items: 12.5px, color text-secondary, hover bg-background-tertiary
- Active item: bg-brand text-white (inverted)
- Bottom: user avatar + name + student_id
- Collapsible on mobile (hamburger toggle)

2. Create src/components/layout/Topbar.tsx

Props:
- title: string
- subtitle?: string
- actions?: React.ReactNode

Design specs:
- Height: 50px
- Background: bg-background-secondary
- Border bottom: 1px solid border-DEFAULT
- Left: title (600 weight) + subtitle (muted)
- Right: slot for action buttons
- Ghost button style: border border-border-strong bg-background hover:bg-background-tertiary

3. Create src/components/layout/AppShell.tsx

Wraps sidebar + topbar + content area.
Handles:
- Sidebar open/close state (Zustand)
- Mobile responsive (sidebar drawer on mobile)
- Content area: bg-background, overflow-y-auto

4. Create src/store/uiStore.ts (Zustand):

interface UIStore {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}
```

### Prompt: Shared UI Components

```
Build these reusable components for TreasuryMS. Keep design minimal/monochrome.

1. src/components/shared/KpiCard.tsx

Props:
- label: string
- value: string | number
- sub?: string
- subVariant?: 'neutral' | 'positive' | 'warning' | 'danger'
- trend?: { value: string, direction: 'up' | 'down' | 'neutral' }

Design:
- bg-background-secondary, border border-border-DEFAULT, rounded-[10px]
- Label: 11px uppercase tracking-wide text-muted
- Value: 22px font-700 text-primary tracking-tight
- Sub: 11px, color based on subVariant (muted / green / amber / red)

2. src/components/payments/StatusPill.tsx

Props:
- status: 'paid' | 'pending' | 'rejected' | 'unpaid'

Styles:
- paid: bg-text-primary text-white (inverted black)
- pending: bg-amber-50 text-amber-700 border border-amber-200
- rejected: bg-red-50 text-red-700 border border-red-200
- unpaid: bg-background-muted text-text-secondary border border-border-DEFAULT
- Shape: rounded-full, 10.5px font, 600 weight, px-2.5 py-0.5

3. src/components/payments/WeekGrid.tsx

Props:
- weeks: WeekStatus[]  // array of 12-16 items
- onWeekClick?: (week: WeekStatus) => void
- currentWeek?: number

Design:
- Grid: 6 columns, gap-1.5
- Each cell: border rounded-md p-2.5 text-center cursor-pointer
- paid: bg-text-primary text-white (black filled)
- unpaid: bg-background-secondary border-border-DEFAULT
- pending: bg-amber-50 border-amber-200
- currentWeek: ring-1.5 ring-text-primary (outline ring around current)
- Content: week number (11px bold) + status label (9.5px muted) + amount (10px)
- Hover: scale-[1.02] transition

4. src/components/shared/ActivityFeed.tsx

Props:
- activities: Activity[]

interface Activity {
  id: string
  type: 'approved' | 'rejected' | 'expense' | 'notification' | 'uploaded'
  title: string
  sub: string
  time: string
}

Icon per type:
- approved: CheckCircle (green tint bg)
- rejected: XCircle (red tint bg)
- expense: Receipt (blue tint bg)
- notification: Bell (amber tint bg)
- uploaded: Upload (gray bg)

Design:
- Icon: 28x28px rounded-[7px], 12px icon
- Title: 11.5px font-500
- Sub: 10.5px text-muted
- Time: 10px text-muted (right aligned)
- Divider: subtle bg-background-tertiary 1px

5. src/components/shared/EmptyState.tsx

Props:
- icon: LucideIcon
- title: string
- description?: string
- action?: { label: string, onClick: () => void }

Design: centered, icon 40px text-muted, title 14px 500, desc 12px muted, action as ghost button
```

---

## SECTION 4 — Authentication

### Prompt: LINE Login Flow

```
Implement LINE Login authentication for TreasuryMS.

Create src/app/(auth)/login/page.tsx:

Flow:
1. User clicks "Login with LINE" button
2. Redirect to LINE OAuth: https://access.line.me/oauth2/v2.1/authorize
   with params: response_type=code, client_id, redirect_uri, scope=profile+openid, state (random)
3. LINE redirects back to /api/auth/line/callback?code=xxx
4. Exchange code for access token → get LINE profile (userId, displayName, pictureUrl)
5. Check if line_user_id exists in users table:
   - Exists → set session cookie → redirect to /student/dashboard
   - Not exists → redirect to /bind with line_user_id in session

Design of login page:
- Full screen centered card (max-w-sm)
- Logo + "Treasury Management System" title
- Subtitle: "ระบบจัดการการเงินสาขา"
- LINE login button: bg-[#06C755] text-white, LINE icon, "เข้าสู่ระบบด้วย LINE"
- Bottom: version tag

Create src/app/(auth)/bind/page.tsx:

Flow:
1. Show LINE profile picture + name (from session)
2. Form: Student ID input (text, 8 digits)
3. Submit → POST /api/auth/bind
4. Server sends OTP to LINE (via Messaging API) or email
5. OTP verification modal (6-digit input, 5 min expiry)
6. On success → create user record → redirect to /student/dashboard

Design:
- LINE profile card at top (avatar, name, "กำลังผูกบัญชี")
- Input: student_id (placeholder: "รหัสนักศึกษา 8 หลัก"), validate regex /^\d{8}$/
- Step indicator: 2 steps — Bind → Verify
- Error states: already bound (redirect to dashboard), invalid student ID

Create src/app/api/auth/line/callback/route.ts:
- Exchange LINE code for token
- Fetch LINE profile
- Upsert user in Supabase
- Set session and redirect

Create src/app/api/auth/bind/route.ts:
- Validate student_id format
- Check uniqueness in DB
- Generate 6-digit OTP, store with expiry in Supabase (or Redis)
- Send OTP via LINE Messaging API

LINE OAuth config (src/lib/line.ts):
- generateAuthUrl(): string
- exchangeCode(code: string): Promise<LineProfile>
- sendOTP(lineUserId: string, otp: string): Promise<void>
- sendMessage(lineUserId: string, message: string): Promise<void>
```

---

## SECTION 5 — Student Pages

### Prompt: Student Dashboard

```
Build the Student Dashboard page for TreasuryMS.
File: src/app/(student)/dashboard/page.tsx
Design: Minimal/Monochrome (white/gray/black, no bright accent colors)

This is a Server Component — fetch data server-side.

Layout (AppShell wrapper, sidebar student role):

1. HERO STATUS CARD
   Component: src/components/payments/PaymentHero.tsx
   Data needed: current week number, payment status, amount due
   
   Layout: horizontal flex, divider in middle
   Left side:
   - Label: "Current Period" (uppercase, muted, 11px)
   - Week heading: "Week 12" (22px, bold)  
   - Due date: "Due: 20 May 2568 · Weekly contribution" (12.5px, muted)
   - Status pill (StatusPill component)
   
   Right side:
   - "Amount Due" label (muted)
   - Amount: "฿100" (28px, bold, tight tracking)
   - Upload Slip button (primary black button, only show if status !== 'approved')
   
   States:
   - unpaid: show upload button, pill shows "Not paid yet"
   - pending: show "Awaiting approval", no upload button
   - approved: show green pill "Paid ✓", no button
   - rejected: show red pill "Rejected — please resubmit", show resubmit button

2. WEEK GRID SECTION
   Component: WeekGrid (already built)
   Label: "Payment Overview" + "Sem 1 · 12 weeks" + right: "X paid · Y pending · Z due"
   
   Data: array of all weeks for this semester, each with status
   On click: open sheet with payment detail for that week

3. BOTTOM TWO-COLUMN GRID
   Left: Payment History panel
   - Panel header: "Payment History" + total count + "Export →" link
   - Table rows: Week label | Date | Amount | Status pill
   - Show 5 most recent, "View all" link to /history
   - Empty state if no payments yet
   
   Right: Branch Expenses panel (transparency)
   - Panel header: "Branch Expenses" + month label + "See all →"
   - Expense rows: icon | title + meta (date, approved by) + "View receipt →" | amount
   - Total row at bottom (bg-background-tertiary)
   - Data is read-only, shows all approved expenses

Data fetching (server-side):
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()

// Fetch current user record
const { data: profile } = await supabase
  .from('users')
  .select('*')
  .eq('id', user.id)
  .single()

// Fetch all payments for this user
const { data: payments } = await supabase
  .from('payments')
  .select('*')
  .eq('user_id', user.id)
  .order('week', { ascending: true })

// Fetch recent expenses (public)
const { data: expenses } = await supabase
  .from('expenses')
  .select('*, creator:created_by(fullname)')
  .not('approved_by', 'is', null)
  .order('created_at', { ascending: false })
  .limit(3)

// Calculate week statuses (map weeks 1-12 to payment data)
const TOTAL_WEEKS = 12
const weekStatuses: WeekStatus[] = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
  const week = i + 1
  const payment = payments?.find(p => p.week === week)
  return {
    week,
    status: payment?.status === 'approved' ? 'paid'
          : payment?.status === 'pending' ? 'pending'
          : 'unpaid',
    amount: 100,
    payment,
  }
})
```

### Prompt: Upload Slip Page

```
Build the Upload Slip page for TreasuryMS.
File: src/app/(student)/upload/page.tsx

This page is a multi-step flow. Use React state for step management.
Steps: 1. Select Week → 2. Upload Slip → 3. Auto Verify → 4. Done

Component: src/components/payments/SlipUploader.tsx

STEP 1 — Select Week
- Show only weeks with status 'unpaid' (not yet submitted)
- Grid of week buttons, each shows week number and due amount (฿100)
- If multiple unpaid weeks, user selects which week this payment is for
- If only 1 unpaid week, auto-select and skip to step 2
- If no unpaid weeks → show "All weeks paid 🎉" EmptyState

STEP 2 — Upload Slip  
Design:
- Dashed border dropzone: border-2 border-dashed border-border-strong rounded-xl p-10
- Center: Upload icon (36px, text-muted) + "Click to upload or drag & drop" + "PNG, JPG up to 10MB"
- On file select: show thumbnail preview (object-contain, max 200px height)
- Change file button (ghost, small)
- "Submit Slip" button (primary black, full width)
- Accepted: image/png, image/jpeg, image/webp, max 5MB
- Validate before submit: check file type, size

STEP 3 — Verifying (loading state)
- Show slip thumbnail (smaller, left)
- Right side: animated status list:
  ✓ Uploading image... (done)
  ⟳ Reading slip data... (in progress, spinner)
  ○ Validating amount... (pending)
  ○ Checking reference... (pending)
- Progress steps animate as each completes (2-3 seconds each)
- If Thunder API returns data, show extracted values:
  Amount: ฿100 ✓ matched / ✗ mismatch
  Date: 18 May 2568
  Trans Ref: TH0000XXXXX
  Bank: Kasikorn Bank

STEP 4 — Result
Success:
- Large check icon (40px, in dark circle)
- "Payment submitted successfully"
- Sub: "Week 12 · ฿100 · Awaiting treasurer approval"
- "Back to Dashboard" button + "Upload another" link

Failure:
- X icon (red tint bg)  
- "Verification failed"
- Reason from Thunder API (e.g., "Duplicate transaction reference", "Amount mismatch")
- "Try again" button

API call (POST /api/payments/upload):
- FormData: file (image), week (number), user_id
- Server: upload to Supabase Storage → get public URL → call Thunder API → save payment record
- Return: { success, data: { amount, trans_ref, date, bank }, error? }

Thunder API integration (src/lib/thunder.ts):
const verifySlip = async (imageUrl: string): Promise<ThunderResult> => {
  // POST to Thunder API with image URL
  // Returns: { amount, trans_ref, date, bank, is_valid }
  // Handle: duplicate detection by trans_ref in payments table
}
```

### Prompt: Transparency Page (Public)

```
Build the public Transparency page.
File: src/app/(student)/transparency/page.tsx
Note: This page is accessible WITHOUT login (no auth check)

Purpose: Show students where branch money comes from and goes.

Layout (no sidebar — full page, max-w-2xl centered, py-12 px-4):

HEADER
- Small breadcrumb: "Treasury Management System"
- Title: "Branch Financial Report" (24px, bold)
- Subtitle: "Computer Science Branch — Semester 1 / 2568"
- Last updated: "Updated: 18 May 2568, 14:30" (auto from last approved action)

SUMMARY STATS (3-column grid, same KpiCard component)
- Total Collected: sum of approved payments
- Total Spent: sum of approved expenses
- Balance: collected - spent (highlight if negative with red text)

INCOME SECTION
- Header: "Income by Week" + total
- Table: Week | Collected | Students Paid | Collection Rate %
- Progress bar per row showing collection rate (thin, black fill)
- Footer: Grand total row

EXPENSES SECTION  
- Header: "Expenses" + total + month filter tabs
- Card list (not table):
  Each card: date (small, left) | title (bold) | description (muted, 1 line) | "Receipt →" (link) | amount (right, bold)
  Approved by: small text at bottom "Approved by [name]"
- Empty state if no expenses

FOOTER NOTE
Box with border (dashed, muted):
"ข้อมูลทางการเงินนี้เป็นข้อมูลจริงที่อัปเดตอัตโนมัติ หากมีข้อสงสัยสามารถติดต่อเหรัญญิกได้โดยตรง"

Data fetching (no auth needed, server component):
- Fetch all weeks with approved payments count + total
- Fetch all approved expenses with creator name
- Compute balance
- No RLS bypass needed — expenses policy allows public read of approved expenses
```

---

## SECTION 6 — Admin Pages

### Prompt: Admin Overview Dashboard

```
Build the Admin Overview Dashboard.
File: src/app/(admin)/overview/page.tsx
Design: same Minimal/Monochrome theme, admin sidebar

Server Component. Fetch all stats server-side.

LAYOUT:

1. KPI GRID (4 cards, same KpiCard component)
   - Total Balance: get_treasury_balance() function result
   - Collection Rate: "87%" sub: "43/50 students paid this week"
   - Pending Review: count of payments with status='pending' (amber if > 0)
   - Monthly Expenses: sum of expenses this month

2. MIDDLE SECTION (2 columns, 3fr/2fr ratio)

   LEFT — Pending Payments Table
   Component: src/components/payments/PendingPaymentsTable.tsx
   
   Header: "Pending Payments" + count badge + buttons: [Filter] [Export] [Approve All]
   
   Table columns:
   - Student (avatar initials + fullname, 500 weight)
   - Week (W12 format, muted)
   - Amount (฿100, primary)
   - Submitted (relative time: "2h ago", "Yesterday")
   - Status pill
   - Actions: [✓ Approve] [✕] buttons (only show for pending)
             [View slip] button (for approved/rejected)
   
   Behavior:
   - Click row → open sheet with full slip image + OCR data
   - Approve: PATCH /api/payments/verify { id, action: 'approve' }
   - Reject: PATCH /api/payments/verify { id, action: 'reject', reason }
   - Optimistic update (update UI before server response)
   - Toast notification on success/error

   RIGHT COLUMN (3 stacked panels)
   
   Panel A: Treasury Balance Card
   - Dark background (#f0f0ee in light, #1a1a18 text)
   - "Treasury Balance" + big number
   - Two sub-items: Income (green) + Expense (red)
   
   Panel B: Weekly Collection Chart (sparkline)
   - Last 5 weeks as simple bar chart (CSS only, no library)
   - Each bar: div with height proportional to collection rate
   - Current week: darker fill
   - Week labels below each bar
   
   Panel C: Recent Activity Feed (ActivityFeed component)
   - Last 10 audit log entries, formatted as human-readable

3. BOTTOM — Quick Actions Row
   Three action cards (outline style):
   - "Send Reminder" → opens modal to send LINE notification to unpaid students
   - "Add Expense" → links to /admin/expenses
   - "Export Report" → downloads Excel report

Server data:
const { data: pendingPayments } = await supabase
  .from('payments')
  .select('*, user:user_id(fullname, student_id)')
  .eq('status', 'pending')
  .order('created_at', { ascending: true })

const { data: balance } = await supabase.rpc('get_treasury_balance')

const weeklyData = await Promise.all(
  [8, 9, 10, 11, 12].map(async (week) => ({
    week,
    rate: await supabase.rpc('get_week_collection_rate', { target_week: week }),
  }))
)
```

### Prompt: Admin Payments Page

```
Build the Admin Payments Management page.
File: src/app/(admin)/payments/page.tsx

This is the full payment management interface (not just pending).

FILTER BAR (sticky top)
Filters (all inline, no separate filter panel):
- Week selector: dropdown, "All Weeks" + W1-W16
- Status filter: tabs — All | Pending | Approved | Rejected
- Search: text input, search by student name or student_id
- Date range: two date inputs (from/to)
- Sort: dropdown — Newest | Oldest | Amount High-Low
- Right: Export button + count display "Showing 47 payments"

PAYMENTS TABLE
Columns: Student | Student ID | Week | Amount | Trans Ref | Submitted | Status | Actions

Additional features vs overview table:
- Trans Ref: show full reference (monospace font, text-muted)
- Row click: open payment detail sheet (full width right side sheet)
- Bulk select: checkboxes on rows + "Approve Selected" / "Reject Selected" bulk actions
- Color-coded rows: pending rows have subtle amber left border (border-l-2)
- Pagination: 20 per page, page controls at bottom

PAYMENT DETAIL SHEET (shadcn Sheet, side="right", size 480px)
Content when a payment row is clicked:
- Slip image (full width, rounded, border)
- OCR extracted data:
  Amount: ฿100
  Date: 18 May 2568
  Trans Ref: TH0000XXXXX
  Bank: Kasikorn Bank
  Matched: ✓ / ✗ per field
- Student info: avatar, name, student_id, weeks paid, weeks pending
- Action buttons: [Approve] [Reject with reason]
- Rejection reason: textarea (required when rejecting)
- Audit trail: show previous actions on this payment

API route (src/app/api/payments/verify/route.ts):
PATCH handler:
1. Validate request body: { id, action: 'approve' | 'reject', reason?: string }
2. Check caller has treasurer/admin role (from session)
3. Update payment status + verified_at
4. Write audit_log entry
5. Send LINE notification to student
6. Return updated payment
```

### Prompt: Admin Expenses Page

```
Build the Admin Expense Management page.
File: src/app/(admin)/expenses/page.tsx

MAIN LAYOUT: table (left/main) + add button that opens slide-over panel

HEADER
- Title: "Expenses" + total count
- Summary row: "Total Approved: ฿X,XXX · Pending: ฿X,XXX · This Month: ฿X,XXX"
- Right: [+ Add Expense] button (primary)

FILTER ROW
- Month picker (dropdown)
- Status filter: All | Pending | Approved
- Category filter (if categories exist)

EXPENSES TABLE
Columns: Date | Title | Description | Amount | Created By | Status | Receipt | Actions

- Description: truncated to 1 line (text-ellipsis)
- Amount: right-aligned, bold
- Receipt: "View →" link (opens in new tab, signed URL from Supabase Storage)
- Actions (admin only): [Approve] [Reject] for pending; [Delete] for own unapproved

TOTALS FOOTER ROW
- Fixed at bottom of table: "Total" | | sum of shown rows | | | |
- Background: bg-background-tertiary

ADD EXPENSE SLIDE-OVER (shadcn Sheet, side="right", w-[440px])
Form fields:
- Title: text input (required, max 100 chars)
- Description: textarea (optional, max 500 chars, show char count)
- Amount: number input with ฿ prefix, 2 decimal places
- Category: select — Supplies | Activity | Food | Transportation | Other
- Receipt: file upload (image or PDF, max 10MB)
  → Upload preview for images, filename for PDFs
- Submit: "Add Expense" primary button
- Cancel: "Cancel" ghost button

Form validation (Zod):
const expenseSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  amount: z.number().positive().max(100000),
  category: z.enum(['supplies', 'activity', 'food', 'transport', 'other']),
  receipt: z.instanceof(File).optional(),
})

API (POST /api/expenses):
1. Validate with Zod
2. Upload receipt to Supabase Storage (expenses/receipts/)
3. Insert expense record (status: unapproved until admin approves)
4. Write audit log
5. Return new expense
```

### Prompt: Admin Students Page

```
Build the Student Management page.
File: src/app/(admin)/students/page.tsx

STATS ROW (3 small cards, horizontal)
- Total Students: count
- Fully Paid: count (paid all weeks so far)
- Unpaid: count (at least 1 week unpaid, no pending)

SEARCH + FILTER
- Search by name or student_id
- Filter: All | Fully Paid | Has Pending | Unpaid
- Sort: Name A-Z | Weeks Paid (desc) | Last Payment

STUDENTS TABLE
Columns: Student (avatar + name) | Student ID | Weeks Paid | Weeks Pending | Total Paid | LINE Bound | Actions

- Weeks Paid: "10/12" format
- Total Paid: cumulative approved amount
- LINE Bound: badge — "Bound ✓" or "Not bound" (muted)
- Actions: [View Payments] [Reset LINE Binding] (admin only for reset)

ROW EXPAND on click:
- Inline expand showing week-by-week status
- Small WeekGrid (read-only, no click handler)
- "Send Reminder" button (sends LINE message to this student)

RESET LINE BINDING MODAL:
- Confirmation dialog: "Reset LINE binding for [name]?"
- Warning: "Student will need to re-bind their LINE account"
- Confirm: DELETE /api/students/[id]/binding
- Writes audit log: actor, action: 'reset_line_binding', target: student_id
```

---

## SECTION 7 — API Routes

### Prompt: Slip Upload & Thunder OCR API

```
Build the payment upload and verification API routes.

src/app/api/payments/upload/route.ts (POST):

import { createClient } from '@/lib/supabase/server'
import { verifySlip } from '@/lib/thunder'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // 1. Parse multipart form data
  const formData = await request.formData()
  const file = formData.get('file') as File
  const week = parseInt(formData.get('week') as string)
  
  // 2. Validate
  if (!file || !week) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'File too large' }, { status: 400 })
  
  // 3. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  // 4. Check no duplicate for this week
  const { data: existing } = await supabase
    .from('payments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('week', week)
    .single()
  
  if (existing && existing.status !== 'rejected')
    return NextResponse.json({ error: 'Payment already submitted for this week' }, { status: 409 })
  
  // 5. Upload to Supabase Storage
  const filename = `${user.id}/week-${week}-${Date.now()}.${file.type.split('/')[1]}`
  const bytes = await file.arrayBuffer()
  const { data: upload, error: uploadError } = await supabase.storage
    .from('slips')
    .upload(filename, bytes, { contentType: file.type, upsert: true })
  
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  
  // 6. Get public URL
  const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)
  
  // 7. Call Thunder OCR API
  const ocrResult = await verifySlip(publicUrl)
  
  // 8. Check for duplicate trans_ref
  if (ocrResult.trans_ref) {
    const { data: dupCheck } = await supabase
      .from('payments')
      .select('id')
      .eq('trans_ref', ocrResult.trans_ref)
      .single()
    
    if (dupCheck) return NextResponse.json({
      error: 'Duplicate transaction reference detected',
      code: 'DUPLICATE_TRANS_REF'
    }, { status: 409 })
  }
  
  // 9. Insert or update payment record
  const paymentData = {
    user_id: user.id,
    week,
    amount: ocrResult.amount || 100,
    trans_ref: ocrResult.trans_ref,
    slip_url: publicUrl,
    status: 'pending',
  }
  
  const { data: payment, error: paymentError } = existing
    ? await supabase.from('payments').update(paymentData).eq('id', existing.id).select().single()
    : await supabase.from('payments').insert(paymentData).select().single()
  
  if (paymentError) return NextResponse.json({ error: 'Failed to save payment' }, { status: 500 })
  
  // 10. Write audit log
  await supabase.from('audit_logs').insert({
    actor_id: user.id,
    action: 'payment_uploaded',
    target_id: payment.id,
    new_value: paymentData,
  })
  
  return NextResponse.json({ success: true, payment, ocr: ocrResult })
}

src/lib/thunder.ts:

interface ThunderResult {
  amount: number | null
  trans_ref: string | null
  date: string | null
  bank: string | null
  is_valid: boolean
  confidence: number
  raw: Record<string, unknown>
}

export async function verifySlip(imageUrl: string): Promise<ThunderResult> {
  try {
    const response = await fetch('https://api.thunder.in.th/v1/slip-verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.THUNDER_API_KEY}`,
      },
      body: JSON.stringify({ url: imageUrl }),
    })
    
    if (!response.ok) throw new Error('Thunder API error')
    
    const data = await response.json()
    
    return {
      amount: data.data?.amount ?? null,
      trans_ref: data.data?.transRef ?? null,
      date: data.data?.date ?? null,
      bank: data.data?.bank ?? null,
      is_valid: data.success ?? false,
      confidence: data.data?.confidence ?? 0,
      raw: data,
    }
  } catch {
    return { amount: null, trans_ref: null, date: null, bank: null, is_valid: false, confidence: 0, raw: {} }
  }
}
```

### Prompt: LINE Notification API

```
Build the LINE notification system.

src/lib/line.ts:

const LINE_API = 'https://api.line.me/v2/bot/message'
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
}

export async function sendLineMessage(lineUserId: string, message: string): Promise<boolean> {
  const res = await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: message }]
    })
  })
  return res.ok
}

export async function sendPaymentApproved(lineUserId: string, week: number, amount: number) {
  const msg = `✅ ยืนยันการชำระเงินแล้ว\n\nสัปดาห์ที่ ${week} จำนวน ฿${amount.toLocaleString()}\n\nขอบคุณที่ชำระเงินตรงเวลานะครับ 🙏`
  return sendLineMessage(lineUserId, msg)
}

export async function sendPaymentRejected(lineUserId: string, week: number, reason: string) {
  const msg = `❌ สลิปถูกปฏิเสธ\n\nสัปดาห์ที่ ${week}\nเหตุผล: ${reason}\n\nกรุณาส่งสลิปใหม่ที่ถูกต้องครับ`
  return sendLineMessage(lineUserId, msg)
}

export async function sendPaymentReminder(lineUserId: string, week: number, amount: number) {
  const msg = `⏰ แจ้งเตือนค้างชำระ\n\nยังไม่พบการชำระเงินสัปดาห์ที่ ${week}\nจำนวน ฿${amount.toLocaleString()}\n\nกรุณาชำระและส่งสลิปในระบบด้วยนะครับ`
  return sendLineMessage(lineUserId, msg)
}

export async function sendBulkReminder(students: { lineUserId: string, week: number }[]) {
  // Batch send with delay (LINE rate limit: 1000 req/sec)
  const results = []
  for (const student of students) {
    results.push(await sendPaymentReminder(student.lineUserId, student.week, 100))
    await new Promise(r => setTimeout(r, 50)) // 50ms delay
  }
  return results
}

src/app/api/notify/route.ts (POST):
- Auth check: treasurer/admin only
- Body: { type: 'reminder' | 'custom', week?: number, message?: string, target: 'all_unpaid' | string[] }
- For 'reminder': query unpaid students for the week → send LINE reminders
- For 'custom': send custom message to target student IDs
- Write audit log for each notification sent
- Return: { sent: number, failed: number }
```

---

## SECTION 8 — Security & Audit

### Prompt: Audit Log System

```
Implement the complete audit logging system.

1. Create src/lib/audit.ts helper:

import { createClient } from '@/lib/supabase/server'

type AuditAction =
  | 'payment_uploaded'
  | 'payment_approved'
  | 'payment_rejected'
  | 'expense_created'
  | 'expense_approved'
  | 'expense_deleted'
  | 'notification_sent'
  | 'student_binding_reset'
  | 'user_role_changed'

export async function logAction(params: {
  actorId: string
  action: AuditAction
  targetId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
}) {
  const supabase = await createClient()
  await supabase.from('audit_logs').insert({
    actor_id: params.actorId,
    action: params.action,
    target_id: params.targetId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  })
}

2. Build the Audit Logs page (admin only):
File: src/app/(admin)/audit/page.tsx

FILTER BAR:
- Date range picker (default: last 7 days)
- Action type filter (multi-select dropdown)
- Actor filter (search by name)
- Search by target ID

AUDIT TABLE:
Columns: Time | Actor | Action | Target | Changes | Details

- Time: relative + absolute on hover tooltip
- Actor: avatar initials + name
- Action: colored badge by category
  payment_* → blue
  expense_* → amber
  notification_* → gray
  *_reset / role_changed → red
- Changes: show old_value → new_value as diff (only show changed fields)
  Use: { status: "pending" → "approved" } format
- Details: expand button → JSON viewer (monospace, collapsible)

EXPORT: Download CSV button — exports filtered results

3. Add audit logging to every API route that modifies data.
   Always call logAction() after any successful DB write.
```

---

## SECTION 9 — Reports & Export

### Prompt: Reports Page & Excel Export

```
Build the Reports page and Excel export functionality.
File: src/app/(admin)/reports/page.tsx

REPORT TYPES (tab navigation):
1. Income Report — payments by week/month
2. Expense Report — all expenses with receipts
3. Student Summary — per-student payment status
4. Full Balance Sheet — income vs expense

INCOME REPORT VIEW:
- Weekly collection table: Week | Students Paid | Amount | Collection Rate | Outstanding
- Chart: bar chart (use recharts or CSS bars) showing week-by-week collection
- Semester totals footer

STUDENT SUMMARY VIEW:
- Table: Student Name | ID | W1-W12 (checkmarks) | Total Paid | Outstanding
- Color: green checkmark for paid, dash for unpaid, clock for pending
- Total row at bottom

EXPORT FUNCTIONALITY:
Install: npm install xlsx

Create src/lib/reports.ts:

import * as XLSX from 'xlsx'

export function generateIncomeReport(payments: Payment[]): Uint8Array {
  const wb = XLSX.utils.book_new()
  
  // Sheet 1: Summary by week
  const summaryData = [
    ['Week', 'Students Paid', 'Total Amount', 'Collection Rate'],
    // ... grouped data
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary by Week')
  
  // Sheet 2: All transactions
  const transData = payments.map(p => ({
    'Student Name': p.user?.fullname,
    'Student ID': p.user?.student_id,
    'Week': p.week,
    'Amount': p.amount,
    'Trans Ref': p.trans_ref,
    'Status': p.status,
    'Date': new Date(p.created_at).toLocaleDateString('th-TH'),
  }))
  const ws2 = XLSX.utils.json_to_sheet(transData)
  XLSX.utils.book_append_sheet(wb, ws2, 'All Payments')
  
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

export function generateStudentSummaryReport(students: User[], payments: Payment[]): Uint8Array {
  // Build matrix: students vs weeks
}

API route: GET /api/reports/export?type=income|expenses|students|full
- Auth: treasurer/admin only
- Generate Excel file
- Return as file download with proper headers:
  Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  Content-Disposition: attachment; filename="treasury-report-YYYY-MM-DD.xlsx"
```

---

## SECTION 10 — Final Checklist & Deployment

### Prompt: Production Readiness

```
Perform final production setup for TreasuryMS.

1. ERROR BOUNDARIES
Create src/components/shared/ErrorBoundary.tsx (client component)
Add to each major page section.
Fallback UI: centered card with error icon + "Something went wrong" + "Retry" button

2. LOADING STATES
Create loading.tsx for each page directory:
- Skeleton placeholders matching actual layout
- Use shadcn Skeleton component
- KPI cards: 4 skeleton rectangles in grid
- Table: 5 skeleton rows

3. TOAST NOTIFICATIONS
Configure sonner (shadcn toast) in root layout:
- Success: payment approved, expense added
- Error: upload failed, network error
- Info: reminder sent
- Duration: 4000ms

4. RATE LIMITING
Add to upload route and notify route:
- Max 10 uploads per user per hour
- Max 100 notify calls per admin per hour
- Use Supabase DB counter or Upstash Redis

5. SUPABASE STORAGE BUCKETS
Create in Supabase Dashboard:
- "slips" bucket: public, max file size 5MB, allowed types: image/*
- "receipts" bucket: public, max file size 10MB, allowed types: image/*, application/pdf

Add storage policies:
- slips: users can upload to own folder (user_id/*)
- slips: anyone can read (for OCR URL)
- receipts: treasurers can upload, anyone can read

6. ENVIRONMENT VARIABLES (Vercel)
Add all .env.local variables to Vercel project settings.
Production values:
- NEXT_PUBLIC_APP_URL: https://your-domain.vercel.app
- Supabase: use production project (not dev)

7. DEPLOYMENT CHECKLIST
□ All TypeScript errors resolved (tsc --noEmit)
□ All pages have loading.tsx
□ All forms have proper Zod validation
□ All API routes check authentication
□ Audit logs written for all mutations
□ RLS policies tested with different user roles
□ LINE OAuth redirect URIs updated to production URL
□ Thunder API key is production key
□ Supabase storage buckets have correct policies
□ Test slip upload end-to-end
□ Test LINE notification delivery
□ Test Excel report download
```

---

## APPENDIX — Quick Reference

### Component Props Quick Reference

| Component | Key Props |
|---|---|
| `KpiCard` | label, value, sub, subVariant |
| `StatusPill` | status: paid/pending/rejected/unpaid |
| `WeekGrid` | weeks: WeekStatus[], onWeekClick, currentWeek |
| `ActivityFeed` | activities: Activity[] |
| `SlipUploader` | week, onSuccess, onError |
| `ExpenseForm` | onSubmit, onCancel |
| `PendingPaymentsTable` | payments, onApprove, onReject |
| `AppShell` | role, children |
| `Sidebar` | role, currentPath |

### Key Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |
| `LINE_CHANNEL_ID` | LINE Developers > Channel ID |
| `LINE_CHANNEL_SECRET` | LINE Developers > Channel Secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging API Access Token |
| `THUNDER_API_KEY` | thunder.in.th API key |
| `NEXT_PUBLIC_APP_URL` | App base URL (for LINE OAuth redirect) |

### Roles & Route Access

| Route | student | treasurer | admin |
|---|---|---|---|
| /student/dashboard | ✓ own | — | — |
| /student/upload | ✓ | — | — |
| /student/transparency | ✓ | ✓ | ✓ |
| /admin/overview | — | ✓ | ✓ |
| /admin/payments | — | ✓ | ✓ |
| /admin/expenses | — | ✓ | ✓ |
| /admin/students | — | ✓ | ✓ |
| /admin/reports | — | ✓ | ✓ |
| /admin/audit | — | — | ✓ |
| /api/payments/upload | ✓ own | — | — |
| /api/payments/verify | — | ✓ | ✓ |
| /api/expenses (POST) | — | ✓ | ✓ |
| /api/notify | — | ✓ | ✓ |

---

*เอกสารนี้สร้างขึ้นเพื่อใช้เป็น specification สำหรับสั่ง AI coding assistant*
*เวอร์ชัน 1.0 — TreasuryMS*
