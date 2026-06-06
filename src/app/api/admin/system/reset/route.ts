import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

// Helper function to recursively delete all contents of a storage bucket
async function deleteBucketContents(bucketName: string, adminClient: any) {
  const deleteFolder = async (path: string = '') => {
    const { data: items, error } = await adminClient.storage.from(bucketName).list(path)
    if (error) {
      console.error(`Error listing folder "${path}" in bucket "${bucketName}":`, error)
      return
    }
    if (!items || items.length === 0) return

    const filesToDelete: string[] = []
    const subfolders: string[] = []

    for (const item of items) {
      const fullPath = path ? `${path}/${item.name}` : item.name
      // Folders do not have an ID in Supabase storage list output
      if (!item.id) {
        subfolders.push(fullPath)
      } else {
        filesToDelete.push(fullPath)
      }
    }

    // Delete all files in the current folder
    if (filesToDelete.length > 0) {
      const { error: delError } = await adminClient.storage.from(bucketName).remove(filesToDelete)
      if (delError) {
        console.error(`Error deleting files in folder "${path}" from bucket "${bucketName}":`, delError)
      }
    }

    // Recursively list and delete subfolders
    for (const folder of subfolders) {
      await deleteFolder(folder)
    }
  }

  try {
    await deleteFolder()
  } catch (err) {
    console.error(`Failed to delete bucket contents for ${bucketName}:`, err)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('id, role')
    .or(`id.eq.${authUser.id},id.eq.${authUser.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${authUser.user_metadata?.student_id || authUser.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await request.json()

  try {
    if (action === 'clear_payments') {
      // 1. Clear repaid_via reference in payment_credits first to avoid foreign key violations
      await adminClient.from('payment_credits').update({ repaid_via: null, status: 'pending' }).neq('id', '00000000-0000-0000-0000-000000000000')

      // 2. Delete all payments
      const { error: pError } = await adminClient.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (pError) throw pError

      // 3. Clean up storage files recursively in slips bucket
      await deleteBucketContents('slips', adminClient)

      return NextResponse.json({ success: true, message: 'ล้างข้อมูลการชำระเงินและสลิปเรียบร้อยแล้ว' })
    }

    if (action === 'reset_all') {
      // 1. Clear all payment credits (due to repaid_via referencing payments)
      await adminClient.from('payment_credits').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // 2. Delete all payments
      await adminClient.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // 3. Delete all expenses
      await adminClient.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // 4. Delete all general incomes
      await adminClient.from('incomes').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // 5. Delete all notifications
      await adminClient.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // 6. Delete all audit logs
      await adminClient.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      // 7. Reset all student tiers to default 'B' and clear tier_note
      await adminClient.from('users').update({ tier: 'B', tier_note: null }).eq('role', 'student')

      // 8. Delete all semesters (will cascade delete all periods)
      const { error: semDelError } = await adminClient.from('semesters').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (semDelError) throw semDelError

      // 9. Clean up all storage buckets recursively
      await deleteBucketContents('slips', adminClient)
      await deleteBucketContents('receipts', adminClient)
      
      return NextResponse.json({ success: true, message: 'รีเซ็ตระบบและลบไฟล์ทั้งหมดเรียบร้อยแล้ว' })
    }

    if (action === 'clear_students') {
      // 1. Get all student IDs to clear references
      const { data: studentsList } = await adminClient.from('users').select('id').eq('role', 'student')
      
      if (studentsList && studentsList.length > 0) {
        const studentIds = studentsList.map((s: any) => s.id)
        
        // 2. Nullify references in audit_logs first
        await adminClient.from('audit_logs').update({ actor_id: null }).in('actor_id', studentIds)

        // 3. Clear all payment credits for students
        await adminClient.from('payment_credits').delete().in('user_id', studentIds)

        // 4. Delete all payments for students
        await adminClient.from('payments').delete().in('user_id', studentIds)

        // 5. Delete all notifications for students
        await adminClient.from('notifications').delete().in('user_id', studentIds)

        // 6. Delete all students from users table
        const { error: uError } = await adminClient.from('users').delete().in('id', studentIds)
        if (uError) throw uError
      }

      // 7. Delete student users from Supabase Auth (local logins)
      try {
        const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
        for (const authUser of authUsers) {
          if (authUser.email?.endsWith('@treasury.local')) {
            await adminClient.auth.admin.deleteUser(authUser.id)
          }
        }
      } catch (err) {
        console.error('Failed to delete auth users during bulk student clear:', err)
      }

      // 8. Clean up storage files recursively in slips bucket
      await deleteBucketContents('slips', adminClient)

      await logAction({
        actorId: profile.id,
        action: 'students_cleared',
        targetId: '00000000-0000-0000-0000-000000000000',
        newValue: { message: 'All student accounts and their associated transaction data cleared' }
      })

      return NextResponse.json({ success: true, message: 'ลบรายชื่อนักศึกษาและล้างข้อมูลธุรกรรมทั้งหมดเรียบร้อยแล้ว' })
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
        for (const authUser of authUsers) {
          if (authUser.email?.endsWith('@treasury.local')) {
            await adminClient.auth.admin.deleteUser(authUser.id)
          }
        }
      } catch (err) {
        console.error('Failed to delete auth users during bulk reset:', err)
      }

      return NextResponse.json({ success: true, message: 'ล้างข้อมูลการเข้าสู่ระบบของนักศึกษาทุกคนเรียบร้อยแล้ว' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
