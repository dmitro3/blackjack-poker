import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

const ADMIN_EMAIL = 'vedantbhatia8@gmail.com'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [flagsRes, profileRes] = await Promise.all([
    admin.from('feature_flags').select('key, display_name, status').order('created_at'),
    admin.from('profiles').select('beta_access, is_admin, email').eq('id', user.id).single(),
  ])

  const isAdmin = profileRes.data?.is_admin || user.email === ADMIN_EMAIL
  const hasBetaAccess = isAdmin || profileRes.data?.beta_access === true

  const featureMap: Record<string, 'beta' | 'public'> = {}
  for (const f of flagsRes.data || []) {
    featureMap[f.key] = f.status
  }

  return NextResponse.json({
    flags: flagsRes.data || [],
    featureMap,
    hasBetaAccess,
  })
}
