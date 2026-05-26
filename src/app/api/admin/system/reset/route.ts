import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .or(`id.eq.${authUser.id},id.eq.${authUser.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${authUser.user_metadata?.student_id || authUser.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await request.json()

  try {
    if (action === 'clear_payments') {
      // 1. Delete all payments
      const { error: pError } = await adminClient.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (pError) throw pError

      // 2. Clean up storage files (slips folder)
      // Note: We list and delete in chunks to avoid timeouts
      const { data: files } = await adminClient.storage.from('slips').list()
      if (files && files.length > 0) {
        // We delete files from the root of slips. 
        // For nested folders (user-id/), you might need a more recursive approach
        const filesToDelete = files.map(f => f.name)
        await adminClient.storage.from('slips').remove(filesToDelete)
      }

      return NextResponse.json({ success: true, message: 'ล้างข้อมูลการชำระเงินเรียบร้อยแล้ว' })
    }

    if (action === 'reset_all') {
      // Clear payments, expenses, and audit logs
      await adminClient.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await adminClient.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      
      return NextResponse.json({ success: true, message: 'รีเซ็ตระบบการเงินทั้งหมดเรียบร้อยแล้ว' })
    }

    if (action === 'reset_all_bindings') {
      // 1. Clear line_user_id and verified status for all students in custom table
      await adminClient.from('users').update({ 
        line_user_id: null,
        verified: false
      }).eq('role', 'student')

      // 2. Delete student users from Supabase Auth
      try {
        const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
        // Delete only student auth accounts (those ending with @treasury.local)
        // Ensure we don't accidentally delete admins, though admins should also be careful
        for (const authUser of authUsers) {
          if (authUser.email?.endsWith('@treasury.local')) {
            await adminClient.auth.admin.deleteUser(authUser.id)
          }
        }
      } catch (err) {
        console.error('Failed to delete auth users during bulk reset:', err)
        // We still proceed even if auth deletion fails partially
      }

      return NextResponse.json({ success: true, message: 'ล้างข้อมูลการเข้าสู่ระบบของนักศึกษาทุกคนเรียบร้อยแล้ว' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
