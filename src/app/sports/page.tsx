'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SPORT_META: Record<string, { emoji: string; color: string; label: string }> = {
  nba:    { emoji: '🏀', color: '#f37321', label: 'NBA' },
  nfl:    { emoji: '🏈', color: '#4a90d9', label: 'NFL' },
  soccer: { emoji: '⚽', color: '#4caf50', label: 'Soccer' },
  mlb:    { emoji: '⚾', color: '#cc4444', label: 'MLB' },
  pga:    { emoji: '⛳', color: '#2d8a1f', label: 'PGA' },
  tennis: { emoji: '🎾', color: '#b8d432', label: 'Tennis' },
  ufc:    { emoji: '🥊', color: '#c0392b', label: 'UFC' },
  esports:{ emoji: '🎮', color: '#9b59b6', label: 'Esports' },
  nhl:    { emoji: '🏒', color: '#00a0e4', label: 'NHL' },
  other:  { emoji: '🏆', color: '#d9b65a', label: 'Other' },
}

function sportMeta(key: string) {
  return SPORT_META[key.toLowerCase()] ?? { emoji: '🏆', color: '#d9b65a', label: key.toUpperCase() }
}

interface SportOption { id: string; label: string }
interface SportsEvent {
  id: string
  sport: string
  title: string
  description: string | null
  options: SportOption[]
  closes_at: string | null
  event_date: string | null
  result_option_id: string | null
  status: 'open' | 'closed' | 'settled' | 'cancelled'
  created_at: string
}
interface SportsBet {
  id: string
  event_id: string
  option_id: string
  option_label: string
  chips_wagered: number
  chips_won: number | null
  settled: boolean
  won?: boolean | null
  created_at: string
  event?: Pick<SportsEvent, 'id' | 'sport' | 'title' | 'options' | 'result_option_id' | 'status' | 'event_date'>
}

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

function timeLeft(closeAt: string | null): string {
  if (!closeAt) return ''
  const diff = new Date(closeAt).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  const bg = kind === 'win' ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)'
    : kind === 'lose' ? 'linear-gradient(160deg,#6a1325,#440b18)'
    : 'linear-gradient(180deg,#241f15,#0b0a07)'
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

