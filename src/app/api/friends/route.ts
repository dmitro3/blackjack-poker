import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

function genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get (or generate) friend code for current user
  const { data: me } = await admin.from('profiles').select('invite_code').eq('id', user.id).single()
  let myCode = me?.invite_code
  if (!myCode) {
    myCode = genCode()
    await admin.from('profiles').update({ invite_code: myCode }).eq('id', user.id)
  }

  // Get friend IDs
  const { data: friendships } = await admin
    .from('friendships').select('friend_id').eq('user_id', user.id)
  const friendIds = (friendships || []).map((f: { friend_id: string }) => f.friend_id)

  let friends: object[] = []
  if (friendIds.length > 0) {
    const [profilesRes, roomsRes] = await Promise.all([
      admin.from('profiles').select('id, display_name, last_login').in('id', friendIds),
      admin.from('game_rooms')
        .select('code, game, host_id')
        .in('host_id', friendIds)
        .neq('status', 'ended')
        .gt('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()),
    ])

    const roomByHost = Object.fromEntries(
      (roomsRes.data || []).map((r: { host_id: string; code: string; game: string }) => [r.host_id, r])
    )

    friends = (profilesRes.data || []).map((p: { id: string; display_name: string; last_login: string | null }) => ({
      id: p.id,
      display_name: p.display_name,
      last_login: p.last_login,
      activeGame: roomByHost[p.id]
        ? { code: roomByHost[p.id].code, game: roomByHost[p.id].game }
        : null,
    }))
  }

  return NextResponse.json({ friends, myCode })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { friendCode } = await req.json()
  if (!friendCode) return NextResponse.json({ error: 'Friend code required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: friend } = await admin
    .from('profiles').select('id, display_name')
    .eq('invite_code', (friendCode as string).trim().toUpperCase())
    .maybeSingle()

  if (!friend) return NextResponse.json({ error: 'Friend code not found — double-check it and try again.' }, { status: 404 })
  if (friend.id === user.id) return NextResponse.json({ error: "That's your own code!" }, { status: 400 })

  const { data: existing } = await admin
    .from('friendships').select('id')
    .eq('user_id', user.id).eq('friend_id', friend.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Already friends!' }, { status: 400 })

  await admin.from('friendships').insert([
    { user_id: user.id, friend_id: friend.id },
    { user_id: friend.id, friend_id: user.id },
  ])

  return NextResponse.json({ name: friend.display_name || 'Friend' })
}
