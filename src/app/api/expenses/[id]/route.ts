import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('id, role')
    .or(`id.eq.${user.id},student_id.eq.${user.user_metadata?.student_id || 'NONE'}`)
    .maybeSingle()
  
  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get data before deletion for logging
  const { data: expense } = await adminClient.from('expenses').select('*').eq('id', id).maybeSingle()
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  const { error } = await adminClient.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete receipt from storage if it exists
  if (expense.receipt_url) {
    try {
      const getStoragePathFromUrl = (url: string, bucketName: string = 'receipts'): string | null => {
        const marker = `/storage/v1/object/public/${bucketName}/`
        const idx = url.indexOf(marker)
        if (idx === -1) return null
        return decodeURIComponent(url.substring(idx + marker.length))
      }
      const storagePath = getStoragePathFromUrl(expense.receipt_url, 'receipts')
      if (storagePath) {
        const { error: deleteError } = await adminClient.storage.from('receipts').remove([storagePath])
        if (deleteError) {
          console.error('Failed to delete expense receipt from storage:', deleteError)
        }
      }
    } catch (e) {
      console.error('Error deleting expense receipt from storage:', e)
    }
  }

  await logAction({
    actorId: profile.id,
    action: 'expense_deleted',
    targetId: id,
    oldValue: expense
  })

  return NextResponse.json({ success: true })
}
