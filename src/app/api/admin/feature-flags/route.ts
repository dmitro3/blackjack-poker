import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? admin : null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await admin.from('feature_flags').select('*').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Normalize: support both `name` and `display_name` column
  const flags = (data || []).map((f: Record<string, unknown>) => ({ ...f, display_name: f.display_name ?? f.name }))
  return NextResponse.json({ flags })
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { key, status } = await req.json().catch(() => ({}))
  if (!key || !['beta', 'public'].includes(status)) {
    return NextResponse.json({ error: 'key and status (beta|public) required' }, { status: 400 })
  }
  const { error } = await admin.from('feature_flags')
    .update({ status, updated_at: new Date().toISOString() }).eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, key, status })
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const key = url.searchParams.get('key') || (await req.json().catch(() => ({}))).key
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
  await admin.from('feature_flags').delete().eq('key', key)
  return NextResponse.json({ ok: true })
}
