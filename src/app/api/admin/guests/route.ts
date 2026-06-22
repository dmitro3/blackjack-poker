import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

function makeCode(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]
  return s
}

async function requireAdmin() {
  const supabaseUser = await createServerSupabaseClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return null
  return admin
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin
    .from('guest_pins')
    .select('pin, display_name, created_at, user_id')
    .neq('pin', '2')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ guests: data || [] })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { display_name, pin, chips } = await req.json().catch(() => ({}))

  if (!display_name?.trim() || !pin?.trim()) {
    return NextResponse.json({ error: 'Name and PIN required' }, { status: 400 })
  }

  // Check PIN is not already taken
  const { data: existing } = await admin.from('guest_pins').select('pin').eq('pin', pin.trim()).single()
  if (existing) return NextResponse.json({ error: 'PIN already in use' }, { status: 409 })

  const id = crypto.randomUUID()
  const password = crypto.randomUUID()
  const email = `guest.${id}@housetables.com`
  const startingChips = typeof chips === 'number' && chips > 0 ? chips : 100000

  // Create Supabase auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: display_name.trim() },
  })

  if (authError || !authData?.user) {
    console.error('[create-guest] createUser error:', authError)
    return NextResponse.json({ error: authError?.message || 'Failed to create account' }, { status: 500 })
  }

  const userId = authData.user.id

  // Generate unique invite code
  let inviteCode = makeCode()
  let unique = false
  while (!unique) {
    const { data: taken } = await admin.from('profiles').select('id').eq('invite_code', inviteCode).single()
    if (!taken) unique = true
    else inviteCode = makeCode()
  }

  // Create profile
  await admin.from('profiles').insert({
    id: userId,
    email,
    display_name: display_name.trim(),
    chips: startingChips,
    is_admin: false,
    invite_code: inviteCode,
    pin: pin.trim(),
    last_login: new Date().toISOString(),
  })

  // Store PIN credentials
  const { error: pinError } = await admin.from('guest_pins').insert({
    pin: pin.trim(),
    user_id: userId,
    email,
    password,
    display_name: display_name.trim(),
  })

  if (pinError) {
    console.error('[create-guest] pin insert error:', pinError)
    return NextResponse.json({ error: pinError.message }, { status: 500 })
  }

  return NextResponse.json({ guest: { pin: pin.trim(), display_name: display_name.trim(), user_id: userId, created_at: new Date().toISOString() } })
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pin } = await req.json().catch(() => ({}))
  if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 })

  const { data: guest } = await admin.from('guest_pins').select('user_id').eq('pin', pin).single()
  if (!guest) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.from('guest_pins').delete().eq('pin', pin)
  // Optionally delete the auth user too
  await admin.auth.admin.deleteUser(guest.user_id)

  return NextResponse.json({ ok: true })
}
