import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function GET() {
  const supabase = await createClient()
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, creator:created_by(fullname), approver:approved_by(fullname)')
    .order('created_at', { ascending: false })
  return NextResponse.json({ expenses: expenses ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await createAdminClient().from('users').select('id, role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!['admin', 'treasurer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const amount = parseFloat(formData.get('amount') as string)
  const category = formData.get('category') as string
  const receipt = formData.get('receipt') as File | null

  if (!title || !amount || isNaN(amount))
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  let receipt_url: string | null = null

  if (receipt && receipt.size > 0) {
    const ext = receipt.type === 'application/pdf' ? 'pdf' : receipt.type.split('/')[1]
    const filename = `receipts/${user.id}-${Date.now()}.${ext}`
    const bytes = await receipt.arrayBuffer()
    const adminClient = createAdminClient()
    const { error: uploadErr } = await adminClient.storage
      .from('receipts').upload(filename, bytes, { contentType: receipt.type, upsert: true })
    if (!uploadErr) {
      const { data: { publicUrl } } = adminClient.storage.from('receipts').getPublicUrl(filename)
      receipt_url = publicUrl
    } else {
      console.error('[Expense Receipt Upload Error]:', uploadErr)
    }
  }

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({ title, description: description || null, amount, category: category || 'other', created_by: profile?.id, receipt_url })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })

  await logAction({ actorId: profile?.id || user.id, action: 'expense_created', targetId: expense.id, newValue: { title, amount, category } })

  return NextResponse.json({ expense }, { status: 201 })
}
