import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

const ADMIN_EMAIL = 'vedantbhatia8@gmail.com'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const profileRes = await admin.from('profiles').select('is_admin, email').eq('id', user.id).single()
  const isAdmin = profileRes.data?.is_admin || user.email === ADMIN_EMAIL

  let betaAccess = false
  try {
    const { data } = await admin.from('profiles').select('beta_access').eq('id', user.id).single()
    betaAccess = data?.beta_access === true
  } catch {}

  const hasBetaAccess = isAdmin || betaAccess

  let flags: { key: string; name: string; display_name: string; status: string }[] = []
  const featureMap: Record<string, 'beta' | 'public'> = {}
  try {
    const { data } = await admin.from('feature_flags').select('key, name, status').order('created_at')
    if (data) {
      flags = data.map((f: Record<string, unknown>) => ({ ...f, display_name: f.name } as { key: string; name: string; display_name: string; status: string }))
      for (const f of data) featureMap[f.key as string] = f.status as 'beta' | 'public'
    }
  } catch {}

  return NextResponse.json({ flags, featureMap, hasBetaAccess }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
