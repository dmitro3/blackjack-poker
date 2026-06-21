import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase-server'

async function generateUniquePin(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  for (let i = 0; i < 200; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000))
    const { data } = await admin.from('guest_pins').select('pin').eq('pin', pin).maybeSingle()
    if (!data) return pin
  }
  throw new Error('Could not generate unique PIN')
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all profiles without a PIN
  const { data: profiles } = await admin.from('profiles').select('id, email, display_name, pin').is('pin', null)

  let generated = 0
  const errors: string[] = []

  for (const p of profiles ?? []) {
    try {
      const pin = await generateUniquePin(admin)
      const password = crypto.randomUUID()
      await admin.auth.admin.updateUserById(p.id, { password })
      await admin.from('guest_pins').insert({ pin, user_id: p.id, email: p.email, password, display_name: p.display_name })
      await admin.from('profiles').update({ pin }).eq('id', p.id)
      generated++
    } catch (e) {
      errors.push(`${p.display_name || p.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Also backfill guests: copy their pin from guest_pins into profiles.pin
  const { data: guests } = await admin
    .from('guest_pins')
    .select('user_id, pin')

  let guestsFilled = 0
  for (const g of guests ?? []) {
    const { data: gp } = await admin.from('profiles').select('pin').eq('id', g.user_id).maybeSingle()
    if (gp && !gp.pin) {
      await admin.from('profiles').update({ pin: g.pin }).eq('id', g.user_id)
      guestsFilled++
    }
  }

  return NextResponse.json({ generated, guestsFilled, errors })
}
