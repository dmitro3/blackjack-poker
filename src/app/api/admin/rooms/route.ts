import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  const supabaseUser = await createServerSupabaseClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const { data: rooms } = await admin
      .from('game_rooms')
      .select('*')
      .in('status', ['waiting', 'active', 'solo'])
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: false })
    return NextResponse.json({ rooms: rooms || [] })
  } catch {
    return NextResponse.json({ rooms: [] })
  }
}
