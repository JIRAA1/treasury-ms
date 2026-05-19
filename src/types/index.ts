export interface User {
  id: string
  student_id: string
  fullname: string
  email: string | null
  line_user_id: string | null
  line_picture_url: string | null
  role: 'student' | 'treasurer' | 'admin'
  verified: boolean
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  week: number
  amount: number
  trans_ref: string | null
  slip_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  verified_at: string | null
  created_at: string
  note?: string | null
  user?: User
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

export interface WeekStatus {
  week: number
  status: 'paid' | 'pending' | 'unpaid' | 'rejected'
  amount: number
  payment?: Payment
  deadline?: string | null
  title?: string | null
}

export interface DashboardStats {
  totalBalance: number
  totalIncome: number
  totalExpense: number
  collectionRate: number
  paidCount: number
  totalStudents: number
  pendingCount: number
}
