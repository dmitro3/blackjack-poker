import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { adjustBalance, getBalance } from '@/lib/bank'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event_id, option_id, option_label, chips_wagered } = await request.json()

  if (!event_id || !option_id || !option_label || !chips_wagered) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (chips_wagered < 500) {
    return NextResponse.json({ error: 'Minimum bet is 500 chips' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: event } = await admin
    .from('sports_events')
    .select('id, status, closes_at, options')
    .eq('id', event_id)
    .single()

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (event.status !== 'open') return NextResponse.json({ error: 'Betting is closed for this event' }, { status: 400 })
  if (event.closes_at && new Date(event.closes_at) < new Date()) {
    return NextResponse.json({ error: 'Betting has closed for this event' }, { status: 400 })
  }

  const validOption = (event.options as { id: string }[]).find(o => o.id === option_id)
  if (!validOption) return NextResponse.json({ error: 'Invalid option' }, { status: 400 })

  const balance = await getBalance(user.id)
  if (balance < chips_wagered) return NextResponse.json({ error: 'Insufficient chips' }, { status: 400 })

  const { data: existing } = await admin
    .from('sports_bets')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_id', event_id)
    .single()

  if (existing) return NextResponse.json({ error: 'You already have a bet on this event' }, { status: 400 })

  const newBalance = await adjustBalance(user.id, -chips_wagered)

  const { data: bet, error: betError } = await admin
    .from('sports_bets')
    .insert({ user_id: user.id, event_id, option_id, option_label, chips_wagered })
    .select('id')
    .single()

  if (betError) {
    await adjustBalance(user.id, chips_wagered) // refund on failure
    return NextResponse.json({ error: 'Failed to place bet' }, { status: 500 })
  }

  return NextResponse.json({ chips: newBalance, bet_id: bet.id })
}
