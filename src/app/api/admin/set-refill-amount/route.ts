import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabaseUser = await createServerSupabaseClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { amount } = await req.json()
  if (typeof amount !== 'number' || amount < 1000 || amount > 10000000) {
    return NextResponse.json({ error: 'Amount must be between 1,000 and 10,000,000' }, { status: 400 })
  }

  const { error } = await admin
    .from('admin_settings')
    .upsert({ key: 'refill_amount', value: String(Math.round(amount)), updated_at: new Date().toISOString() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, amount })
}
