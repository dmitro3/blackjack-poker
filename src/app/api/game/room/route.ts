import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabaseUser = await createServerSupabaseClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { code, game, status, guestName } = body
  const admin = createAdminClient()

  try {
    if (status === 'waiting') {
      const { data: profile } = await admin
        .from('profiles').select('display_name').eq('id', user.id).single()
      await admin.from('game_rooms').upsert({
        code,
        game: game || 'poker',
        host_id: user.id,
        host_name: profile?.display_name || 'Host',
        guest_name: null,
        status: 'waiting',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'code' })
    } else if (status === 'active') {
      await admin.from('game_rooms').update({
        guest_name: guestName || 'Guest',
        status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('code', code).eq('host_id', user.id)
    } else if (status === 'ended') {
      await admin.from('game_rooms').update({
        status: 'ended',
        updated_at: new Date().toISOString(),
      }).eq('code', code).eq('host_id', user.id)
    }
  } catch {
    // Table may not exist yet — spectate via channel still works
  }

  return NextResponse.json({ ok: true })
}
