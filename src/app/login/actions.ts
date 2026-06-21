'use server'

import { createAdminClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function signInWithPin(pin: string): Promise<{ access_token?: string; refresh_token?: string; error?: string }> {
  if (!pin || typeof pin !== 'string') return { error: 'PIN required' }

  const admin = createAdminClient()

  const { data: guest, error: lookupError } = await admin
    .from('guest_pins')
    .select('email, password')
    .eq('pin', pin.trim())
    .single()

  if (lookupError || !guest) return { error: 'Invalid PIN' }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: guest.email,
    password: guest.password,
  })

  if (signInError || !data.session) return { error: 'Sign-in failed' }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }
}
