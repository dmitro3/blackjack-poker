'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

interface Profile {
  id: string
  email: string
  display_name: string
  chips: number
  total_wagered: number
  total_won: number
  is_admin: boolean
  is_banned: boolean
  last_login: string
  created_at: string
}

interface GameStat { game: string; count: number; total_wagered: number; total_won: number }

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  const bg = kind === 'win' ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)' : kind === 'lose' ? 'linear-gradient(160deg,#6a1325,#440b18)' : 'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{ position: 'fixed', left: '50%', bottom: 38, transform: 'translateX(-50%)', zIndex: 9999, padding: '13px 26px', borderRadius: 999, fontFamily: 'Cinzel,serif', fontWeight: 600, letterSpacing: '.05em', boxShadow: '0 14px 40px rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.5)', background: bg, color: kind === 'win' ? '#2a1f08' : 'var(--cream)', animation: 'floatUp .35s' }}>{msg}</div>
}

export default function AdminPage() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [gameStats, setGameStats] = useState<GameStat[]>([])
  const [refillEnabled, setRefillEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null)
  const [grantTarget, setGrantTarget] = useState('')
  const [grantAmount, setGrantAmount] = useState('')
  const [activeTab, setActiveTab] = useState<'players' | 'stats' | 'settings'>('players')
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(30)
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const showToast = useCallback((msg: string, kind = '') => setToast({ msg, kind }), [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const res = await fetch('/api/admin/players')
    if (res.status === 401) { router.push('/login'); return }
    if (!res.ok) { setRefreshing(false); return }

    const data = await res.json()
    setPlayers(data.players)
    setRefillEnabled(data.refillEnabled)

    const map: Record<string, GameStat> = {}
    for (const s of data.sessions) {
      if (!map[s.game]) map[s.game] = { game: s.game, count: 0, total_wagered: 0, total_won: 0 }
      map[s.game].count++
      map[s.game].total_wagered += s.chips_wagered
      map[s.game].total_won += s.chips_won
    }
    setGameStats(Object.values(map).sort((a, b) => b.count - a.count))

    setLoading(false)
    setRefreshing(false)
    setLastRefreshed(new Date())
    setCountdown(30)
  }, [router])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(true), 30000)
    countdownRef.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1000)
    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(countdownRef.current!)
    }
  }, [load])

  async function handleBan(userId: string, banned: boolean) {
    const res = await fetch('/api/admin/ban-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, banned }),
    })
    if (res.ok) {
      setPlayers(ps => ps.map(p => p.id === userId ? { ...p, is_banned: banned } : p))
      showToast(banned ? 'Player suspended' : 'Player reinstated', banned ? 'lose' : 'win')
    }
  }

  async function handleGrantChips() {
    const amount = parseInt(grantAmount, 10)
    if (!grantTarget || isNaN(amount)) { showToast('Select a player and enter an amount'); return }
    const res = await fetch('/api/admin/grant-chips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: grantTarget, amount }),
    })
    if (res.ok) {
      const data = await res.json()
      setPlayers(ps => ps.map(p => p.id === grantTarget ? { ...p, chips: data.chips } : p))
      showToast(`Granted ${fmt(amount)} chips`, 'win')
      setGrantAmount('')
    }
  }

  async function handleToggleRefill() {
    const newVal = !refillEnabled
    const res = await fetch('/api/admin/toggle-refill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newVal }),
    })
    if (res.ok) {
      setRefillEnabled(newVal)
      showToast(`Refill button ${newVal ? 'enabled' : 'disabled'}`, newVal ? 'win' : '')
    }
  }

  const totalWagered = players.reduce((s, p) => s + (p.total_wagered || 0), 0)
  const totalWon = players.reduce((s, p) => s + (p.total_won || 0), 0)
  const houseProfit = totalWagered - totalWon

  const panelStyle = {
    border: '1px solid rgba(217,182,90,.35)',
    borderRadius: 'var(--radius)',
    background: 'linear-gradient(180deg, rgba(36,31,21,.85), rgba(11,10,7,.92))',
    boxShadow: '0 18px 50px rgba(0,0,0,.55)',
    padding: 28,
  }

  const tabStyle = (active: boolean) => ({
    fontFamily: 'var(--fs-head)', fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase' as const,
    padding: '10px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
    background: active ? 'var(--gold-grad)' : 'transparent',
    color: active ? '#2a1f08' : 'var(--cream-dim)',
    fontWeight: 700,
    transition: '.2s',
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em', fontSize: 18 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      {/* Topbar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '18px 28px',
        background: 'linear-gradient(180deg, rgba(11,10,7,.95), rgba(11,10,7,.6))',
        backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(217,182,90,.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--cream-dim)', fontFamily: 'var(--fs-head)', fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(217,182,90,.25)' }}>
            ← Lobby
          </Link>
          <div>
            <div className="gold-text" style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 20, letterSpacing: '.14em' }}>ADMIN DASHBOARD</div>
            <div style={{ fontFamily: 'var(--fs-head)', fontSize: 9, letterSpacing: '.4em', color: 'var(--cream-faint)' }}>HOUSETABLES · RESTRICTED</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['players', 'stats', 'settings'] as const).map(tab => (
            <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              {tab === 'players' ? 'Players' : tab === 'stats' ? 'House Stats' : 'Settings'}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Total Players', value: players.length, color: 'var(--gold-l)' },
            { label: 'Total Wagered', value: fmt(totalWagered), color: 'var(--gold-l)' },
            { label: 'Players Won', value: fmt(totalWon), color: '#5fd99a' },
            { label: 'House Profit', value: (houseProfit >= 0 ? '+' : '-') + fmt(Math.abs(houseProfit)), color: houseProfit >= 0 ? '#5fd99a' : '#e7708a' },
          ].map(s => (
            <div key={s.label} style={{ ...panelStyle, padding: 20 }}>
              <div style={{ color: 'var(--cream-faint)', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 28, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Players tab */}
        {activeTab === 'players' && (
          <div style={panelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: 0, letterSpacing: '.03em' }}>
                <span className="gold-text">All Players</span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {lastRefreshed && (
                  <span style={{ fontSize: 12, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.05em' }}>
                    Refreshes in {countdown}s
                  </span>
                )}
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => load(true)}
                  disabled={refreshing}
                  style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                >
                  <span style={{
                    display: 'inline-block', width: 11, height: 11,
                    border: '1.5px solid currentColor', borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: refreshing ? 'spin360 .7s linear infinite' : 'none',
                  }} />
                  Refresh
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(217,182,90,.2)' }}>
                    {['Player', 'Chips', 'Wagered', 'Won', 'Last Login', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(217,182,90,.08)', opacity: p.is_banned ? .5 : 1 }}>
                      <td style={{ padding: '14px', fontSize: 14 }}>
                        <div style={{ fontWeight: 700, color: 'var(--cream)' }}>{p.display_name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: 2 }}>{p.email}</div>
                        {p.is_admin && <span style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--gold)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase' }}>Admin</span>}
                      </td>
                      <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: 'var(--gold-l)', fontWeight: 700 }}>{fmt(p.chips || 0)}</td>
                      <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: 'var(--cream-dim)' }}>{fmt(p.total_wagered || 0)}</td>
                      <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: '#5fd99a' }}>{fmt(p.total_won || 0)}</td>
                      <td style={{ padding: '14px', fontSize: 12, color: 'var(--cream-faint)' }}>
                        {p.last_login ? new Date(p.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                          padding: '4px 10px', borderRadius: 999, fontFamily: 'var(--fs-head)',
                          background: p.is_banned ? 'rgba(163,20,43,.25)' : 'rgba(58,208,122,.15)',
                          color: p.is_banned ? '#e7708a' : '#5fd99a',
                          border: `1px solid ${p.is_banned ? 'rgba(231,112,138,.3)' : 'rgba(95,217,154,.3)'}`,
                        }}>
                          {p.is_banned ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        {!p.is_admin && (
                          <button
                            className={`btn btn-sm ${p.is_banned ? '' : 'btn-danger'}`}
                            style={{ fontSize: 11, padding: '7px 14px' }}
                            onClick={() => handleBan(p.id, !p.is_banned)}
                          >
                            {p.is_banned ? 'Reinstate' : 'Suspend'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats tab */}
        {activeTab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={panelStyle}>
              <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: '0 0 20px' }}>
                <span className="gold-text">Game Breakdown</span>
              </h2>
              {gameStats.length === 0 ? (
                <p style={{ color: 'var(--cream-faint)', fontSize: 14 }}>No game sessions recorded yet.</p>
              ) : gameStats.map(g => {
                const profit = g.total_wagered - g.total_won
                return (
                  <div key={g.game} style={{ padding: '16px 0', borderBottom: '1px solid rgba(217,182,90,.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 16, textTransform: 'capitalize' }}>{g.game}</span>
                      <span style={{ fontSize: 12, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>{fmt(g.count)} rounds</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                      {[
                        { l: 'Wagered', v: fmt(g.total_wagered), c: 'var(--cream-dim)' },
                        { l: 'Won by Players', v: fmt(g.total_won), c: '#5fd99a' },
                        { l: 'House Edge', v: (profit >= 0 ? '+' : '') + fmt(profit), c: profit >= 0 ? '#5fd99a' : '#e7708a' },
                      ].map(s => (
                        <div key={s.l} style={{ background: 'rgba(0,0,0,.3)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 4 }}>{s.l}</div>
                          <div style={{ fontWeight: 700, color: s.c, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={panelStyle}>
              <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: '0 0 20px' }}>
                <span className="gold-text">Grant Chips</span>
              </h2>
              <p style={{ color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.55, margin: '0 0 20px' }}>
                Grant or deduct chips from any player. Use negative amounts to deduct.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select
                  value={grantTarget}
                  onChange={e => setGrantTarget(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.3)',
                    borderRadius: 10, padding: '0 16px', color: 'var(--gold-l)',
                    fontFamily: 'Manrope', fontSize: 14, height: 48, width: '100%',
                  }}
                >
                  <option value="">Select player…</option>
                  {players.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name || p.email} — {fmt(p.chips)} chips</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Amount (e.g. 50000 or -10000)"
                  value={grantAmount}
                  onChange={e => setGrantAmount(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.3)',
                    borderRadius: 10, padding: '0 16px', color: 'var(--gold-l)',
                    fontFamily: 'Manrope', fontSize: 14, height: 48, width: '100%',
                  }}
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  {[10000, 50000, 100000].map(amt => (
                    <button
                      key={amt}
                      className="btn btn-sm btn-ghost"
                      onClick={() => setGrantAmount(String(amt))}
                    >{fmt(amt)}</button>
                  ))}
                </div>
                <button className="btn" onClick={handleGrantChips} style={{ marginTop: 4 }}>
                  Grant Chips
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div style={{ ...panelStyle, maxWidth: 540 }}>
            <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: '0 0 20px' }}>
              <span className="gold-text">Site Settings</span>
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid rgba(217,182,90,.12)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Refill Button</div>
                <div style={{ color: 'var(--cream-faint)', fontSize: 13, lineHeight: 1.5 }}>
                  Controls whether players can top up to 100,000 chips from the lobby.
                </div>
              </div>
              <button
                onClick={handleToggleRefill}
                style={{
                  width: 56, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: refillEnabled ? 'var(--gold-grad)' : 'rgba(217,182,90,.15)',
                  position: 'relative', transition: '.3s', flexShrink: 0, marginLeft: 20,
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: refillEnabled ? 28 : 3,
                  width: 24, height: 24, borderRadius: '50%',
                  background: refillEnabled ? '#2a1f08' : 'rgba(217,182,90,.4)',
                  transition: '.3s',
                }} />
              </button>
            </div>

            <div style={{ marginTop: 20, padding: '16px', borderRadius: 10, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(217,182,90,.15)' }}>
              <div style={{ fontSize: 12, color: 'var(--cream-faint)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--cream-dim)' }}>Refill status:</strong>{' '}
                <span style={{ color: refillEnabled ? '#5fd99a' : '#e7708a' }}>
                  {refillEnabled ? 'Enabled — players can top up' : 'Disabled — top-up button hidden'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
