import { createClient } from '@/lib/supabase/server'

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
