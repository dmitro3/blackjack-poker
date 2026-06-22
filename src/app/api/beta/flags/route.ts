import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

const ADMIN_EMAIL = 'vedantbhatia8@gmail.com'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Get profile — beta_access column may not exist yet, handle gracefully
  const profileRes = await admin.from('profiles').select('is_admin, email').eq('id', user.id).single()
  const isAdmin = profileRes.data?.is_admin || user.email === ADMIN_EMAIL

  // Try to get beta_access separately in case the column exists
  let betaAccess = false
  try {
    const { data } = await admin.from('profiles').select('beta_access').eq('id', user.id).single()
    betaAccess = data?.beta_access === true
  } catch {}

  const hasBetaAccess = isAdmin || betaAccess

  // Get feature flags — table may not exist yet
  let flags: { key: string; display_name: string; status: string }[] = []
  const featureMap: Record<string, 'beta' | 'public'> = {}
  try {
    const { data } = await admin.from('feature_flags').select('key, display_name, status').order('created_at')
    if (data) {
      flags = data
      for (const f of data) featureMap[f.key] = f.status as 'beta' | 'public'
    }
  } catch {}

  return NextResponse.json({ flags, featureMap, hasBetaAccess })
}
