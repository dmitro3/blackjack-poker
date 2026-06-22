'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FeatureFlag {
  key: string
  display_name: string
  status: 'beta' | 'public'
}

const CSS_REDESIGNS = [
  { key: 'ui_v2', version: '2', label: 'Eclipse', description: 'Deep violet & indigo theme' },
  { key: 'ui_v3', version: '3', label: 'Jade', description: 'Rich emerald & teal theme' },
]

const LOBBY_REDESIGNS: Record<string, { label: string; description: string }> = {
  'vibrant-lobby': { label: 'Vibrant Lobby', description: 'Full lobby redesign — hero cards, quick play grid, sports banner' },
}

export default function BetaPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [hasBetaAccess, setHasBetaAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeVersion, setActiveVersion] = useState<string | null>(null)
  const [activeLobby, setActiveLobby] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const vMatch = document.cookie.match(/ui_version=(\d)/)
    if (vMatch) setActiveVersion(vMatch[1])
    const lMatch = document.cookie.match(/beta_ui=([^;]+)/)
    if (lMatch) setActiveLobby(decodeURIComponent(lMatch[1]))
  }, [])

  useEffect(() => {
    fetch('/api/beta/flags')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.hasBetaAccess) { router.push('/'); return }
        setHasBetaAccess(true)
        setFlags(d.flags.filter((f: FeatureFlag) => f.status === 'beta'))
        setLoading(false)
      })
      .catch(() => router.push('/'))
  }, [router])

  function setRedesign(version: string | null) {
    if (version) {
      document.cookie = `ui_version=${version}; path=/; max-age=${60 * 60 * 24 * 365}`
    } else {
      document.cookie = 'ui_version=; path=/; max-age=0'
    }
    setActiveVersion(version)
    window.location.reload()
  }

  function toggleLobbyDesign(key: string) {
    if (activeLobby === key) {
      document.cookie = 'beta_ui=; path=/; max-age=0'
      setActiveLobby(null)
    } else {
      document.cookie = `beta_ui=${encodeURIComponent(key)}; path=/; max-age=${60 * 60 * 24 * 365}`
      setActiveLobby(key)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>Loading…</div>
    </div>
  )

  const lobbyRedesignFlags = flags.filter(f => f.key in LOBBY_REDESIGNS)
  const betaFeatures = flags.filter(f => !f.key.startsWith('ui_v') && !(f.key in LOBBY_REDESIGNS))

  return (
    <div style={{ minHeight: '100vh', padding: '40px 28px 80px', maxWidth: 780, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
          ← Back to lobby
        </Link>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.4em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 10 }}>
          Beta Access
        </div>
        <h1 style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 36, margin: '0 0 10px' }}>
          <span className="gold-text">Early Features</span>
        </h1>
        <p style={{ color: 'var(--cream-dim)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          You have beta access. These features are in testing — things may change.
        </p>
      </div>

      {/* Lobby redesigns (cookie: beta_ui) */}
      {lobbyRedesignFlags.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.2em', color: 'var(--cream-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
            Lobby Redesigns
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lobbyRedesignFlags.map(f => {
              const meta = LOBBY_REDESIGNS[f.key]
              const isActive = activeLobby === f.key
              return (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', borderRadius: 12,
                  background: isActive ? 'rgba(217,182,90,.08)' : 'rgba(0,0,0,.3)',
                  border: isActive ? '1px solid rgba(217,182,90,.35)' : '1px solid rgba(217,182,90,.12)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--cream)', marginBottom: 2 }}>{meta.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--cream-faint)' }}>{meta.description}</div>
                  </div>
                  {isActive ? (
                    <button className="btn btn-sm btn-ghost" onClick={() => toggleLobbyDesign(f.key)} style={{ fontSize: 12 }}>
                      Active — turn off
                    </button>
                  ) : (
                    <button className="btn btn-sm" onClick={() => toggleLobbyDesign(f.key)} style={{ fontSize: 12 }}>Enable</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* UI Themes (cookie: ui_version — CSS class swap) */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.2em', color: 'var(--cream-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
          Colour Themes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderRadius: 12,
            background: !activeVersion ? 'rgba(217,182,90,.08)' : 'rgba(0,0,0,.3)',
            border: !activeVersion ? '1px solid rgba(217,182,90,.35)' : '1px solid rgba(217,182,90,.12)',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--cream)', marginBottom: 2 }}>Classic</div>
              <div style={{ fontSize: 13, color: 'var(--cream-faint)' }}>Gold & dark felt — the default</div>
            </div>
            {!activeVersion ? (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(217,182,90,.15)', border: '1px solid rgba(217,182,90,.35)', color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.08em' }}>Active</span>
            ) : (
              <button className="btn btn-sm btn-ghost" onClick={() => setRedesign(null)} style={{ fontSize: 12 }}>Use this</button>
            )}
          </div>

          {CSS_REDESIGNS.map(r => {
            const isActive = activeVersion === r.version
            return (
              <div key={r.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderRadius: 12,
                background: isActive ? 'rgba(217,182,90,.08)' : 'rgba(0,0,0,.3)',
                border: isActive ? '1px solid rgba(217,182,90,.35)' : '1px solid rgba(217,182,90,.12)',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--cream)', marginBottom: 2 }}>{r.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--cream-faint)' }}>{r.description}</div>
                </div>
                {isActive ? (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(217,182,90,.15)', border: '1px solid rgba(217,182,90,.35)', color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.08em' }}>Active</span>
                ) : (
                  <button className="btn btn-sm btn-ghost" onClick={() => setRedesign(r.version)} style={{ fontSize: 12 }}>Use this</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Other beta features */}
      {betaFeatures.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.2em', color: 'var(--cream-faint)', textTransform: 'uppercase', marginBottom: 16 }}>
            Beta Features
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {betaFeatures.map(f => (
              <div key={f.key} style={{
                padding: '14px 20px', borderRadius: 12,
                background: 'rgba(0,0,0,.3)', border: '1px solid rgba(217,182,90,.12)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5fd99a', flexShrink: 0, boxShadow: '0 0 6px #5fd99a' }} />
                <span style={{ fontSize: 14, color: 'var(--cream)', fontWeight: 600 }}>{f.display_name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(95,217,154,.1)', border: '1px solid rgba(95,217,154,.25)', color: '#5fd99a', fontFamily: 'var(--fs-head)', letterSpacing: '.06em' }}>Live</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {flags.length === 0 && (
        <div style={{ color: 'var(--cream-faint)', fontSize: 14, fontFamily: 'var(--fs-head)', letterSpacing: '.06em' }}>
          No beta features active right now — check back soon.
        </div>
      )}
    </div>
  )
}
