import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logGameSession, adjustBalance, setBalance, getBalance } from '@/lib/bank'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { game, chips_wagered, chips_won } = body

  if (chips_wagered === undefined || chips_won === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Special case for refill
  if (game === 'refill') {
    const current = await getBalance(user.id)
    const newChips = Math.min(100000, current + chips_won)
    const actual_won = newChips - current
    if (actual_won > 0) {
      await setBalance(user.id, newChips)
    }
    return NextResponse.json({ chips: newChips })
  }

  // Adjust balance: net = chips_won - chips_wagered
  const net = chips_won - chips_wagered
  const newBalance = await adjustBalance(user.id, net)

  // Log session
  await logGameSession(user.id, game, chips_wagered, chips_won)

  return NextResponse.json({ chips: newBalance, net })
}
