'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface GameRoom {
  code: string
  game: string
  host_id: string
  host_name: string
  guest_name: string | null
  status: 'waiting' | 'active' | 'solo' | 'ended'
  created_at: string
  updated_at: string
}

function fmt(n: number) { return Number(n).toLocaleString('en-US') }
function fmtPnl(n: number) { return (n >= 0 ? '+' : '') + fmt(n) }

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

interface Session {
  user_id: string
  game: string
  chips_wagered: number
  chips_won: number
  created_at: string
}

interface GameStat { game: string; count: number; total_wagered: number; total_won: number }

interface AdminSportsEvent {
  id: string
  sport: string
  title: string
  description: string | null
  options: { id: string; label: string }[]
  closes_at: string | null
  event_date: string | null
  result_option_id: string | null
  status: 'open' | 'closed' | 'settled' | 'cancelled'
  created_at: string
}

interface PlayerGameStat { game: string; count: number; wagered: number; won: number }

interface GuestAccount {
  pin: string
  display_name: string
  user_id: string
  created_at: string
}

interface SportsBet {
  user_id: string
  event_id: string
  chips_wagered: number
  chips_won: number
  won: boolean | null
  settled: boolean
  option_id: string
  option_label: string
  display_name: string
  event_title: string
  sport: string
}

const DIRECTOR_EMAIL = 'vedantbhatia8@gmail.com'

function getOnlineStatus(lastLogin: string | null): 'online' | 'recent' | 'offline' {
  if (!lastLogin) return 'offline'
  const diff = Date.now() - new Date(lastLogin).getTime()
  if (diff < 5 * 60 * 1000) return 'online'
  if (diff < 60 * 60 * 1000) return 'recent'
  return 'offline'
}

function statusColor(s: 'online' | 'recent' | 'offline') {
  return s === 'online' ? '#5fd99a' : s === 'recent' ? '#d9b65a' : '#6b6555'
}

function statusLabel(s: 'online' | 'recent' | 'offline') {
  return s === 'online' ? 'Online' : s === 'recent' ? 'Recently Active' : 'Offline'
}

function timeAgo(ts: string | null) {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  const bg = kind === 'win' ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)' : kind === 'lose' ? 'linear-gradient(160deg,#6a1325,#440b18)' : 'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{ position: 'fixed', left: '50%', bottom: 38, transform: 'translateX(-50%)', zIndex: 9999, padding: '13px 26px', borderRadius: 999, fontFamily: 'Cinzel,serif', fontWeight: 600, letterSpacing: '.05em', boxShadow: '0 14px 40px rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.5)', background: bg, color: kind === 'win' ? '#2a1f08' : 'var(--cream)', animation: 'floatUp .35s' }}>{msg}</div>
}

