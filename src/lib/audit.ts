import type { SupabaseClient } from '@supabase/supabase-js'

type AuditAction =
  | 'payment_uploaded'
  | 'payment_approved'
  | 'payment_rejected'
  | 'expense_created'
  | 'expense_approved'
  | 'expense_deleted'
  | 'income_created'
  | 'income_approved'
  | 'income_deleted'
  | 'notification_sent'
  | 'broadcast_sent'
  | 'student_binding_reset'
  | 'user_role_changed'
  | 'system_reset'
  | 'clear_payments'
  | 'tier_changed'
  | 'credit_created'
  | 'credit_repaid'
  | 'credit_forgiven'
  | 'semester_created'
  | 'semester_activated'
  | 'semester_deleted'
  | 'period_created'
  | 'periods_batch_updated'
  | 'students_cleared'

interface LogParams {
  actorId: string
  action: AuditAction
  targetId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
}

export async function logAction(supabase: SupabaseClient, params: LogParams): Promise<void>
export async function logAction(params: LogParams): Promise<void>
export async function logAction(
  supabaseOrParams: SupabaseClient | LogParams,
  params?: LogParams
): Promise<void> {
  if (params !== undefined) {
    // Called as logAction(supabase, params)
    await _logAction(supabaseOrParams as SupabaseClient, params)
  } else {
    // Called as logAction(params) — legacy, creates own client
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    await _logAction(supabase, supabaseOrParams as LogParams)
  }
}

async function _logAction(
  supabase: SupabaseClient,
  params: LogParams
) {
  await supabase.from('audit_logs').insert({
    actor_id: params.actorId,
    action: params.action,
    target_id: params.targetId ?? null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  })
}
