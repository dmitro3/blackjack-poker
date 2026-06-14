import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { adjustBalance, logGameSession } from '@/lib/bank'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [eventsRes, betsRes] = await Promise.all([
    admin.from('sports_events').select('*').order('created_at', { ascending: false }),
    admin.from('sports_bets')
      .select('user_id, event_id, chips_wagered, chips_won, won, settled, option_id')
      .order('created_at', { ascending: false }),
  ])

  // Get player names for all bettors
  const userIds = [...new Set((betsRes.data || []).map(b => b.user_id))]
  let playerMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, display_name').in('id', userIds)
    for (const p of profiles || []) playerMap[p.id] = p.display_name
  }

  // Build event title map
  const eventMap: Record<string, { title: string; sport: string }> = {}
  for (const e of eventsRes.data || []) eventMap[e.id] = { title: e.title, sport: e.sport }

  const bets = (betsRes.data || []).map(b => ({
    ...b,
    display_name: playerMap[b.user_id] || 'Unknown',
    event_title: eventMap[b.event_id]?.title || 'Unknown Event',
    sport: eventMap[b.event_id]?.sport || 'unknown',
  }))

  if (eventsRes.error) return NextResponse.json({ error: eventsRes.error.message }, { status: 500 })
  return NextResponse.json({ events: eventsRes.data || [], bets })
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { sport, title, description, options, closes_at, event_date } = body

  if (!sport || !title || !options || options.length < 2) {
    return NextResponse.json({ error: 'sport, title, and at least 2 options required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sports_events')
    .insert({ sport, title, description, options, closes_at: closes_at || null, event_date: event_date || null, status: 'open' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data })
}

export async function PATCH(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { event_id, action, result_option_id } = body

  if (!event_id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = createAdminClient()

  if (action === 'close') {
    const { error } = await admin.from('sports_events').update({ status: 'closed' }).eq('id', event_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel') {
    const { data: bets } = await admin.from('sports_bets').select('user_id, chips_wagered').eq('event_id', event_id).eq('settled', false)
    if (bets) {
      for (const bet of bets) {
        await adjustBalance(bet.user_id, bet.chips_wagered)
      }
      await admin.from('sports_bets').update({ settled: true, won: false }).eq('event_id', event_id).eq('settled', false)
    }
    await admin.from('sports_events').update({ status: 'cancelled' }).eq('id', event_id)
    return NextResponse.json({ ok: true, refunded: bets?.length || 0 })
  }

  if (action === 'settle') {
    if (!result_option_id) return NextResponse.json({ error: 'result_option_id required' }, { status: 400 })

    const { data: bets } = await admin
      .from('sports_bets')
      .select('id, user_id, option_id, chips_wagered')
      .eq('event_id', event_id)
      .eq('settled', false)

    if (bets) {
      for (const bet of bets) {
        const won = bet.option_id === result_option_id
        const chips_won = won ? bet.chips_wagered * 2 : 0
        if (won) await adjustBalance(bet.user_id, chips_won)
        await logGameSession(bet.user_id, 'sports', bet.chips_wagered, chips_won)
        await admin.from('sports_bets').update({ settled: true, won, chips_won }).eq('id', bet.id)
      }
    }

    await admin.from('sports_events').update({ status: 'settled', result_option_id }).eq('id', event_id)
    return NextResponse.json({ ok: true, settled: bets?.length || 0 })
  }

  if (action === 'reopen') {
    await admin.from('sports_events').update({ status: 'open', result_option_id: null }).eq('id', event_id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const event_id = searchParams.get('id')
  if (!event_id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('sports_bets').delete().eq('event_id', event_id)
  const { error } = await admin.from('sports_events').delete().eq('id', event_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
