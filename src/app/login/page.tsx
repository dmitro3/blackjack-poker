'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pinMode, setPinMode] = useState(false)
  const [pin, setPin] = useState('')
  const [pinValid, setPinValid] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const errorParam = searchParams.get('error')
  const router = useRouter()

  useEffect(() => {
    if (errorParam) setError('Sign-in failed. Please try again.')
  }, [errorParam])

  async function signInWithGoogle() {
    setLoading(true)
    const supabase = createClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const callbackUrl = `${siteUrl}/auth/callback${inviteCode ? `?invite=${inviteCode}` : ''}`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: inviteCode ? { invite: inviteCode } : undefined,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  function handlePinChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
    setError('')
    if (digits.length === 4) {
      // Validate PIN client-safely: just reveal the name fields; server validates actual PIN
      setPinValid(true)
    } else {
      setPinValid(false)
    }
  }

  async function signInWithPin() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/pin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, firstName, lastName }),
      })
      let data: { email?: string; password?: string; error?: string } = {}
      try { data = await res.json() } catch { /* non-JSON response */ }
      if (!res.ok) {
        setError(data.error || 'Invalid PIN or name.')
        setLoading(false)
        return
      }
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email!,
        password: data.password!,
      })
      if (signInError) {
        setError('Sign-in failed. Please try again.')
        setLoading(false)
        return
      }
      router.push('/')
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 10,
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(217,182,90,.25)',
    color: 'var(--cream)',
    fontSize: 15,
    fontFamily: 'var(--fs-body)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Ambient decoration */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {['#d9b65a','#b3122a','#137a4a','#d9b65a','#b3122a'].map((color, i) => (
          <div key={i} style={{
            position:'absolute',
            width: (80 + i*40) + 'px',
            height: (80 + i*40) + 'px',
            borderRadius:'50%',
            color,
            border: '6px dashed currentColor',
            opacity:.06,
            left: (15 + i*18) + '%',
            top: (10 + i*15) + '%',
          }} />
        ))}
      </div>

      <div className="gilt" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '48px 40px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
        animation: 'floatUp .4s',
      }}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,marginBottom:32}}>
          <div style={{
            width:52,height:52,borderRadius:'50%',
            background:'var(--gold-grad)',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#2a1f08',fontFamily:'var(--fs-display)',fontWeight:900,fontSize:26,
            boxShadow:'inset 0 1px 0 rgba(255,255,255,.6), inset 0 -3px 6px var(--gold-deep), 0 4px 12px rgba(0,0,0,.5)',
          }}>H</div>
          <div>
            <div className="gold-text" style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:22,letterSpacing:'.14em'}}>
              HOUSETABLES
            </div>
            <div style={{fontFamily:'var(--fs-head)',fontSize:9,letterSpacing:'.42em',color:'var(--cream-faint)',marginTop:2}}>
              PRIVATE CARD ROOM
            </div>
          </div>
        </div>

        <hr className="hr-gold" style={{marginBottom:32}} />

        {inviteCode && (
          <div style={{
            padding:'12px 18px',
            borderRadius:10,
            background:'rgba(217,182,90,.1)',
            border:'1px solid rgba(217,182,90,.3)',
            marginBottom:24,
            fontSize:13,
            color:'var(--gold-l)',
            fontFamily:'var(--fs-head)',
            letterSpacing:'.04em',
          }}>
            You&apos;ve been invited! Sign in to claim your 5,000 bonus chips.
          </div>
        )}

        <h1 style={{
          fontFamily:'var(--fs-display)',
          fontWeight:900,
          fontSize:28,
          marginBottom:10,
          letterSpacing:'.06em',
        }}>
          <span className="gold-text">Take a Seat</span>
        </h1>
        <p style={{
          color:'var(--cream-dim)',
          fontSize:15,
          lineHeight:1.6,
          marginBottom:32,
        }}>
          {pinMode
            ? 'Enter your access PIN to continue.'
            : 'Members-only table. Sign in with Google to access the card room.'}
        </p>

        {error && (
          <div style={{
            padding:'10px 16px',
            borderRadius:10,
            background:'rgba(163,20,43,.2)',
            border:'1px solid rgba(163,20,43,.4)',
            color:'#e7708a',
            fontSize:13,
            marginBottom:20,
          }}>
            {error}
          </div>
        )}

        {!pinMode ? (
          <>
            <button
              className="btn"
              onClick={signInWithGoogle}
              disabled={loading}
              style={{width:'100%',fontSize:15,padding:'16px 30px',display:'flex',alignItems:'center',justifyContent:'center',gap:12}}
            >
              {loading ? (
                <span style={{
                  width:16,height:16,border:'2px solid rgba(42,31,8,.4)',borderTopColor:'#2a1f08',
                  borderRadius:'50%',animation:'spin360 .8s linear infinite',display:'inline-block'
                }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#2a1f08"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#2a1f08"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#2a1f08"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#2a1f08"/>
                </svg>
              )}
              {loading ? 'Signing in…' : 'Sign in with Google'}
            </button>

            <button
              onClick={() => { setPinMode(true); setError('') }}
              style={{
                marginTop:16,
                background:'none',
                border:'none',
                color:'var(--cream-faint)',
                fontSize:12,
                letterSpacing:'.06em',
                cursor:'pointer',
                fontFamily:'var(--fs-head)',
                textDecoration:'underline',
                textUnderlineOffset:3,
                padding:0,
              }}
            >
              Have an access PIN?
            </button>
          </>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <input
                type="password"
                inputMode="numeric"
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={e => handlePinChange(e.target.value)}
                maxLength={4}
                style={{...inputStyle, textAlign:'center', letterSpacing:'0.5em', fontSize:22}}
                autoFocus
              />
            </div>

            {pinValid && (
              <>
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  style={inputStyle}
                  autoComplete="given-name"
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  style={inputStyle}
                  autoComplete="family-name"
                  onKeyDown={e => { if (e.key === 'Enter') signInWithPin() }}
                />
              </>
            )}

            <button
              className="btn"
              onClick={signInWithPin}
              disabled={loading || !pinValid || !firstName.trim() || !lastName.trim()}
              style={{width:'100%',fontSize:15,padding:'16px 30px',display:'flex',alignItems:'center',justifyContent:'center',gap:12}}
            >
              {loading ? (
                <span style={{
                  width:16,height:16,border:'2px solid rgba(42,31,8,.4)',borderTopColor:'#2a1f08',
                  borderRadius:'50%',animation:'spin360 .8s linear infinite',display:'inline-block'
                }} />
              ) : 'Enter the Room'}
            </button>

            <button
              onClick={() => { setPinMode(false); setPin(''); setPinValid(false); setFirstName(''); setLastName(''); setError('') }}
              style={{
                background:'none',
                border:'none',
                color:'var(--cream-faint)',
                fontSize:12,
                letterSpacing:'.06em',
                cursor:'pointer',
                fontFamily:'var(--fs-head)',
                textDecoration:'underline',
                textUnderlineOffset:3,
                padding:0,
              }}
            >
              ← Back to Google sign-in
            </button>
          </div>
        )}

        <p style={{
          marginTop:24,
          color:'var(--cream-faint)',
          fontSize:12,
          letterSpacing:'.04em',
          lineHeight:1.6,
        }}>
          Play responsibly — these chips hold no cash value.
        </p>
      </div>

      <style>{`
        @keyframes spin360 { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>Loading…</div>
    </div>}>
      <LoginContent />
    </Suspense>
  )
}
