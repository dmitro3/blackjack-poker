'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function BannedPage() {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 24, padding: 32, textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(160deg,#e0556a,#a3142b)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, boxShadow: '0 8px 24px rgba(163,20,43,.4)',
      }}>⛔</div>

      <div>
        <h1 style={{
          fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 36,
          margin: '0 0 12px', letterSpacing: '.04em',
          background: 'linear-gradient(160deg,#e0556a,#a3142b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>Account Suspended</h1>
        <p style={{ color: 'var(--cream-dim)', fontSize: 16, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
          Your account has been suspended by an administrator. If you believe this is a mistake, please contact support.
        </p>
      </div>

      <button className="btn btn-ghost" onClick={handleSignOut} style={{ marginTop: 8 }}>
        Sign Out
      </button>
    </div>
  )
}
