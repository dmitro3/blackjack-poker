import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { pin } = await req.json().catch(() => ({}))

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Look up PIN in guest_pins table
    const { data: guest, error: lookupError } = await admin
      .from('guest_pins')
      .select('email, password')
      .eq('pin', pin.trim())
      .single()

    if (lookupError || !guest) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    }

    // Sign in as this guest using stored credentials
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: guest.email,
      password: guest.password,
    })

    if (signInError || !signInData.session) {
      console.error('[pin-login] signIn error:', signInError)
      return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 })
    }

    return NextResponse.json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    })
  } catch (err) {
    console.error('[pin-login] unexpected error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