function EventCard({
  event, existingBet, chips,
  onBetPlaced,
}: {
  event: SportsEvent
  existingBet: SportsBet | undefined
  chips: number
  onBetPlaced: (betId: string, optionId: string, optionLabel: string, wager: number, newBalance: number) => void
}) {
  const [selectedOption, setSelectedOption] = useState<string>(existingBet?.option_id ?? '')
  const [wager, setWager] = useState<string>('')
  const [placing, setPlacing] = useState(false)
  const [err, setErr] = useState('')
  const meta = sportMeta(event.sport)
  const isBettable = event.status === 'open' && (!event.closes_at || new Date(event.closes_at) > new Date())
  const isSettled = event.status === 'settled'
  const closed = event.status === 'closed' || (event.closes_at ? new Date(event.closes_at) <= new Date() : false)

  async function handleBet() {
    setErr('')
    const amount = parseInt(wager, 10)
    if (!selectedOption) { setErr('Pick an option'); return }
    if (!amount || amount < 500) { setErr('Minimum 500 chips'); return }
    if (amount > chips) { setErr('Not enough chips'); return }
    setPlacing(true)
    const option = event.options.find(o => o.id === selectedOption)!
    const res = await fetch('/api/sports/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: event.id, option_id: selectedOption, option_label: option.label, chips_wagered: amount }),
    })
    if (res.ok) {
      const data = await res.json()
      onBetPlaced(data.bet_id, selectedOption, option.label, amount, data.chips)
    } else {
      const data = await res.json()
      setErr(data.error || 'Failed to place bet')
    }
    setPlacing(false)
  }

  const QUICK = [1000, 5000, 10000, 25000]

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(26,21,10,.9), rgba(11,10,7,.95))',
      border: `1px solid rgba(217,182,90,.2)`,
      borderRadius: 16,
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: meta.color, opacity: .7 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 10, fontFamily: 'var(--fs-head)', letterSpacing: '.18em',
              color: meta.color, textTransform: 'uppercase', fontWeight: 700,
            }}>{meta.emoji} {meta.label}</span>
            {event.event_date && (
              <span style={{ fontSize: 10, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)' }}>
                · {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 17, color: 'var(--cream)', lineHeight: 1.3 }}>
            {event.title}
          </div>
          {event.description && (
            <div style={{ marginTop: 5, fontSize: 13, color: 'var(--cream-dim)', lineHeight: 1.5 }}>{event.description}</div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          {isSettled ? (
            <span style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 10, fontFamily: 'var(--fs-head)',
              letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700,
              background: 'rgba(95,217,154,.12)', border: '1px solid rgba(95,217,154,.3)', color: '#5fd99a',
            }}>Settled</span>
          ) : isBettable ? (
            <div style={{ textAlign: 'right' }}>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 10, fontFamily: 'var(--fs-head)',
                letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700,
                background: 'rgba(95,217,154,.1)', border: '1px solid rgba(95,217,154,.25)', color: '#5fd99a',
              }}>Open</span>
              {event.closes_at && (
                <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginTop: 4 }}>{timeLeft(event.closes_at)}</div>
              )}
            </div>
          ) : (
            <span style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 10, fontFamily: 'var(--fs-head)',
              letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700,
              background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--cream-faint)',
            }}>{closed && !isSettled ? 'Awaiting Result' : 'Closed'}</span>
          )}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {event.options.map(opt => {
          const isResult = isSettled && opt.id === event.result_option_id
          const isUserPick = existingBet?.option_id === opt.id
          const isSelected = !existingBet && selectedOption === opt.id
          return (
            <button
              key={opt.id}
              disabled={!!existingBet || !isBettable}
              onClick={() => { setSelectedOption(opt.id); setErr('') }}
              style={{
                flex: 1, minWidth: 120, padding: '11px 16px', borderRadius: 10,
                fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 13,
                letterSpacing: '.06em', cursor: existingBet || !isBettable ? 'default' : 'pointer',
                transition: 'all .15s',
                border: isResult ? `2px solid #5fd99a`
                  : isUserPick ? `2px solid ${meta.color}`
                  : isSelected ? `2px solid ${meta.color}`
                  : '2px solid rgba(217,182,90,.18)',
                background: isResult ? 'rgba(95,217,154,.15)'
                  : isUserPick ? `rgba(${hexToRgb(meta.color)}, .15)`
                  : isSelected ? `rgba(${hexToRgb(meta.color)}, .12)`
                  : 'rgba(255,255,255,.04)',
                color: isResult ? '#5fd99a'
                  : isUserPick || isSelected ? meta.color
                  : 'var(--cream)',
              }}
            >
              {opt.label}
              {isResult && ' ✓'}
              {isUserPick && !isResult && ' (your pick)'}
            </button>
          )
        })}
      </div>

      {/* Already bet on this event */}
      {existingBet && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: existingBet.settled
            ? existingBet.won ? 'rgba(95,217,154,.1)' : 'rgba(231,112,138,.08)'
            : 'rgba(217,182,90,.08)',
          border: `1px solid ${existingBet.settled ? existingBet.won ? 'rgba(95,217,154,.3)' : 'rgba(231,112,138,.25)' : 'rgba(217,182,90,.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 13, color: 'var(--cream-dim)' }}>
            Your bet: <strong style={{ color: 'var(--cream)' }}>{fmt(existingBet.chips_wagered)}</strong> chips on{' '}
            <strong style={{ color: meta.color }}>{existingBet.option_label}</strong>
          </div>
          {existingBet.settled ? (
            <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 13,
              color: existingBet.won ? '#5fd99a' : '#e7708a' }}>
              {existingBet.won ? `+${fmt((existingBet.chips_won ?? 0) - existingBet.chips_wagered)} WON` : '−'+fmt(existingBet.chips_wagered)+' LOST'}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.08em' }}>
              PENDING
            </div>
          )}
        </div>
      )}

      {/* Bet input */}
      {isBettable && !existingBet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="number"
              placeholder="Wager amount…"
              value={wager}
              onChange={e => { setWager(e.target.value); setErr('') }}
              style={{
                flex: 1, minWidth: 140, height: 42, padding: '0 14px', borderRadius: 9,
                background: 'rgba(0,0,0,.5)', border: `1px solid rgba(217,182,90,${err ? '.7' : '.25'})`,
                color: 'var(--gold-l)', fontSize: 15, fontFamily: 'var(--fs-head)',
                outline: 'none', letterSpacing: '.04em',
              }}
              min={500}
              max={chips}
            />
            {QUICK.map(q => (
              <button
                key={q}
                onClick={() => { setWager(String(Math.min(q, chips))); setErr('') }}
                style={{
                  padding: '0 12px', height: 42, borderRadius: 9, border: '1px solid rgba(217,182,90,.22)',
                  background: 'rgba(217,182,90,.06)', color: 'var(--cream-dim)', cursor: 'pointer',
                  fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.1em',
                  transition: 'background .15s',
                }}
              >{q >= 1000 ? q / 1000 + 'K' : q}</button>
            ))}
          </div>
          {err && <div style={{ fontSize: 12, color: '#e7708a' }}>{err}</div>}
          <button
            disabled={placing}
            onClick={handleBet}
            style={{
              padding: '12px 0', borderRadius: 10, border: 'none', cursor: placing ? 'wait' : 'pointer',
              background: placing ? 'rgba(217,182,90,.3)' : 'var(--gold-grad)',
              color: '#2a1f08', fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 14,
              letterSpacing: '.1em', textTransform: 'uppercase', transition: 'opacity .2s',
              opacity: placing ? .7 : 1,
            }}
          >{placing ? 'Placing…' : 'Place Bet · 2× if correct'}</button>
        </div>
      )}
    </div>
  )
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

export default function SportsPage() {
  const [chips, setChips] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [events, setEvents] = useState<SportsEvent[]>([])
  const [myBets, setMyBets] = useState<SportsBet[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const showToast = useCallback((msg: string, kind = '') => {
    setToast({ msg, kind })
  }, [])

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

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        const evts: SportsEvent[] = data.events || []
        setEvents(evts)
        const sports = [...new Set(evts.map(e => e.sport))]
        if (sports.length > 0) setActiveTab(sports[0])
        else setActiveTab('mybets')
      }

      if (betsRes.ok) {
        const data = await betsRes.json()
        setMyBets(data.bets || [])
      }

      setLoading(false)
    }
    load()
  }, [router])

  const activeSports = [...new Set(events.map(e => e.sport))]

  const betsByEvent: Record<string, SportsBet> = {}
  myBets.forEach(b => { betsByEvent[b.event_id] = b })

  function handleBetPlaced(betId: string, optionId: string, optionLabel: string, wager: number, newBalance: number) {
    setChips(newBalance)
    showToast(`${fmt(wager)} chips wagered on ${optionLabel}`, 'win')
    const activeEvent = events.find(e => betsByEvent[e.id] === undefined && activeTab === e.sport)
    if (activeEvent) {
      const newBet: SportsBet = {
        id: betId, event_id: activeEvent.id, option_id: optionId, option_label: optionLabel,
        chips_wagered: wager, chips_won: null, settled: false, won: null,
        created_at: new Date().toISOString(),
      }
      setMyBets(prev => [newBet, ...prev])
      betsByEvent[activeEvent.id] = newBet
    }
  }

  function handleBetPlacedForEvent(eventId: string, betId: string, optionId: string, optionLabel: string, wager: number, newBalance: number) {
    setChips(newBalance)
    showToast(`${fmt(wager)} chips wagered on ${optionLabel}`, 'win')
    const newBet: SportsBet = {
      id: betId, event_id: eventId, option_id: optionId, option_label: optionLabel,
      chips_wagered: wager, chips_won: null, settled: false, won: null,
      created_at: new Date().toISOString(),
    }
    setMyBets(prev => [newBet, ...prev])
  }

  const tabStyle = (active: boolean) => ({
    padding: '8px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 12, letterSpacing: '.1em',
    textTransform: 'uppercase' as const, transition: 'all .15s',
    background: active ? 'var(--gold-grad)' : 'rgba(255,255,255,.06)',
    color: active ? '#2a1f08' : 'var(--cream-dim)',
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em', fontSize: 18 }}>Loading…</div>
    </div>
  )

  const tabEvents = events.filter(e => e.sport === activeTab)
  const pendingBets = myBets.filter(b => !b.settled)
  const settledBets = myBets.filter(b => b.settled)

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
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
            color: 'var(--cream-dim)', fontFamily: 'var(--fs-head)', fontSize: 12,
            letterSpacing: '.12em', textTransform: 'uppercase', padding: '8px 14px',
            borderRadius: 999, border: '1px solid rgba(217,182,90,.22)',
          }}>← Lobby</Link>
          <div>
            <div className="gold-text" style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 20, letterSpacing: '.14em' }}>
              SPORTS BOOK
            </div>
            <div style={{ fontFamily: 'var(--fs-head)', fontSize: 9, letterSpacing: '.4em', color: 'var(--cream-faint)' }}>
              PREDICT · WIN · COLLECT
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {displayName && <span style={{ color: 'var(--cream-faint)', fontSize: 13, fontFamily: 'var(--fs-head)' }}>{displayName}</span>}
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(chips)}</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 80px' }}>
        {/* Hero banner */}
        <div style={{
          borderRadius: 16, padding: '28px 32px', marginBottom: 28,
          background: 'linear-gradient(135deg, rgba(217,182,90,.12) 0%, rgba(11,10,7,.6) 60%, rgba(0,0,0,.4) 100%)',
          border: '1px solid rgba(217,182,90,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--fs-head)', fontSize: 10, letterSpacing: '.4em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>
              No house edge · Pure prediction
            </div>
            <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 28, color: 'var(--cream)', lineHeight: 1.2 }}>
              Bet on real sports.<br />
              <span className="gold-text">Win 2× if you&apos;re right.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { v: events.filter(e => e.status === 'open').length, l: 'Open Events' },
              { v: pendingBets.length, l: 'Your Bets' },
              { v: settledBets.filter(b => b.won).length, l: 'Wins' },
            ].map(s => (
              <div key={s.l} style={{
                textAlign: 'center', padding: '14px 18px', borderRadius: 12,
                background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.15)',
                minWidth: 80,
              }}>
                <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 26, color: 'var(--gold-l)' }}>{s.v}</div>
                <div style={{ fontSize: 10, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {activeSports.map(sport => {
            const meta = sportMeta(sport)
            return (
              <button key={sport} onClick={() => setActiveTab(sport)} style={{
                ...tabStyle(activeTab === sport),
                borderLeft: activeTab === sport ? `3px solid ${meta.color}` : '3px solid transparent',
              }}>
                {meta.emoji} {meta.label}
              </button>
            )
          })}
          <button onClick={() => setActiveTab('mybets')} style={{
            ...tabStyle(activeTab === 'mybets'),
            marginLeft: activeSports.length > 0 ? 'auto' : 0,
          }}>
            My Bets {pendingBets.length > 0 && (
              <span style={{
                marginLeft: 6, background: 'rgba(231,112,138,.8)', color: '#fff',
                borderRadius: 999, padding: '1px 7px', fontSize: 10,
              }}>{pendingBets.length}</span>
            )}
          </button>
        </div>

        {/* Sport tab content */}
        {activeTab !== 'mybets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {tabEvents.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                border: '1px dashed rgba(217,182,90,.2)', borderRadius: 16,
                color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em',
              }}>
                No events available right now
              </div>
            ) : (
              tabEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  existingBet={betsByEvent[event.id]}
                  chips={chips}
                  onBetPlaced={(betId, optionId, optionLabel, wager, newBalance) =>
                    handleBetPlacedForEvent(event.id, betId, optionId, optionLabel, wager, newBalance)
                  }
                />
              ))
            )}
          </div>
        )}

        {/* My Bets tab */}
        {activeTab === 'mybets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {myBets.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px',
                border: '1px dashed rgba(217,182,90,.2)', borderRadius: 16,
                color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.12em',
              }}>
                No bets yet — pick an event and make a prediction
              </div>
            ) : (
              <>
                {pendingBets.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.3em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 14 }}>
                      Pending ({pendingBets.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {pendingBets.map(bet => {
                        const meta = bet.event ? sportMeta(bet.event.sport) : sportMeta('other')
                        return (
                          <div key={bet.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 20px', borderRadius: 12,
                            background: 'rgba(217,182,90,.06)', border: '1px solid rgba(217,182,90,.18)',
                            gap: 12, flexWrap: 'wrap',
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: meta.color, fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                                {meta.emoji} {meta.label} · {timeAgo(bet.created_at)}
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 15 }}>{bet.event?.title ?? 'Event'}</div>
                              <div style={{ fontSize: 13, color: 'var(--cream-dim)', marginTop: 3 }}>
                                Pick: <span style={{ color: meta.color, fontWeight: 600 }}>{bet.option_label}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 22, color: 'var(--gold-l)' }}>{fmt(bet.chips_wagered)}</div>
                              <div style={{ fontSize: 10, color: '#5fd99a', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>→ {fmt(bet.chips_wagered * 2)} if correct</div>
                              <div style={{ fontSize: 10, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', marginTop: 3 }}>PENDING</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {settledBets.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.3em', color: 'var(--cream-faint)', textTransform: 'uppercase', marginBottom: 14 }}>
                      Settled ({settledBets.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {settledBets.map(bet => {
                        const meta = bet.event ? sportMeta(bet.event.sport) : sportMeta('other')
                        const profit = (bet.chips_won ?? 0) - bet.chips_wagered
                        return (
                          <div key={bet.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px', borderRadius: 12,
                            background: bet.won ? 'rgba(95,217,154,.08)' : 'rgba(231,112,138,.06)',
                            border: `1px solid ${bet.won ? 'rgba(95,217,154,.25)' : 'rgba(231,112,138,.2)'}`,
                            gap: 12, flexWrap: 'wrap',
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10, color: meta.color, fontFamily: 'var(--fs-head)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                                {meta.emoji} {meta.label}
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--cream)', fontSize: 14 }}>{bet.event?.title ?? 'Event'}</div>
                              <div style={{ fontSize: 12, color: 'var(--cream-dim)', marginTop: 2 }}>
                                Picked: <span style={{ fontWeight: 600 }}>{bet.option_label}</span>
                                {bet.event?.result_option_id && (
                                  <> · Result: <span style={{ color: '#5fd99a', fontWeight: 600 }}>
                                    {bet.event.options.find(o => o.id === bet.event!.result_option_id)?.label ?? bet.event.result_option_id}
                                  </span></>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{
                                fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 20,
                                color: bet.won ? '#5fd99a' : '#e7708a',
                              }}>
                                {bet.won ? '+' + fmt(profit) : '−' + fmt(bet.chips_wagered)}
                              </div>
                              <div style={{ fontSize: 10, fontFamily: 'var(--fs-head)', letterSpacing: '.1em', marginTop: 2, color: bet.won ? '#5fd99a' : '#e7708a' }}>
                                {bet.won ? 'WON' : 'LOST'}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes floatUp { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>
    </div>
  )
}
