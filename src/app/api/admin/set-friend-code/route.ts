import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

const DIRECTOR_EMAIL = 'vedantbhatia8@gmail.com'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== DIRECTOR_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, code } = await req.json()
  if (!email || !code) return NextResponse.json({ error: 'email and code required' }, { status: 400 })

  const admin = createAdminClient()

  // Check code isn't taken by someone else
  const { data: existing } = await admin.from('profiles').select('id').eq('invite_code', code.toUpperCase()).maybeSingle()
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: 'Code already taken' }, { status: 409 })
  }

  const { data: target } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await admin.from('profiles').update({ invite_code: code.toUpperCase() }).eq('id', target.id)

  return NextResponse.json({ ok: true, code: code.toUpperCase() })
}
