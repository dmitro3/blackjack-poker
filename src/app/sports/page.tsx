'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SPORT_META: Record<string, { emoji: string; color: string; label: string }> = {
  nba:     { emoji: '🏀', color: '#f37321', label: 'NBA' },
  nfl:     { emoji: '🏈', color: '#4a90d9', label: 'NFL' },
  soccer:  { emoji: '⚽', color: '#4caf50', label: 'Soccer' },
  mlb:     { emoji: '⚾', color: '#cc4444', label: 'MLB' },
  pga:     { emoji: '⛳', color: '#2d8a1f', label: 'PGA' },
  tennis:  { emoji: '🎾', color: '#b8d432', label: 'Tennis' },
  ufc:     { emoji: '🥊', color: '#c0392b', label: 'UFC' },
  nhl:     { emoji: '🏒', color: '#00a0e4', label: 'NHL' },
  esports: { emoji: '🎮', color: '#9b59b6', label: 'Esports' },
  other:   { emoji: '🏆', color: '#d9b65a', label: 'Other' },
}
function sportMeta(k: string) {
  return SPORT_META[k.toLowerCase()] ?? { emoji: '🏆', color: '#d9b65a', label: k.toUpperCase() }
}

interface SportOption { id: string; label: string }
interface SportsEvent {
  id: string; sport: string; title: string; description: string | null
  options: SportOption[]; closes_at: string | null; event_date: string | null
  result_option_id: string | null; status: 'open' | 'closed' | 'settled' | 'cancelled'
  created_at: string
}
interface SportsBet {
  id: string; event_id: string; option_id: string; option_label: string
  chips_wagered: number; chips_won: number | null; settled: boolean; won?: boolean | null
  created_at: string
  event?: Pick<SportsEvent, 'id' | 'sport' | 'title' | 'options' | 'result_option_id' | 'status' | 'event_date'>
}

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

function nextSyncLabel(): string {
  const d = new Date()
  const day = d.getDay()
  if (day === 1) return 'today'
  const daysUntil = day === 0 ? 1 : 8 - day
  const next = new Date(d)
  next.setDate(d.getDate() + daysUntil)
  return 'Monday ' + next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeLeft(closeAt: string | null): string {
  if (!closeAt) return ''
  const diff = new Date(closeAt).getTime() - Date.now()
  if (diff <= 0) return 'Started'
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  const bg = kind === 'win' ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)'
    : kind === 'lose' ? 'linear-gradient(160deg,#6a1325,#440b18)' : 'linear-gradient(180deg,#241f15,#0b0a07)'
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 38, transform: 'translateX(-50%)', zIndex: 9999,
      padding: '13px 26px', borderRadius: 999, fontFamily: 'Cinzel,serif', fontWeight: 600,
      letterSpacing: '.05em', pointerEvents: 'none', boxShadow: '0 14px 40px rgba(0,0,0,.5)',
      border: '1px solid rgba(217,182,90,.5)', background: bg,
      color: kind === 'win' ? '#2a1f08' : 'var(--cream)', animation: 'floatUp .35s',
    }}>{msg}</div>
  )
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, chips, onBetPlaced }: {
  event: SportsEvent
  chips: number
  onBetPlaced: (betId: string, optionId: string, optionLabel: string, wager: number, newBalance: number) => void
}) {
  const [sel, setSel] = useState('')
  const [wager, setWager] = useState('')
  const [placing, setPlacing] = useState(false)
  const [err, setErr] = useState('')
  const meta = sportMeta(event.sport)
  const isBettable = event.status === 'open' && (!event.closes_at || new Date(event.closes_at) > new Date())
  const QUICK = [1000, 5000, 10000, 25000]

  async function handleBet() {
    setErr('')
    const amount = parseInt(wager, 10)
    if (!sel) { setErr('Pick an option'); return }
    if (!amount || amount < 500) { setErr('Min 500 chips'); return }
    if (amount > chips) { setErr('Not enough chips'); return }
    setPlacing(true)
    const option = event.options.find(o => o.id === sel)!
    const res = await fetch('/api/sports/bet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: event.id, option_id: sel, option_label: option.label, chips_wagered: amount }),
    })
    if (res.ok) {
      const data = await res.json()
      onBetPlaced(data.bet_id, sel, option.label, amount, data.chips)
    } else {
      const data = await res.json()
      setErr(data.error || 'Failed to place bet')
    }
    setPlacing(false)
  }

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(26,21,10,.9), rgba(11,10,7,.95))',
      border: '1px solid rgba(217,182,90,.18)', borderRadius: 14, padding: '20px 22px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: meta.color, opacity: .6 }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--fs-head)', letterSpacing: '.18em', color: meta.color, textTransform: 'uppercase', fontWeight: 700 }}>
              {meta.emoji} {meta.label}
            </span>
            {event.event_date && (
              <span style={{ fontSize: 11, color: 'var(--cream-faint)' }}>· {fmtDate(event.event_date)}</span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 16, color: 'var(--cream)', lineHeight: 1.3 }}>
            {event.title}
          </div>
        </div>
        {isBettable && event.closes_at && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#5fd99a', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>OPEN</div>
            <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginTop: 2 }}>{timeLeft(event.closes_at)}</div>
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {event.options.map(opt => (
          <button key={opt.id} onClick={() => { setSel(opt.id); setErr('') }}
            style={{
              flex: 1, minWidth: 100, padding: '10px 14px', borderRadius: 9,
              fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 12, letterSpacing: '.05em',
              cursor: 'pointer', transition: 'all .15s',
              border: sel === opt.id ? `2px solid ${meta.color}` : '2px solid rgba(217,182,90,.16)',
              background: sel === opt.id ? `rgba(${hexRgb(meta.color)},.12)` : 'rgba(255,255,255,.03)',
              color: sel === opt.id ? meta.color : 'var(--cream)',
            }}
          >{opt.label}</button>
        ))}
      </div>

      {/* Wager */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: err ? 8 : 12 }}>
        <input type="number" placeholder="Chips…" value={wager} onChange={e => { setWager(e.target.value); setErr('') }}
          style={{ flex: 1, minWidth: 120, height: 40, padding: '0 12px', borderRadius: 8, outline: 'none',
            background: 'rgba(0,0,0,.5)', border: `1px solid rgba(217,182,90,${err ? '.7' : '.2'})`,
            color: 'var(--gold-l)', fontSize: 14, fontFamily: 'var(--fs-head)' }}
          min={500} max={chips} />
        {QUICK.map(q => (
          <button key={q} onClick={() => { setWager(String(Math.min(q, chips))); setErr('') }}
            style={{ padding: '0 11px', height: 40, borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(217,182,90,.18)', background: 'rgba(217,182,90,.05)',
              color: 'var(--cream-dim)', fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.08em' }}>
            {q >= 1000 ? q / 1000 + 'K' : q}
          </button>
        ))}
      </div>
      {err && <div style={{ fontSize: 12, color: '#e7708a', marginBottom: 8 }}>{err}</div>}
      <button disabled={placing} onClick={handleBet}
        style={{ width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', cursor: placing ? 'wait' : 'pointer',
          background: placing ? 'rgba(217,182,90,.25)' : 'var(--gold-grad)', color: '#2a1f08',
          fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 13, letterSpacing: '.1em',
          textTransform: 'uppercase', opacity: placing ? .7 : 1 }}>
        {placing ? 'Placing…' : 'Place Bet · 2× if correct'}
      </button>
    </div>
  )
}

function hexRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SportsPage() {
  const [chips, setChips] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [events, setEvents] = useState<SportsEvent[]>([])
  const [myBets, setMyBets] = useState<SportsBet[]>([])
  const [mainTab, setMainTab] = useState<'betnow' | 'mybets'>('betnow')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [betsSubTab, setBetsSubTab] = useState<'current' | 'past'>('current')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const showToast = useCallback((msg: string, kind = '') => setToast({ msg, kind }), [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, eventsRes, betsRes] = await Promise.all([
        supabase.from('profiles').select('chips, display_name').eq('id', user.id).single(),
        fetch('/api/sports/events'),
        fetch('/api/sports/my-bets'),
      ])

      if (profileRes.data) { setChips(profileRes.data.chips); setDisplayName(profileRes.data.display_name) }
      if (eventsRes.ok) { const d = await eventsRes.json(); setEvents(d.events || []) }
      if (betsRes.ok)   { const d = await betsRes.json();   setMyBets(d.bets || []) }
      setLoading(false)
    }
    load()
  }, [router])

  const betEventIds = new Set(myBets.map(b => b.event_id))

  // Bet Now: only events user hasn't bet on, still open/upcoming
  const unbetEvents = events.filter(e =>
    !betEventIds.has(e.id) &&
    (e.status === 'open') &&
    (!e.closes_at || new Date(e.closes_at) > new Date())
  )
  const activeSports = [...new Set(unbetEvents.map(e => e.sport))]
  const filteredEvents = sportFilter === 'all' ? unbetEvents : unbetEvents.filter(e => e.sport === sportFilter)

  // My Bets — current: event hasn't started or closes in future
  const now = new Date()
  const currentBets = myBets.filter(b => {
    const eventDate = b.event?.event_date ? new Date(b.event.event_date) : null
    return !b.settled && eventDate && eventDate > now
  })
  // My Bets — past: event has started/ended
  const pastBets = myBets.filter(b => {
    const eventDate = b.event?.event_date ? new Date(b.event.event_date) : null
    return b.settled || (eventDate && eventDate <= now)
  })

  const tabBtn = (active: boolean, color?: string) => ({
    padding: '8px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 12, letterSpacing: '.1em',
    textTransform: 'uppercase' as const, transition: 'all .15s',
    background: active ? (color ? color : 'var(--gold-grad)') : 'rgba(255,255,255,.06)',
    color: active ? '#2a1f08' : 'var(--cream-dim)',
  })

  const subTabBtn = (active: boolean) => ({
    padding: '6px 16px', borderRadius: 999, border: active ? '1px solid rgba(217,182,90,.4)' : '1px solid rgba(255,255,255,.08)',
    cursor: 'pointer', fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 11, letterSpacing: '.1em',
    textTransform: 'uppercase' as const, transition: 'all .15s',
    background: active ? 'rgba(217,182,90,.12)' : 'transparent',
    color: active ? 'var(--gold-l)' : 'var(--cream-faint)',
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em', fontSize: 18 }}>Loading…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-900)' }}>
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '16px 28px',
        background: 'linear-gradient(180deg, rgba(11,10,7,.95), rgba(11,10,7,.5))',
        backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(217,182,90,.12)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--cream-dim)', fontFamily: 'var(--fs-head)',
            fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 14px',
            borderRadius: 999, border: '1px solid rgba(217,182,90,.22)' }}>← Lobby</Link>
          <div>
            <div className="gold-text" style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 20, letterSpacing: '.14em' }}>SPORTS BOOK</div>
            <div style={{ fontFamily: 'var(--fs-head)', fontSize: 9, letterSpacing: '.4em', color: 'var(--cream-faint)' }}>PREDICT · WIN · COLLECT</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {displayName && <span style={{ color: 'var(--cream-faint)', fontSize: 13, fontFamily: 'var(--fs-head)' }}>{displayName}</span>}
          <div className="balance"><div className="coin">H</div><span className="amt tabnum">{fmt(chips)}</span></div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={() => setMainTab('betnow')} style={tabBtn(mainTab === 'betnow')}>
            Bet Now {unbetEvents.length > 0 && (
              <span style={{ marginLeft: 6, background: 'rgba(95,217,154,.25)', color: '#5fd99a', borderRadius: 999, padding: '1px 7px', fontSize: 10 }}>
                {unbetEvents.length}
              </span>
            )}
          </button>
          <button onClick={() => setMainTab('mybets')} style={tabBtn(mainTab === 'mybets')}>
            My Bets {currentBets.length > 0 && (
              <span style={{ marginLeft: 6, background: 'rgba(217,182,90,.25)', color: 'var(--gold)', borderRadius: 999, padding: '1px 7px', fontSize: 10 }}>
                {currentBets.length}
              </span>
            )}
          </button>
        </div>

        {/* ── BET NOW ──────────────────────────────────────────────────────── */}
        {mainTab === 'betnow' && (
          <>
            {/* Sport filter pills */}
            {activeSports.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button onClick={() => setSportFilter('all')} style={{
                  ...subTabBtn(sportFilter === 'all'),
                  borderColor: sportFilter === 'all' ? 'rgba(217,182,90,.4)' : 'rgba(255,255,255,.08)',
                }}>All ({unbetEvents.length})</button>
                {activeSports.map(sport => {
                  const m = sportMeta(sport)
                  const count = unbetEvents.filter(e => e.sport === sport).length
                  return (
                    <button key={sport} onClick={() => setSportFilter(sport)} style={{
                      padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
                      fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em',
                      textTransform: 'uppercase', transition: 'all .15s',
                      border: sportFilter === sport ? `1px solid ${m.color}` : '1px solid rgba(255,255,255,.08)',
                      background: sportFilter === sport ? `rgba(${hexRgb(m.color)},.12)` : 'transparent',
                      color: sportFilter === sport ? m.color : 'var(--cream-faint)',
                    }}>{m.emoji} {m.label} ({count})</button>
                  )
                })}
              </div>
            )}

            {filteredEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '70px 20px', border: '1px dashed rgba(217,182,90,.15)', borderRadius: 16 }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>📋</div>
                <div style={{ fontFamily: 'var(--fs-head)', fontSize: 13, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase' }}>
                  {unbetEvents.length === 0 ? "You've bet on all available events" : 'No events for this sport'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: 8, opacity: .6 }}>
                  New events added every Monday
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredEvents.map(event => (
                  <EventCard key={event.id} event={event} chips={chips}
                    onBetPlaced={(betId, optionId, optionLabel, wager, newBalance) => {
                      setChips(newBalance)
                      showToast(`${fmt(wager)} chips on ${optionLabel}`, 'win')
                      setMyBets(prev => [{
                        id: betId, event_id: event.id, option_id: optionId,
                        option_label: optionLabel, chips_wagered: wager,
                        chips_won: null, settled: false, won: null,
                        created_at: new Date().toISOString(), event: {
                          id: event.id, sport: event.sport, title: event.title,
                          options: event.options, result_option_id: null,
                          status: event.status, event_date: event.event_date,
                        },
                      }, ...prev])
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MY BETS ──────────────────────────────────────────────────────── */}
        {mainTab === 'mybets' && (
          <>
            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={() => setBetsSubTab('current')} style={subTabBtn(betsSubTab === 'current')}>
                Current {currentBets.length > 0 && `(${currentBets.length})`}
              </button>
              <button onClick={() => setBetsSubTab('past')} style={subTabBtn(betsSubTab === 'past')}>
                Past {pastBets.length > 0 && `(${pastBets.length})`}
              </button>
            </div>

            {/* Current bets */}
            {betsSubTab === 'current' && (
              currentBets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(217,182,90,.15)', borderRadius: 16 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
                  <div style={{ fontFamily: 'var(--fs-head)', fontSize: 12, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase' }}>No active bets</div>
                  <button onClick={() => setMainTab('betnow')} style={{ marginTop: 16, ...tabBtn(true) }}>Browse Events</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {currentBets.map(bet => {
                    const meta = bet.event ? sportMeta(bet.event.sport) : sportMeta('other')
                    return (
                      <div key={bet.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '18px 20px', borderRadius: 12, gap: 16, flexWrap: 'wrap',
                        background: 'rgba(217,182,90,.05)', border: '1px solid rgba(217,182,90,.16)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: meta.color, fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                            {meta.emoji} {meta.label}
                            {bet.event?.event_date && <span style={{ color: 'var(--cream-faint)', marginLeft: 8 }}>· {fmtDate(bet.event.event_date)}</span>}
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 15, marginBottom: 3 }}>{bet.event?.title ?? 'Event'}</div>
                          <div style={{ fontSize: 13, color: 'var(--cream-dim)' }}>
                            Your pick: <span style={{ color: meta.color, fontWeight: 600 }}>{bet.option_label}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 22, color: 'var(--gold-l)' }}>{fmt(bet.chips_wagered)}</div>
                          <div style={{ fontSize: 10, color: '#5fd99a', fontFamily: 'var(--fs-head)', letterSpacing: '.08em' }}>→ {fmt(bet.chips_wagered * 2)} if correct</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Past bets */}
            {betsSubTab === 'past' && (
              pastBets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed rgba(217,182,90,.15)', borderRadius: 16 }}>
                  <div style={{ fontFamily: 'var(--fs-head)', fontSize: 12, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase' }}>No past bets yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pastBets.map(bet => {
                    const meta = bet.event ? sportMeta(bet.event.sport) : sportMeta('other')
                    const isPending = !bet.settled
                    const profit = (bet.chips_won ?? 0) - bet.chips_wagered
                    const resultOption = bet.event?.options?.find(o => o.id === bet.event?.result_option_id)

                    return (
                      <div key={bet.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 18px', borderRadius: 12, gap: 16, flexWrap: 'wrap',
                        background: isPending ? 'rgba(255,255,255,.03)'
                          : bet.won ? 'rgba(95,217,154,.07)' : 'rgba(231,112,138,.05)',
                        border: isPending ? '1px solid rgba(255,255,255,.08)'
                          : bet.won ? '1px solid rgba(95,217,154,.22)' : '1px solid rgba(231,112,138,.18)',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: meta.color, fontFamily: 'var(--fs-head)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                            {meta.emoji} {meta.label}
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 14, marginBottom: 3 }}>{bet.event?.title ?? 'Event'}</div>
                          <div style={{ fontSize: 12, color: 'var(--cream-dim)' }}>
                            Picked: <span style={{ fontWeight: 600 }}>{bet.option_label}</span>
                            {resultOption && <> · Result: <span style={{ color: '#5fd99a', fontWeight: 600 }}>{resultOption.label}</span></>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {isPending ? (
                            <>
                              <div style={{ fontSize: 12, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.08em' }}>AWAITING RESULT</div>
                              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 3 }}>
                                Payout {nextSyncLabel()}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--cream-faint)', marginTop: 2 }}>{fmt(bet.chips_wagered)} wagered</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 20, color: bet.won ? '#5fd99a' : '#e7708a' }}>
                                {bet.won ? '+' + fmt(profit) : '−' + fmt(bet.chips_wagered)}
                              </div>
                              <div style={{ fontSize: 10, fontFamily: 'var(--fs-head)', letterSpacing: '.1em', marginTop: 2, color: bet.won ? '#5fd99a' : '#e7708a' }}>
                                {bet.won ? 'WON' : 'LOST'}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes floatUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  )
}
