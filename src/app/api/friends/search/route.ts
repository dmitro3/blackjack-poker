import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const admin = createAdminClient()

  // Get existing friend IDs to exclude them
  const { data: friendships } = await admin
    .from('friendships').select('friend_id').eq('user_id', user.id)
  const friendIds = new Set((friendships || []).map((f: { friend_id: string }) => f.friend_id))
  friendIds.add(user.id)

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, invite_code')
    .ilike('display_name', `%${q}%`)
    .limit(10)

  const results = (profiles || [])
    .filter((p: { id: string }) => !friendIds.has(p.id))
    .map((p: { id: string; display_name: string; invite_code: string }) => ({
      id: p.id,
      display_name: p.display_name,
      invite_code: p.invite_code,
    }))

  return NextResponse.json({ results })
}
