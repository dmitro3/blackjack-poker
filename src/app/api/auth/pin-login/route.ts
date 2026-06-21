import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

const VALID_PIN = '1111'

function makeCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { pin, firstName, lastName } = body

    if (pin !== VALID_PIN) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const id = crypto.randomUUID()
    const password = crypto.randomUUID()
    const email = `guest_${id}@housetables.guest`
    const displayName = `${firstName.trim()} ${lastName.trim()}`

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    })

    if (authError || !authData?.user) {
      console.error('[pin-login] createUser error:', authError)
      return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 })
    }

    const userId = authData.user.id

    // Generate unique invite code
    let inviteCode = makeCode()
    let unique = false
    while (!unique) {
      const { data: existing } = await admin.from('profiles').select('id').eq('invite_code', inviteCode).single()
      if (!existing) unique = true
      else inviteCode = makeCode()
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: userId,
      email,
      display_name: displayName,
      chips: 100000,
      is_admin: false,
      invite_code: inviteCode,
      last_login: new Date().toISOString(),
    })

    if (profileError) {
      console.error('[pin-login] profile insert error:', profileError)
      // Still return credentials — user can play, profile may partially exist
    }

    return NextResponse.json({ email, password })
  } catch (err) {
    console.error('[pin-login] unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
