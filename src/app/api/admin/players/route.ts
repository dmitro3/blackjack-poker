import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'
import { TEST_ACCOUNT_EMAIL } from '@/lib/seed-test-account'

export async function GET() {
  const supabaseUser = await createServerSupabaseClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [playersRes, sessionsRes, refillEnabledRes, refillAmountRes] = await Promise.all([
    admin.from('profiles').select('*').neq('email', TEST_ACCOUNT_EMAIL).order('created_at', { ascending: false }),
    admin.from('game_sessions').select('user_id, game, chips_wagered, chips_won, created_at').order('created_at', { ascending: false }),
    admin.from('admin_settings').select('value').eq('key', 'refill_enabled').single(),
    admin.from('admin_settings').select('value').eq('key', 'refill_amount').single(),
  ])

  const players = playersRes.data || []
  const visibleIds = new Set(players.map((p: Record<string, string>) => p.id))
  const sessions = (sessionsRes.data || []).filter((s: Record<string, string>) => visibleIds.has(s.user_id))

  return NextResponse.json({
    players,
    sessions,
    refillEnabled: refillEnabledRes.data?.value === 'true',
    refillAmount: parseInt(refillAmountRes.data?.value || '100000', 10),
  })
}
