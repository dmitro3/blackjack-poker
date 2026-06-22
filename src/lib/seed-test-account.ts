import { createAdminClient } from './supabase-server'

export const TEST_ACCOUNT_EMAIL = 'test.pin2@housetables.com'
const TEST_PIN = '2'

export async function seedTestAccount() {
  try {
    const admin = createAdminClient()

    // Skip if already exists
    const { data: existing } = await admin
      .from('guest_pins')
      .select('pin')
      .eq('pin', TEST_PIN)
      .single()
    if (existing) return

    const password = crypto.randomUUID()

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: TEST_ACCOUNT_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Test' },
    })
    if (authErr || !authData?.user) return

    const userId = authData.user.id

    await admin.from('profiles').insert({
      id: userId,
      email: TEST_ACCOUNT_EMAIL,
      display_name: 'Test',
      chips: 100000,
      is_admin: false,
      invite_code: 'TSTPIN2',
      pin: TEST_PIN,
      last_login: new Date().toISOString(),
    })

    await admin.from('guest_pins').insert({
      pin: TEST_PIN,
      user_id: userId,
      email: TEST_ACCOUNT_EMAIL,
      password,
      display_name: 'Test',
    })
  } catch {}
}
