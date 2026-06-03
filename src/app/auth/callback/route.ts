import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-server'

function makeCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const inviteCode = requestUrl.searchParams.get('invite') || requestUrl.searchParams.get('state_invite')
  const next = requestUrl.searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(new URL('/login', requestUrl.origin))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    return NextResponse.redirect(new URL('/login?error=auth', requestUrl.origin))
  }

  const admin = createAdminClient()

  // Check if profile exists
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, invite_code')
    .eq('id', user.id)
    .single()

  const isFirstLogin = !existingProfile

  if (isFirstLogin) {
    // Check if this is the first user or the admin email
    const { count } = await admin
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const isAdmin = (count === 0) || user.email === 'vedantbhatia8@gmail.com'

    // Generate unique invite code
    let newInviteCode = makeCode()
    let codeUnique = false
    while (!codeUnique) {
      const { data: existing } = await admin
        .from('profiles')
        .select('id')
        .eq('invite_code', newInviteCode)
        .single()
      if (!existing) codeUnique = true
      else newInviteCode = makeCode()
    }

    // Create profile
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Player',
      chips: 100000,
      is_admin: isAdmin,
      invite_code: newInviteCode,
      last_login: new Date().toISOString(),
    })

    // Handle invite reward
    if (inviteCode) {
      const { data: inviter } = await admin
        .from('profiles')
        .select('id')
        .eq('invite_code', inviteCode)
        .single()

      if (inviter && inviter.id !== user.id) {
        // Update invitee's profile with inviter reference and bonus
        await admin
          .from('profiles')
          .update({
            invited_by: inviter.id,
            chips: 105000, // 100k base + 5k bonus
          })
          .eq('id', user.id)

        // Grant inviter 5k bonus
        const { data: inviterProfile } = await admin
          .from('profiles')
          .select('chips')
          .eq('id', inviter.id)
          .single()

        if (inviterProfile) {
          await admin
            .from('profiles')
            .update({ chips: inviterProfile.chips + 5000 })
            .eq('id', inviter.id)
        }

        // Record reward
        await admin.from('invite_rewards').insert({
          inviter_id: inviter.id,
          invitee_id: user.id,
          reward_chips: 5000,
        })
      }
    }
  } else {
    // Update last login
    await admin
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)
  }

  // Build redirect URL with invite bonus indicator
  const redirectUrl = new URL(next === '/' ? '/' : next, requestUrl.origin)
  if (isFirstLogin && inviteCode) {
    redirectUrl.searchParams.set('bonus', 'invite')
  }

  return NextResponse.redirect(redirectUrl)
}
