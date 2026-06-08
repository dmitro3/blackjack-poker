import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabaseUser = await createServerSupabaseClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { code } = body
  const now = new Date().toISOString()
  const admin = createAdminClient()

  await admin.from('profiles').update({ last_login: now }).eq('id', user.id)

  if (code) {
    try { await admin.from('game_rooms').update({ updated_at: now }).eq('code', code) } catch { /* optional */ }
  }

  return NextResponse.json({ ok: true })
}