function PlayerDetailPanel({
  player,
  playerGames,
  rooms,
  onClose,
  onBan,
  pin,
}: {
  player: Profile
  playerGames: PlayerGameStat[]
  rooms: GameRoom[]
  onClose: () => void
  onBan: (id: string, banned: boolean) => void
  pin?: string
}) {
  const status = getOnlineStatus(player.last_login)
  const netPnl = (player.total_won || 0) - (player.total_wagered || 0)
  const totalLost = Math.max(0, (player.total_wagered || 0) - (player.total_won || 0))
  const mostPlayed = playerGames.length > 0 ? playerGames[0].game : null
  const totalRounds = playerGames.reduce((s, g) => s + g.count, 0)
  const liveRoom = rooms.find(r => r.host_id === player.id && (r.status === 'active' || r.status === 'solo'))

  const GAME_ICONS: Record<string, string> = {
    blackjack: '🃏', poker: '♠', roulette: '🎰', slots: '🎰', baccarat: '🎴',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div style={{
        position: 'relative', width: 420, height: '100vh', overflowY: 'auto',
        background: 'linear-gradient(180deg, #1a1510 0%, #0b0a07 100%)',
        borderLeft: '1px solid rgba(217,182,90,.25)',
        boxShadow: '-24px 0 80px rgba(0,0,0,.7)',
        padding: 28,
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 22, color: 'var(--cream)', marginBottom: 4 }}>
              {player.display_name || 'Unknown'}
            </div>
            {pin ? (
              <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--cream-faint)' }}>PIN:</span>
                <code style={{ fontFamily: 'monospace', letterSpacing: '0.2em', color: 'var(--gold-l)', fontWeight: 700 }}>{pin}</code>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--cream-faint)', marginBottom: 8 }}>{player.email}</div>
            )}
            {player.email === DIRECTOR_EMAIL && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '3px 10px', borderRadius: 999, background: 'linear-gradient(135deg, rgba(217,182,90,.18), rgba(155,120,40,.12))', border: '1px solid rgba(217,182,90,.45)' }}>
                <span style={{ fontSize: 10 }}>♦</span>
                <span style={{ fontFamily: 'var(--fs-head)', fontSize: 10, letterSpacing: '.18em', color: 'var(--gold-l)', textTransform: 'uppercase', fontWeight: 700 }}>Director</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: statusColor(status), display: 'inline-block',
                boxShadow: status === 'online' ? `0 0 6px ${statusColor(status)}` : 'none',
              }} />
              <span style={{ fontSize: 12, color: statusColor(status), fontFamily: 'var(--fs-head)', letterSpacing: '.08em' }}>
                {statusLabel(status)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--cream-faint)' }}>· {timeAgo(player.last_login)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(217,182,90,.2)', borderRadius: 8,
            color: 'var(--cream-faint)', cursor: 'pointer', fontSize: 18, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(217,182,90,.15)' }} />

        {/* Key stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Balance', value: fmt(player.chips || 0), color: 'var(--gold-l)' },
            { label: 'Total Rounds', value: fmt(totalRounds), color: 'var(--cream)' },
            { label: 'Total Wagered', value: fmt(player.total_wagered || 0), color: 'var(--cream-dim)' },
            { label: 'Total Won', value: fmt(player.total_won || 0), color: '#5fd99a' },
            { label: 'Total Lost', value: fmt(totalLost), color: '#e7708a' },
            { label: 'Net P&L', value: fmtPnl(netPnl), color: netPnl >= 0 ? '#5fd99a' : '#e7708a' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.12)',
              borderRadius: 10, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', color: 'var(--cream-faint)', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Game breakdown */}
        <div>
          <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.2em', color: 'var(--cream-faint)', textTransform: 'uppercase', marginBottom: 14 }}>
            Game History
          </div>
          {playerGames.length === 0 ? (
            <div style={{ color: 'var(--cream-faint)', fontSize: 13, padding: '12px 0' }}>No games played yet.</div>
          ) : playerGames.map((g, i) => {
            const gamePnl = g.won - g.wagered
            return (
              <div key={g.game} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: i < playerGames.length - 1 ? '1px solid rgba(217,182,90,.08)' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: 'rgba(217,182,90,.1)',
                  border: '1px solid rgba(217,182,90,.2)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16, flexShrink: 0,
                }}>
                  {GAME_ICONS[g.game] || '🎲'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: 14 }}>{g.game}</span>
                    <span style={{ color: gamePnl >= 0 ? '#5fd99a' : '#e7708a', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtPnl(gamePnl)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--cream-faint)' }}>{fmt(g.count)} rounds</span>
                    <span style={{ fontSize: 11, color: 'var(--cream-faint)' }}>Wagered: {fmt(g.wagered)}</span>
                  </div>
                  {/* Mini bar */}
                  <div style={{ marginTop: 6, height: 3, borderRadius: 999, background: 'rgba(255,255,255,.06)' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      background: gamePnl >= 0 ? '#5fd99a' : '#e7708a',
                      width: `${Math.min(100, (g.won / Math.max(g.wagered, 1)) * 100)}%`,
                      transition: 'width .4s',
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Most played badge */}
        {mostPlayed && (
          <div style={{
            background: 'rgba(217,182,90,.06)', border: '1px solid rgba(217,182,90,.2)',
            borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{GAME_ICONS[mostPlayed] || '🎲'}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--cream-faint)', letterSpacing: '.1em', fontFamily: 'var(--fs-head)', textTransform: 'uppercase' }}>Favourite Game</div>
              <div style={{ fontWeight: 700, textTransform: 'capitalize', marginTop: 2 }}>{mostPlayed}</div>
            </div>
          </div>
        )}

        {/* Info */}
        <div style={{ fontSize: 12, color: 'var(--cream-faint)', lineHeight: 1.6 }}>
          <div>Joined: {new Date(player.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div>Last seen: <span style={{ color: 'var(--cream)' }}>{timeAgo(player.last_login)}</span></div>
          {player.email === DIRECTOR_EMAIL && <div style={{ color: 'var(--gold-l)', marginTop: 2, fontWeight: 700 }}>♦ Director</div>}
          {player.is_admin && <div style={{ color: 'var(--gold)', marginTop: 2 }}>Administrator</div>}
          {player.is_banned && <div style={{ color: '#e7708a', marginTop: 2 }}>Account Suspended</div>}
        </div>

        {/* Action buttons */}
        {!player.is_admin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto', paddingTop: 8 }}>
            {liveRoom && (
              <Link
                href={`/${liveRoom.game}?spectate=${liveRoom.code}`}
                target="_blank"
                style={{
                  display: 'block', textAlign: 'center', padding: '12px 0',
                  background: 'rgba(217,182,90,.1)', border: '1px solid rgba(217,182,90,.3)',
                  borderRadius: 10, color: 'var(--gold-l)', fontFamily: 'var(--fs-head)',
                  fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                👁 Spectate Live → {liveRoom.game}
              </Link>
            )}
            <button
              onClick={() => { onBan(player.id, !player.is_banned); onClose() }}
              style={{
                padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                background: player.is_banned ? 'rgba(95,217,154,.15)' : 'rgba(163,20,43,.25)',
                color: player.is_banned ? '#5fd99a' : '#e7708a',
                fontFamily: 'var(--fs-head)', fontSize: 13, letterSpacing: '.1em',
                textTransform: 'uppercase', fontWeight: 700,
                border: player.is_banned ? '1px solid rgba(95,217,154,.3)' : '1px solid rgba(231,112,138,.3)',
              } as React.CSSProperties}
            >
              {player.is_banned ? 'Reinstate Player' : 'Kick & Suspend'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [gameStats, setGameStats] = useState<GameStat[]>([])
  const [sessionsByUser, setSessionsByUser] = useState<Record<string, PlayerGameStat[]>>({})
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [refillEnabled, setRefillEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null)
  const [grantTarget, setGrantTarget] = useState('')
  const [grantAmount, setGrantAmount] = useState('')
  const [activeTab, setActiveTab] = useState<'players' | 'stats' | 'live' | 'settings' | 'sports'>('players')
  const [sportsEvents, setSportsEvents] = useState<AdminSportsEvent[]>([])
  const [sportsBets, setSportsBets] = useState<SportsBet[]>([])
  const [sportsSubTab, setSportsSubTab] = useState<'events' | 'bettors'>('events')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [eventForm, setEventForm] = useState({ sport: 'nba', title: '', description: '', options: [{ id: 'a', label: '' }, { id: 'b', label: '' }], closes_at: '', event_date: '' })
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [rooms, setRooms] = useState<GameRoom[]>([])
  const [sessionSearch, setSessionSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(30)
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null)
  const [guests, setGuests] = useState<GuestAccount[]>([])
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestPin, setNewGuestPin] = useState('')
  const [creatingGuest, setCreatingGuest] = useState(false)
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

    // Build aggregate game stats
    const map: Record<string, GameStat> = {}
    for (const s of data.sessions) {
      if (!map[s.game]) map[s.game] = { game: s.game, count: 0, total_wagered: 0, total_won: 0 }
      map[s.game].count++
      map[s.game].total_wagered += s.chips_wagered
      map[s.game].total_won += s.chips_won
    }
    setGameStats(Object.values(map).sort((a, b) => b.count - a.count))

    // Store raw sessions sorted newest first
    setAllSessions([...data.sessions].sort((a: Session, b: Session) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ))

    // Build per-player game stats
    const userGameMap: Record<string, Record<string, PlayerGameStat>> = {}
    for (const s of data.sessions) {
      if (!s.user_id) continue
      if (!userGameMap[s.user_id]) userGameMap[s.user_id] = {}
      if (!userGameMap[s.user_id][s.game]) userGameMap[s.user_id][s.game] = { game: s.game, count: 0, wagered: 0, won: 0 }
      userGameMap[s.user_id][s.game].count++
      userGameMap[s.user_id][s.game].wagered += s.chips_wagered
      userGameMap[s.user_id][s.game].won += s.chips_won
    }
    const byUser: Record<string, PlayerGameStat[]> = {}
    for (const [uid, games] of Object.entries(userGameMap)) {
      byUser[uid] = Object.values(games).sort((a, b) => b.count - a.count)
    }
    setSessionsByUser(byUser)

    // Load active game rooms
    const roomsRes = await fetch('/api/admin/rooms').catch(() => null)
    if (roomsRes?.ok) {
      const rd = await roomsRes.json()
      setRooms(rd.rooms || [])
    }

    // Load sports events
    const sportsRes = await fetch('/api/admin/sports').catch(() => null)
    if (sportsRes?.ok) {
      const sd = await sportsRes.json()
      setSportsEvents(sd.events || [])
      setSportsBets(sd.bets || [])
    }

    setLoading(false)
    setRefreshing(false)
    setLastRefreshed(new Date())
    setCountdown(30)
  }, [router])

  useEffect(() => {
    load()
    fetch('/api/admin/guests').then(r => r.ok ? r.json() : null).then(d => { if (d) setGuests(d.guests || []) })
    intervalRef.current = setInterval(() => load(true), 30000)
    countdownRef.current = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1000)
    return () => {
      clearInterval(intervalRef.current!)
      clearInterval(countdownRef.current!)
    }
  }, [load])

  async function handleCreateGuest() {
    if (!newGuestName.trim() || !newGuestPin.trim()) { showToast('Name and PIN required', ''); return }
    setCreatingGuest(true)
    const res = await fetch('/api/admin/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: newGuestName, pin: newGuestPin }),
    })
    const data = await res.json()
    if (res.ok) {
      setGuests(g => [data.guest, ...g])
      setNewGuestName('')
      setNewGuestPin('')
      showToast(`Guest "${data.guest.display_name}" created with PIN ${data.guest.pin}`, 'win')
      load(true)
    } else {
      showToast(data.error || 'Failed to create guest', 'lose')
    }
    setCreatingGuest(false)
  }

  async function handleDeleteGuest(pin: string, name: string) {
    if (!confirm(`Remove guest account for ${name}? This cannot be undone.`)) return
    const res = await fetch('/api/admin/guests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (res.ok) {
      const deletedGuest = guests.find(g => g.pin === pin)
      setGuests(g => g.filter(x => x.pin !== pin))
      if (deletedGuest) setPlayers(ps => ps.filter(p => p.id !== deletedGuest.user_id))
      showToast(`${name} removed`, '')
    } else {
      showToast('Failed to remove guest', 'lose')
    }
  }

  async function handleSportsAction(eventId: string, action: string, resultOptionId?: string) {
    const res = await fetch('/api/admin/sports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: eventId, action, result_option_id: resultOptionId }),
    })
    if (res.ok) {
      const data = await res.json()
      setSportsEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e
        if (action === 'settle') return { ...e, status: 'settled', result_option_id: resultOptionId ?? null }
        if (action === 'close') return { ...e, status: 'closed' }
        if (action === 'cancel') return { ...e, status: 'cancelled' }
        if (action === 'reopen') return { ...e, status: 'open', result_option_id: null }
        return e
      }))
      setSettlingId(null)
      if (action === 'settle') showToast(`Settled — ${data.settled} bets resolved`, 'win')
      else if (action === 'cancel') showToast(`Cancelled — ${data.refunded} bets refunded`, '')
      else showToast('Updated', 'win')
    } else {
      const err = await res.json()
      showToast(err.error || 'Failed', 'lose')
    }
  }

  async function handleCreateEvent() {
    if (!eventForm.title.trim()) { showToast('Title required', ''); return }
    const validOpts = eventForm.options.filter(o => o.label.trim())
    if (validOpts.length < 2) { showToast('At least 2 options required', ''); return }
    setSavingEvent(true)
    const res = await fetch('/api/admin/sports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...eventForm, options: validOpts, closes_at: eventForm.closes_at || null, event_date: eventForm.event_date || null }),
    })
    if (res.ok) {
      const data = await res.json()
      setSportsEvents(prev => [data.event, ...prev])
      setShowAddEvent(false)
      setEventForm({ sport: 'nba', title: '', description: '', options: [{ id: 'a', label: '' }, { id: 'b', label: '' }], closes_at: '', event_date: '' })
      showToast('Event created', 'win')
    } else {
      const err = await res.json()
      showToast(err.error || 'Failed', 'lose')
    }
    setSavingEvent(false)
  }

  async function handleSyncOdds() {
    setSyncing(true)
    const res = await fetch('/api/sports/sync', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      showToast(`Synced — ${data.created} new events, ${data.settled} bets settled`, 'win')
      // Reload sports events
      const sportsRes = await fetch('/api/admin/sports')
      if (sportsRes.ok) { const sd = await sportsRes.json(); setSportsEvents(sd.events || []); setSportsBets(sd.bets || []) }
    } else {
      showToast('Sync failed — check ODDS_API_KEY', 'lose')
    }
    setSyncing(false)
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm('Delete this event and all its bets?')) return
    const res = await fetch(`/api/admin/sports?id=${eventId}`, { method: 'DELETE' })
    if (res.ok) {
      setSportsEvents(prev => prev.filter(e => e.id !== eventId))
      showToast('Deleted', '')
    }
  }

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

  const pinByUserId = Object.fromEntries(guests.map(g => [g.user_id, g.pin]))

  const totalWagered = players.reduce((s, p) => s + (p.total_wagered || 0), 0)
  const totalWon = players.reduce((s, p) => s + (p.total_won || 0), 0)
  const houseProfit = totalWagered - totalWon
  const totalLostByPlayers = players.reduce((s, p) => s + Math.max(0, (p.total_wagered || 0) - (p.total_won || 0)), 0)

  // Sort players by who lost the most
  const topLosers = [...players]
    .filter(p => (p.total_wagered || 0) > 0)
    .sort((a, b) => ((b.total_wagered || 0) - (b.total_won || 0)) - ((a.total_wagered || 0) - (a.total_won || 0)))
    .slice(0, 5)

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

      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          playerGames={sessionsByUser[selectedPlayer.id] || []}
          rooms={rooms}
          onClose={() => setSelectedPlayer(null)}
          onBan={handleBan}
          pin={pinByUserId[selectedPlayer.id]}
        />
      )}

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
          {(['players', 'stats', 'live', 'sports', 'settings'] as const).map(tab => (
            <button key={tab} style={tabStyle(activeTab === tab)} onClick={() => setActiveTab(tab)}>
              {tab === 'players' ? 'Players'
                : tab === 'stats' ? 'House Stats'
                : tab === 'live'
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {rooms.filter(r => r.status === 'active' || r.status === 'solo').length > 0 && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5fd99a', display: 'inline-block', boxShadow: '0 0 5px #5fd99a' }} />
                    )}
                    Games
                  </span>
                : tab === 'sports' ? '🏆 Sports'
                : 'Settings'}
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
            { label: 'Player Losses', value: fmt(totalLostByPlayers), color: '#e7708a' },
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
                    {['Player', 'Status', 'Chips', 'Wagered', 'Won', 'Lost', 'Net P&L', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => {
                    const status = getOnlineStatus(p.last_login)
                    const netPnl = (p.total_won || 0) - (p.total_wagered || 0)
                    const totalLost = Math.max(0, (p.total_wagered || 0) - (p.total_won || 0))
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(217,182,90,.08)', opacity: p.is_banned ? .5 : 1 }}>
                        <td style={{ padding: '14px' }}>
                          <button
                            onClick={() => setSelectedPlayer(p)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
                            }}
                          >
                            <div style={{ fontWeight: 700, color: 'var(--gold-l)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {p.display_name || 'Unknown'}
                              {p.email === DIRECTOR_EMAIL && <span style={{ fontSize: 9, letterSpacing: '.14em', color: 'var(--gold)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase', fontWeight: 700, padding: '1px 6px', border: '1px solid rgba(217,182,90,.4)', borderRadius: 999 }}>Director</span>}
                            </div>
                            {pinByUserId[p.id] ? (
                              <div style={{ fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: 'var(--cream-faint)' }}>PIN:</span>
                                <code style={{ fontFamily: 'monospace', letterSpacing: '0.2em', color: 'var(--gold-l)', fontWeight: 700, fontSize: 13 }}>{pinByUserId[p.id]}</code>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: 'var(--cream-faint)', marginTop: 2 }}>{p.email}</div>
                            )}
                            {p.is_admin && <span style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--gold)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase' }}>Admin</span>}
                          </button>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%', background: statusColor(status), flexShrink: 0,
                              boxShadow: status === 'online' ? `0 0 5px ${statusColor(status)}` : 'none',
                            }} />
                            <span style={{ fontSize: 11, color: statusColor(status), fontFamily: 'var(--fs-head)', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>
                              {status === 'online' ? 'Online' : status === 'recent' ? 'Recent' : 'Offline'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: 'var(--gold-l)', fontWeight: 700 }}>{fmt(p.chips || 0)}</td>
                        <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: 'var(--cream-dim)' }}>{fmt(p.total_wagered || 0)}</td>
                        <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: '#5fd99a' }}>{fmt(p.total_won || 0)}</td>
                        <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: '#e7708a', fontWeight: totalLost > 0 ? 700 : 400 }}>{fmt(totalLost)}</td>
                        <td style={{ padding: '14px', fontVariantNumeric: 'tabular-nums', color: netPnl >= 0 ? '#5fd99a' : '#e7708a', fontWeight: 700 }}>{fmtPnl(netPnl)}</td>
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats tab */}
        {activeTab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Top Games */}
            <div style={panelStyle}>
              <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: '0 0 20px' }}>
                <span className="gold-text">Top Games by Popularity</span>
              </h2>
              {gameStats.length === 0 ? (
                <p style={{ color: 'var(--cream-faint)', fontSize: 14 }}>No game sessions recorded yet.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {gameStats.map((g, i) => {
                    const profit = g.total_wagered - g.total_won
                    const winRate = g.total_wagered > 0 ? ((g.total_won / g.total_wagered) * 100).toFixed(1) : '0.0'
                    const ICONS: Record<string, string> = { blackjack: '🃏', poker: '♠', roulette: '🎰', slots: '🎰', baccarat: '🎴' }
                    return (
                      <div key={g.game} style={{
                        background: 'rgba(0,0,0,.35)', border: i === 0 ? '1px solid rgba(217,182,90,.4)' : '1px solid rgba(217,182,90,.12)',
                        borderRadius: 12, padding: '20px 18px', position: 'relative', overflow: 'hidden',
                      }}>
                        {i === 0 && (
                          <div style={{
                            position: 'absolute', top: 10, right: 12, fontSize: 10,
                            letterSpacing: '.12em', color: 'var(--gold)', fontFamily: 'var(--fs-head)',
                            textTransform: 'uppercase',
                          }}>
                            #1
                          </div>
                        )}
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{ICONS[g.game] || '🎲'}</div>
                        <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 16, textTransform: 'capitalize', marginBottom: 4 }}>{g.game}</div>
                        <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 28, color: 'var(--gold-l)', marginBottom: 12 }}>
                          {fmt(g.count)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--cream-faint)', letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 4 }}>rounds played</div>
                        <div style={{ height: 1, background: 'rgba(217,182,90,.1)', margin: '12px 0' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--cream-faint)' }}>Wagered</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(g.total_wagered)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--cream-faint)' }}>Player wins</span>
                            <span style={{ color: '#5fd99a', fontVariantNumeric: 'tabular-nums' }}>{fmt(g.total_won)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--cream-faint)' }}>House edge</span>
                            <span style={{ color: profit >= 0 ? '#5fd99a' : '#e7708a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtPnl(profit)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ color: 'var(--cream-faint)' }}>Player win rate</span>
                            <span style={{ color: 'var(--cream-dim)', fontVariantNumeric: 'tabular-nums' }}>{winRate}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Two-column: top losers + grant chips */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Top Losers */}
              <div style={panelStyle}>
                <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: '0 0 20px' }}>
                  <span className="gold-text">Top Losses (Players)</span>
                </h2>
                <p style={{ color: 'var(--cream-faint)', fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>Players who have lost the most chips overall.</p>
                {topLosers.length === 0 ? (
                  <p style={{ color: 'var(--cream-faint)', fontSize: 14 }}>No data yet.</p>
                ) : topLosers.map((p, i) => {
                  const lost = (p.total_wagered || 0) - (p.total_won || 0)
                  const maxLoss = (topLosers[0].total_wagered || 0) - (topLosers[0].total_won || 0)
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPlayer(p)}
                      style={{ padding: '12px 0', borderBottom: i < topLosers.length - 1 ? '1px solid rgba(217,182,90,.08)' : 'none', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--cream-faint)', fontVariantNumeric: 'tabular-nums', width: 16 }}>#{i + 1}</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--gold-l)' }}>{p.display_name || 'Unknown'}</span>
                        </div>
                        <span style={{ color: '#e7708a', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>-{fmt(lost)}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.05)', overflow: 'hidden', marginLeft: 26 }}>
                        <div style={{
                          height: '100%', borderRadius: 999,
                          background: 'linear-gradient(90deg, #e7708a, #6a1325)',
                          width: `${(lost / maxLoss) * 100}%`,
                          transition: 'width .4s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Grant Chips */}
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
          </div>
        )}

        {/* Games tab — live now + full history */}
        {activeTab === 'live' && (() => {
          const GAME_ICONS: Record<string, string> = { blackjack: '🃏', poker: '♠', roulette: '🎰', slots: '🎰', baccarat: '🎴', tower: '🗼' }
          const playerMap = Object.fromEntries(players.map(p => [p.id, p.display_name || p.email || 'Unknown']))
          const activeRooms = rooms.filter(r => r.status === 'active' || r.status === 'solo' || r.status === 'waiting')
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Live Now section */}
              <div style={panelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: 0 }}>
                    <span className="gold-text">Live Now</span>
                    {activeRooms.length > 0 && (
                      <span style={{ marginLeft: 12, width: 8, height: 8, borderRadius: '50%', background: '#5fd99a', display: 'inline-block', boxShadow: '0 0 6px #5fd99a', verticalAlign: 'middle' }} />
                    )}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.05em' }}>
                      {rooms.filter(r => r.status === 'active').length} active · {rooms.filter(r => r.status === 'solo').length} solo
                    </span>
                    <button className="btn btn-sm btn-ghost" onClick={() => load(true)} disabled={refreshing}
                      style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ display: 'inline-block', width: 11, height: 11, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: refreshing ? 'spin360 .7s linear infinite' : 'none' }} />
                      Refresh
                    </button>
                  </div>
                </div>

                {activeRooms.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.08em', fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🎲</div>
                    No active games right now
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeRooms.map(room => {
                      const isActive = room.status === 'active'
                      const isSolo = room.status === 'solo'
                      const accentColor = isActive ? '#5fd99a' : isSolo ? '#d9b65a' : '#8ab4f8'
                      return (
                        <div key={room.code} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 18px', borderRadius: 12,
                          background: isActive ? 'rgba(95,217,154,.05)' : 'rgba(217,182,90,.04)',
                          border: `1px solid ${isActive ? 'rgba(95,217,154,.22)' : 'rgba(217,182,90,.16)'}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: `${accentColor}18`, border: `1px solid ${accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                              {GAME_ICONS[room.game] || '🎲'}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <span style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{room.game}</span>
                                <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999, fontFamily: 'var(--fs-head)', background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}50` }}>
                                  {isActive ? '● Active' : isSolo ? '● Solo' : '⏳ Waiting'}
                                </span>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--cream-dim)' }}>
                                <span style={{ color: 'var(--cream)' }}>{room.host_name || 'Unknown'}</span>
                                {isActive && room.guest_name ? <> vs <span style={{ color: 'var(--cream)' }}>{room.guest_name}</span></> : isSolo ? <span style={{ color: 'var(--cream-faint)' }}> · solo</span> : <span style={{ color: 'var(--cream-faint)' }}> · waiting</span>}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginTop: 2, fontFamily: 'var(--fs-head)', letterSpacing: '.05em' }}>{timeAgo(room.updated_at)}</div>
                            </div>
                          </div>
                          <Link href={`/${room.game}?spectate=${room.code}`} target="_blank" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, textDecoration: 'none', flexShrink: 0, fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, background: 'rgba(217,182,90,.12)', border: '1px solid rgba(217,182,90,.3)', color: 'var(--gold-l)' }}>
                            👁 Spectate
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Game History section */}
              <div style={panelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: 0 }}>
                    <span className="gold-text">Game History</span>
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
                    <input
                      value={sessionSearch}
                      onChange={e => setSessionSearch(e.target.value)}
                      placeholder="Search player or game…"
                      style={{ height: 34, padding: '0 12px', borderRadius: 8, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--gold-l)', fontSize: 13, fontFamily: 'var(--fs-head)', outline: 'none', width: 220 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', whiteSpace: 'nowrap' }}>{allSessions.length} sessions</span>
                  </div>
                </div>
                {allSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.08em', fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                    No game sessions recorded yet
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(217,182,90,.18)' }}>
                          {['Game', 'Player', 'Wagered', 'Won', 'Net P&L', 'When'].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontFamily: 'var(--fs-head)', fontSize: 10, letterSpacing: '.16em', color: 'var(--cream-faint)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allSessions.filter(s => {
                          if (!sessionSearch.trim()) return true
                          const q = sessionSearch.toLowerCase()
                          const name = (playerMap[s.user_id] || '').toLowerCase()
                          return name.includes(q) || s.game.toLowerCase().includes(q)
                        }).map((s, idx) => {
                          const net = s.chips_won - s.chips_wagered
                          const playerName = playerMap[s.user_id] || 'Unknown'
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(217,182,90,.06)' }}>
                              <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 16 }}>{GAME_ICONS[s.game] || '🎲'}</span>
                                  <span style={{ fontFamily: 'var(--fs-head)', fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{s.game}</span>
                                </div>
                              </td>
                              <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--cream)', fontWeight: 600 }}>{playerName}</td>
                              <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--cream-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.chips_wagered)}</td>
                              <td style={{ padding: '11px 14px', fontSize: 13, color: '#5fd99a', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.chips_won)}</td>
                              <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: net >= 0 ? '#5fd99a' : '#e7708a' }}>
                                {net >= 0 ? '+' : ''}{fmt(net)}
                              </td>
                              <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--cream-faint)', whiteSpace: 'nowrap', fontFamily: 'var(--fs-head)', letterSpacing: '.04em' }}>{timeAgo(s.created_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Sports tab */}
        {activeTab === 'sports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['events', 'bettors'] as const).map(t => (
                  <button key={t} onClick={() => setSportsSubTab(t)} style={{
                    fontFamily: 'var(--fs-head)', fontWeight: 600, fontSize: 12,
                    letterSpacing: '.1em', textTransform: 'uppercase',
                    padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: sportsSubTab === t ? 'var(--gold-grad)' : 'rgba(217,182,90,.1)',
                    color: sportsSubTab === t ? '#1a1408' : 'var(--cream-faint)',
                    transition: 'all .15s',
                  }}>
                    {t === 'events' ? 'Events' : 'Bettors'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={handleSyncOdds} disabled={syncing}
                  style={{ opacity: syncing ? .6 : 1, background: 'linear-gradient(135deg,#137a4a,#0c5a37)', border: 'none' }}>
                  {syncing ? '⟳ Syncing…' : '⟳ Sync from Odds API'}
                </button>
                <button className="btn btn-sm" onClick={() => setShowAddEvent(true)}>+ Add Event</button>
              </div>
            </div>

            {sportsSubTab === 'events' && <>
            {/* Add Event form */}
            {showAddEvent && (
              <div style={{ ...panelStyle, padding: 24 }}>
                <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 16, marginBottom: 18 }}>New Event</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Sport</label>
                    <select value={eventForm.sport} onChange={e => setEventForm(f => ({ ...f, sport: e.target.value }))}
                      style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--cream)', fontSize: 14 }}>
                      {['nba','nfl','soccer','mlb','pga','f1','tennis','ufc','esports','nhl','other'].map(s => (
                        <option key={s} value={s}>{s.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Event Date (optional)</label>
                    <input type="datetime-local" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))}
                      style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--cream)', fontSize: 14 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Title *</label>
                  <input placeholder="e.g. Lakers vs Warriors – Game 7" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                    style={{ width: '100%', height: 42, padding: '0 14px', borderRadius: 8, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--cream)', fontSize: 14 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Description (optional)</label>
                  <input placeholder="Additional context…" value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                    style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 8, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--cream)', fontSize: 13 }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Betting Closes (optional)</label>
                  <input type="datetime-local" value={eventForm.closes_at} onChange={e => setEventForm(f => ({ ...f, closes_at: e.target.value }))}
                    style={{ width: 240, height: 40, padding: '0 12px', borderRadius: 8, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--cream)', fontSize: 14 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Options * (min 2)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {eventForm.options.map((opt, i) => (
                      <div key={opt.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input placeholder={`Option ${i + 1} label`} value={opt.label}
                          onChange={e => setEventForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, label: e.target.value } : o) }))}
                          style={{ flex: 1, height: 38, padding: '0 12px', borderRadius: 8, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.2)', color: 'var(--cream)', fontSize: 13 }} />
                        {eventForm.options.length > 2 && (
                          <button onClick={() => setEventForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                            style={{ background: 'none', border: 'none', color: '#e7708a', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                        )}
                      </div>
                    ))}
                    {eventForm.options.length < 4 && (
                      <button onClick={() => setEventForm(f => ({ ...f, options: [...f.options, { id: String.fromCharCode(97 + f.options.length), label: '' }] }))}
                        style={{ alignSelf: 'flex-start', background: 'rgba(217,182,90,.08)', border: '1px dashed rgba(217,182,90,.3)', borderRadius: 8, padding: '6px 14px', color: 'var(--cream-dim)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--fs-head)' }}>
                        + Add Option
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn" onClick={handleCreateEvent} disabled={savingEvent} style={{ opacity: savingEvent ? .6 : 1 }}>
                    {savingEvent ? 'Creating…' : 'Create Event'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowAddEvent(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Event list */}
            {sportsEvents.length === 0 ? (
              <div style={{ ...panelStyle, textAlign: 'center', padding: '40px 20px', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>
                No events yet — add one above
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {sportsEvents.map(event => (
                  <div key={event.id} style={{ ...panelStyle, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--fs-head)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>{event.sport.toUpperCase()}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: 999, fontSize: 10, fontFamily: 'var(--fs-head)', letterSpacing: '.1em', textTransform: 'uppercase',
                            background: event.status === 'open' ? 'rgba(95,217,154,.12)' : event.status === 'settled' ? 'rgba(74,144,217,.12)' : event.status === 'cancelled' ? 'rgba(231,112,138,.1)' : 'rgba(255,255,255,.06)',
                            border: event.status === 'open' ? '1px solid rgba(95,217,154,.3)' : event.status === 'settled' ? '1px solid rgba(74,144,217,.3)' : event.status === 'cancelled' ? '1px solid rgba(231,112,138,.25)' : '1px solid rgba(255,255,255,.12)',
                            color: event.status === 'open' ? '#5fd99a' : event.status === 'settled' ? '#4a90d9' : event.status === 'cancelled' ? '#e7708a' : 'var(--cream-faint)',
                          }}>{event.status}</span>
                          {event.event_date && <span style={{ fontSize: 11, color: 'var(--cream-faint)' }}>{new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--cream)', marginBottom: 6 }}>{event.title}</div>
                        {event.description && <div style={{ fontSize: 12, color: 'var(--cream-dim)', marginBottom: 8 }}>{event.description}</div>}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {event.options.map(opt => (
                            <span key={opt.id} style={{
                              padding: '3px 10px', borderRadius: 999, fontSize: 11, fontFamily: 'var(--fs-head)',
                              background: event.result_option_id === opt.id ? 'rgba(95,217,154,.15)' : 'rgba(255,255,255,.05)',
                              border: event.result_option_id === opt.id ? '1px solid rgba(95,217,154,.4)' : '1px solid rgba(217,182,90,.15)',
                              color: event.result_option_id === opt.id ? '#5fd99a' : 'var(--cream-dim)',
                            }}>{opt.label}{event.result_option_id === opt.id ? ' ✓' : ''}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                        {event.status === 'open' && (
                          <button onClick={() => handleSportsAction(event.id, 'close')} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>Close Betting</button>
                        )}
                        {(event.status === 'open' || event.status === 'closed') && settlingId !== event.id && (
                          <button onClick={() => setSettlingId(event.id)} className="btn btn-sm" style={{ fontSize: 11 }}>Settle</button>
                        )}
                        {settlingId === event.id && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <div style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em', marginBottom: 4 }}>PICK WINNER:</div>
                            {event.options.map(opt => (
                              <button key={opt.id} onClick={() => handleSportsAction(event.id, 'settle', opt.id)}
                                className="btn btn-sm" style={{ fontSize: 11, background: 'var(--gold-grad)', color: '#2a1f08' }}>
                                {opt.label}
                              </button>
                            ))}
                            <button onClick={() => setSettlingId(null)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>Cancel</button>
                          </div>
                        )}
                        {event.status === 'settled' && (
                          <button onClick={() => handleSportsAction(event.id, 'reopen')} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>Re-open</button>
                        )}
                        {event.status !== 'cancelled' && event.status !== 'settled' && (
                          <button onClick={() => handleSportsAction(event.id, 'cancel')} className="btn btn-sm btn-ghost" style={{ fontSize: 11, color: '#e7708a', borderColor: 'rgba(231,112,138,.3)' }}>Cancel & Refund</button>
                        )}
                        <button onClick={() => handleDeleteEvent(event.id)} style={{ background: 'none', border: 'none', color: 'rgba(231,112,138,.5)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--fs-head)', padding: '4px 0' }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            </>}

            {sportsSubTab === 'bettors' && <>
            <div style={panelStyle}>
              <h3 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 16, margin: '0 0 16px', letterSpacing: '.04em' }}>
                <span className="gold-text">Player Bets</span>
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--cream-faint)', marginLeft: 10 }}>
                  {sportsBets.length} total
                </span>
              </h3>
              {sportsBets.length === 0 ? (
                <div style={{ color: 'var(--cream-faint)', fontSize: 13, padding: '20px 0' }}>No bets placed yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(217,182,90,.2)' }}>
                      {['Player', 'Event', 'Pick', 'Wagered', 'Result'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Wagered' ? 'right' : 'left', fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cream-faint)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sportsBets.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(217,182,90,.07)' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--cream)', fontSize: 13, whiteSpace: 'nowrap' }}>{b.display_name}</td>
                        <td style={{ padding: '12px', fontSize: 12, color: 'var(--cream-dim)', maxWidth: 280 }}>
                          <div style={{ fontWeight: 600, color: 'var(--cream)', marginBottom: 2 }}>{b.event_title}</div>
                          <span style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', color: 'var(--gold)', opacity: .7 }}>{b.sport}</span>
                        </td>
                        <td style={{ padding: '12px', fontSize: 12, color: 'var(--cream-dim)' }}>
                          {b.option_label || b.option_id}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cream-dim)', fontSize: 13, whiteSpace: 'nowrap' }}>
                          {fmt(b.chips_wagered)}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          {!b.settled ? (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(217,182,90,.1)', border: '1px solid rgba(217,182,90,.25)', color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.06em' }}>Pending</span>
                          ) : b.won ? (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(95,217,154,.1)', border: '1px solid rgba(95,217,154,.3)', color: '#5fd99a', fontFamily: 'var(--fs-head)', letterSpacing: '.06em' }}>Won +{fmt(b.chips_won - b.chips_wagered)}</span>
                          ) : (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(231,112,138,.08)', border: '1px solid rgba(231,112,138,.25)', color: '#e7708a', fontFamily: 'var(--fs-head)', letterSpacing: '.06em' }}>Lost</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            </>}
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

            {/* Refill button panel */}
            <div style={panelStyle}>
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

            {/* Guest accounts panel */}
            <div style={panelStyle}>
              <h2 style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 20, margin: '0 0 20px' }}>
                <span className="gold-text">Guest Accounts</span>
              </h2>
              <div style={{ color: 'var(--cream-faint)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
                Guest accounts sign in with a PIN instead of Google. The player&apos;s name and PIN are visible in the player list.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  type="text"
                  placeholder="Display name"
                  value={newGuestName}
                  onChange={e => setNewGuestName(e.target.value)}
                  style={{
                    padding: '11px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(217,182,90,.25)',
                    color: 'var(--cream)', fontSize: 14, fontFamily: 'var(--fs-body)', outline: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="PIN (e.g. 2847)"
                  value={newGuestPin}
                  onChange={e => setNewGuestPin(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateGuest() }}
                  style={{
                    padding: '11px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(217,182,90,.25)',
                    color: 'var(--cream)', fontSize: 14, fontFamily: 'var(--fs-body)', outline: 'none',
                    letterSpacing: '0.2em',
                  }}
                />
                <button
                  className="btn btn-sm"
                  onClick={handleCreateGuest}
                  disabled={creatingGuest || !newGuestName.trim() || !newGuestPin.trim()}
                >
                  {creatingGuest ? 'Creating…' : '+ Create Guest Account'}
                </button>
              </div>

              {guests.length > 0 && (
                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, letterSpacing: '.15em', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase', marginBottom: 4 }}>Active Guest Accounts</div>
                  {guests.map(g => (
                    <div key={g.pin} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(0,0,0,.3)', border: '1px solid rgba(217,182,90,.1)',
                    }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--cream)', marginRight: 12 }}>{g.display_name}</span>
                        <code style={{ fontFamily: 'monospace', letterSpacing: '0.2em', color: 'var(--gold-l)', fontWeight: 700, fontSize: 14 }}>{g.pin}</code>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => handleDeleteGuest(g.pin, g.display_name)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
