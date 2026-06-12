export interface User {
  id: string
  student_id: string
  fullname: string
  email: string | null
  line_user_id: string | null
  role: 'student' | 'treasurer' | 'admin'
  tier: 'A' | 'B' | 'C'
  tier_note: string | null
  verified: boolean
  created_at: string
}

export interface Semester {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  periods?: Period[]
}

export interface Period {
  id: string
  semester_id: string
  label: string
  period_order: number
  amount: number
  base_amount: number
  late_fine_amount: number
  // Flexible fine system
  fine_type: 'flat' | 'daily' | 'per_period'
  fine_rate: number
  fine_cap: number | null
  fine_grace_days: number
  activity_type: 'small' | 'medium' | 'large' | null
  activity_extra_amount: number
  is_separate_collection: boolean
  qr_url: string | null
  open_at: string | null
  close_at: string | null
  deadline: string
  created_at: string
  semester?: Semester
}

// WeekSetting interface removed — replaced by Period-based system

export interface PaymentCredit {
  id: string
  user_id: string
  period_id: string | null
  amount: number
  status: 'pending' | 'repaid' | 'forgiven'
  repaid_at: string | null
  repaid_via: string | null
  note: string | null
  created_by: string | null
  created_at: string
  user?: User
  period?: Period | null
  period_info?: Pick<Period, 'label' | 'deadline'> | null
}

export interface Payment {
  id: string
  user_id: string
  period_id: string | null
  amount: number
  trans_ref: string | null
  slip_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  verified_at: string | null
  created_at: string
  note?: string | null
  user?: User
  period?: Pick<Period, 'label' | 'period_order'> | null
}

export interface Expense {
  id: string
  title: string
  description: string | null
  amount: number
  created_by: string
  approved_by: string | null
  receipt_url: string | null
  created_at: string
  creator?: User
  approver?: User
}

export interface Income {
  id: string
  title: string
  description: string | null
  amount: number
  created_by: string
  approved_by: string | null
  source: string | null
  created_at: string
  creator?: User
  approver?: User
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  target_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
  actor?: User
}

export interface PeriodStatus {
  period: Period
  status: 'paid' | 'pending' | 'unpaid' | 'rejected'
  /** ยอดที่ปรับตาม tier + ค่าปรับ (tier-adjusted amount) */
  amount: number
  payment?: Payment
}

export interface DashboardStats {
  totalBalance: number
  totalIncome: number
  totalExpense: number
  collectionRate: number
  paidCount: number
  totalStudents: number
  pendingCount: number
  creditDebtTotal?: number
  tierBreakdown?: { A: number; B: number; C: number }
  activeSemester?: Semester
  currentPeriod?: Period
}

export type TierType = 'A' | 'B' | 'C'

export interface TierConfig {
  amount?: number
  label: string
  description: string
  color: string
  bg: string
  border: string
}

