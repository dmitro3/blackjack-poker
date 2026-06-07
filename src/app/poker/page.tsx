'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PokerGame, BB, fmt, fmtShort, GameSnapshot, LegalActions } from '@/lib/poker-game'
import type { Card } from '@/lib/poker-engine'
import { playDeal, playChip, playWin, playLose, startTension, stopTension, isMuted, setMuted } from '@/lib/casino-sounds'
import { generateCode, prettyCode } from '@/lib/invite-codes'

const SEATS = [
  { name:'You',    avatar:'V' },
  { name:'Marcel', avatar:'M' },
  { name:'Bianca', avatar:'B' },
  { name:'Saxon',  avatar:'S' },
  { name:'Odette', avatar:'O' },
  { name:'Dmitri', avatar:'D' },
]

const POS = [
  { x:50, y:91, bx:0,   by:-72 },
  { x:87, y:65, bx:-70, by:-2  },
  { x:83, y:19, bx:-62, by:18  },
  { x:50, y:7,  bx:0,   by:66  },
  { x:17, y:19, bx:62,  by:18  },
  { x:13, y:65, bx:70,  by:-2  },
]

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function CardComp({ card, faceDown, idx = 0, cls = '' }: {
  card: Card | null; faceDown?: boolean; idx?: number; cls?: string
}) {
  const style = { animationDelay: (idx * 0.07) + 's' } as React.CSSProperties
  if (faceDown || !card) return <div className={'card back ' + cls} style={style} />
  return (
    <div className={'card ' + (card.color === 'red' ? 'red ' : '') + cls} style={style}>
      <div className="pip-tl"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
      <div className="center-suit">{card.suit}</div>
      <div className="pip-br"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
    </div>
  )
}

function SeatComp({ p, pos, snap, isButton, isHero }: {
  p: PokerGame['players'][0]
  pos: typeof POS[0]
  snap: GameSnapshot
  isButton: boolean
  isHero: boolean
}) {
  const active = snap.toAct === p.id && snap.street !== 'handover' && snap.street !== 'idle' && snap.street !== 'showdown'
  const isWinner = snap.lastResult && snap.lastResult.winners.indexOf(p.id) >= 0 && snap.street === 'handover'
  const showCards = snap.lastResult && snap.lastResult.showdown && !p.folded
  const reveal = isHero || !!showCards
  const handName = snap.lastResult?.showdown && snap.lastResult.hands[p.id] && !p.folded
    ? snap.lastResult.hands[p.id].name : null
  const cls = 'seat' + (isHero ? ' you' : '') + (!isHero && p.isBot ? ' bot' : '') +
    (p.folded ? ' folded' : '') + (active ? ' active' : '') + (isWinner ? ' winner' : '')
  const hasHole = p.hole && p.hole.length === 2 && !p.sittingOut

  return (
    <div className={cls} style={{ left: pos.x + '%', top: pos.y + '%' }}>
      {hasHole && handName && <div className="rank-pill">{handName}</div>}
      {hasHole && (
        <div className="holes">
          <CardComp card={p.hole[0]} faceDown={!reveal} idx={0} />
          <CardComp card={p.hole[1]} faceDown={!reveal} idx={1} />
        </div>
      )}
      <div className="pod">
        {!isHero && <span className="tag">{p.isBot ? 'House' : 'Guest'}</span>}
        <div className="av">
          {p.avatar}
          {isButton && <div className="dealer-btn" style={{ bottom: -6, right: -6 }}>D</div>}
        </div>
        <div className="meta">
          <div className="nm">{isHero ? 'You' : p.name}</div>
          <div className="st tabnum">{p.sittingOut ? 'Sitting out' : fmt(p.stack)}</div>
        </div>
        {p.lastAct && <div className="lastact">{p.lastAct}</div>}
      </div>
      {p.bet > 0 && (
        <div className="betchip" style={{ left: `calc(50% + ${pos.bx}px)`, top: `calc(50% + ${pos.by}px)`, transform: 'translate(-50%,-50%)' }}>
          <span className="dot" />{fmtShort(p.bet)}
        </div>
      )}
    </div>
  )
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  const bg = kind === 'win'
    ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)'
    : kind === 'lose'
    ? 'linear-gradient(160deg,#6a1325,#440b18)'
    : 'linear-gradient(180deg,#241f15,#0b0a07)'
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 38, transform: 'translateX(-50%)', zIndex: 9999, padding: '13px 26px', borderRadius: 999, fontFamily: 'Cinzel,serif', fontWeight: 600, letterSpacing: '.05em', boxShadow: '0 14px 40px rgba(0,0,0,.5)', border: '1px solid rgba(217,182,90,.5)', background: bg, color: kind === 'win' ? '#2a1f08' : 'var(--cream)', animation: 'floatUp .35s' }}>
      {msg}
    </div>
  )
}

export default function PokerPage() {
  // Stable supabase client — never recreated across renders
  const supabase = useMemo(() => createClient(), [])

  const gameRef = useRef<PokerGame | null>(null)
  const [snap, setSnap] = useState<GameSnapshot | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [raiseTo, setRaiseTo] = useState(0)
  const [dealing, setDealing] = useState(false)
  const [bal, setBal] = useState(100000)
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null)
  const [muted, setMutedUI] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(true)
  const autoNext = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const sessionStartRef = useRef(100000)

  // ── Multiplayer ────────────────────────────────────────────────────────────
  // modeRef: 'solo' = normal single player, 'host' = invited a friend, 'guest' = joined a friend
  const modeRef = useRef<'solo' | 'host' | 'guest'>('solo')
  const guestSeatRef = useRef<number | null>(null)      // host: which seat belongs to guest
  const myGuestSeatRef = useRef<number | null>(null)    // guest: which seat is mine
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const joinCodeRef = useRef<string | null>(null)

  const [myGuestSeat, setMyGuestSeat] = useState<number | null>(null)
  const [guestConnected, setGuestConnected] = useState(false)
  const [waitingForGuest, setWaitingForGuest] = useState(false)
  const [hostSnap, setHostSnap] = useState<GameSnapshot | null>(null)
  const [hostLegal, setHostLegal] = useState<LegalActions | null>(null)
  const [myDisplayName, setMyDisplayName] = useState('Guest')

  useEffect(() => {
    try { setMutedUI(isMuted()) } catch { /**/ }
  }, [])

  function showToast(msg: string, kind = '') { setToast({ msg, kind }) }

  // ── Init: load profile, detect guest join ──────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('chips, display_name').eq('id', user.id).single()
      if (profile) {
        setBal(profile.chips)
        sessionStartRef.current = profile.chips
        if (profile.display_name) setMyDisplayName(profile.display_name)

        // Check URL for join code
        const params = new URLSearchParams(window.location.search)
        const jc = params.get('join')
        if (jc) {
          // Guest mode — don't create local game
          joinCodeRef.current = jc.toUpperCase()
          modeRef.current = 'guest'
        } else {
          // Host/solo mode — create local game
          const game = new PokerGame(SEATS, profile.chips)
          game.onBankChange = (chips: number) => setBal(chips)
          // Use real display name so guests see the correct name
          if (profile.display_name) {
            game.players[0].name = profile.display_name
            game.players[0].avatar = profile.display_name[0].toUpperCase()
          }
          gameRef.current = game
          setSnap(game.snapshot())
        }
      }
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // ── Guest: subscribe to host's Supabase Realtime channel ──────────────────
  useEffect(() => {
    if (loading || modeRef.current !== 'guest' || !joinCodeRef.current) return
    const jc = joinCodeRef.current

    const channel = supabase.channel(`ht-game-${jc}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'STATE' }, ({ payload }) => {
        const { snap: s, legal: l, guestSeat: gs } = payload as {
          snap: GameSnapshot; legal: LegalActions | null; guestSeat: number | null
        }
        setHostSnap(s)
        setHostLegal(l)
        if (myGuestSeatRef.current === null && gs != null) {
          myGuestSeatRef.current = gs
          setMyGuestSeat(gs)
        }
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'GUEST_JOIN',
            payload: { name: myDisplayName },
          })
        }
      })

    channelRef.current = channel
    return () => { channel.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ── sync: update local snap + broadcast to guest (host only) ──────────────
  const sync = useCallback(() => {
    const g = gameRef.current
    if (!g) return
    const s = { ...g.snapshot() }
    setSnap(s)
    if (modeRef.current === 'host' && channelRef.current) {
      const gs = guestSeatRef.current
      const legal = gs !== null && g.toAct === gs ? g.legal() : null
      channelRef.current.send({
        type: 'broadcast',
        event: 'STATE',
        payload: JSON.parse(JSON.stringify({ snap: g.snapshot(), legal, guestSeat: gs })),
      }).catch(() => {})
    }
  }, [])

  const endHand = useCallback(() => {
    sync()
    stopTension()
    if (autoNext.current) clearTimeout(autoNext.current)
    autoNext.current = setTimeout(() => startHand(), 4200)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync])

  // ── drive: advance game — pauses when it's the guest's turn ───────────────
  const drive = useCallback(() => {
    const g = gameRef.current
    if (!g) return
    if (g.street === 'handover' || g.street === 'idle' || g.street === 'showdown') { sync(); return }
    const p = g.players[g.toAct]
    if (!p) { sync(); return }
    sync()
    if (p.isYou) return  // host's turn — wait for input
    if (guestSeatRef.current !== null && g.toAct === guestSeatRef.current) return  // guest's turn — wait
    // Bot plays
    setTimeout(() => {
      const g2 = gameRef.current
      if (!g2 || g2.street === 'handover') return
      const isGuestTurn = guestSeatRef.current !== null && g2.toAct === guestSeatRef.current
      if (g2.players[g2.toAct] && !g2.players[g2.toAct].isYou && !isGuestTurn) {
        const d = g2.botDecision()
        const ev = g2.apply(d.type, d.amount)
        sync()
        if (ev === 'showdown' || ev === 'win') { endHand() }
        else { drive() }
      }
    }, 850 + Math.random() * 500)
  }, [sync, endHand])

  const startHand = useCallback(async () => {
    if (autoNext.current) clearTimeout(autoNext.current)
    const g = gameRef.current
    if (!g) return
    setDealing(true)
    g.startHand()
    sync()
    for (let i = 0; i < 2; i++) { playDeal(); await sleep(200) }
    await sleep(300)
    setDealing(false)
    if (g.street === 'idle') { sync(); return }
    drive()
  }, [sync, drive])

  // ── act: host/solo action ─────────────────────────────────────────────────
  const act = useCallback((type: string, amount?: number) => {
    const g = gameRef.current
    if (!g) return
    if (g.players[g.toAct] && !g.players[g.toAct].isYou) return
    if (type === 'call' || type === 'raise' || type === 'allin') playChip()
    const ev = g.apply(type, amount)
    sync()
    if (ev === 'showdown' || ev === 'win') { endHand() }
    else { drive() }
  }, [sync, drive, endHand])

  // ── guestAct: guest sends action to host via channel ──────────────────────
  const guestAct = useCallback((type: string, amount?: number) => {
    const channel = channelRef.current
    if (!channel) return
    if (type === 'call' || type === 'raise' || type === 'allin') playChip()
    channel.send({ type: 'broadcast', event: 'ACTION', payload: { type, amount } }).catch(() => {})
  }, [])

  // ── handleInvite: host sets up realtime channel ───────────────────────────
  const handleInvite = useCallback((code: string) => {
    if (modeRef.current !== 'solo') return   // already in a multiplayer game
    modeRef.current = 'host'
    setWaitingForGuest(true)

    const channel = supabase.channel(`ht-game-${code}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'GUEST_JOIN' }, ({ payload }) => {
        const g = gameRef.current!
        const gSeat = 1   // replace bot at seat 1
        guestSeatRef.current = gSeat
        const guestName = (payload.name as string) || 'Guest'
        g.players[gSeat].name = guestName
        g.players[gSeat].avatar = guestName[0].toUpperCase()
        g.players[gSeat].isBot = false

        setGuestConnected(true)
        setWaitingForGuest(false)
        showToast(`${guestName} joined the table!`, 'win')

        // Send full state to new guest immediately
        const gs = guestSeatRef.current
        const legal = g.toAct === gs ? g.legal() : null
        channel.send({
          type: 'broadcast',
          event: 'STATE',
          payload: JSON.parse(JSON.stringify({ snap: g.snapshot(), legal, guestSeat: gs })),
        }).catch(() => {})
        sync()
      })
      .on('broadcast', { event: 'ACTION' }, ({ payload }) => {
        const g = gameRef.current
        const gSeat = guestSeatRef.current
        if (!g || gSeat === null || g.toAct !== gSeat) return
        const { type, amount } = payload as { type: string; amount?: number }
        if (type === 'call' || type === 'raise' || type === 'allin') playChip()
        const ev = g.apply(type, amount)
        sync()
        if (ev === 'showdown' || ev === 'win') { endHand() }
        else { drive() }
      })
      .subscribe()

    channelRef.current = channel
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync, drive, endHand])

  // Cleanup channel on unmount
  useEffect(() => () => { channelRef.current?.unsubscribe() }, [])

  // Start first hand (solo/host only)
  useEffect(() => {
    if (!loading && gameRef.current) {
      const t = setTimeout(() => startHand(), 500)
      return () => { clearTimeout(t); if (autoNext.current) clearTimeout(autoNext.current) }
    }
  }, [loading, startHand])

  // Raise default when it's your turn
  useEffect(() => {
    const isGuest = modeRef.current === 'guest'
    const s = isGuest ? hostSnap : snap
    const hero = isGuest ? (myGuestSeat ?? 0) : 0
    if (!s || s.toAct !== hero || s.players[hero]?.folded) return
    const legal = isGuest ? hostLegal : (gameRef.current?.legal() ?? null)
    if (legal?.canRaise) setRaiseTo(legal.minRaiseTo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.toAct, snap?.street, hostSnap?.toAct, hostSnap?.street])

  // Sounds
  useEffect(() => {
    const s = modeRef.current === 'guest' ? hostSnap : snap
    if (!s) return
    if (s.street === 'showdown') startTension()
    if (s.street === 'handover' && s.lastResult) {
      stopTension()
      const hero = modeRef.current === 'guest' ? (myGuestSeat ?? 0) : 0
      if (s.lastResult.winners.includes(hero)) playWin(); else playLose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.street, snap?.handNo, hostSnap?.street, hostSnap?.handNo])

  // Session logging (host/solo)
  useEffect(() => {
    if (!snap || snap.street !== 'handover' || modeRef.current === 'guest') return
    const diff = bal - sessionStartRef.current
    if (diff !== 0) {
      fetch('/api/game/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'poker', chips_wagered: diff < 0 ? -diff : 0, chips_won: diff > 0 ? diff : 0 }),
      }).catch(() => {})
      sessionStartRef.current = bal
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.handNo, snap?.street])

  // ── Render ─────────────────────────────────────────────────────────────────
  const isGuestMode = modeRef.current === 'guest'

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>Loading…</div>
    </div>
  )

  if (isGuestMode && !hostSnap) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(120% 80% at 50% -10%, #241f15 0%, #13110b 45%, #0b0a07 100%)' }}>
      <div style={{ fontFamily: 'var(--fs-head)', fontSize: 22, letterSpacing: '.1em', color: 'var(--gold-l)', marginBottom: 12 }}>Joining table…</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--fs-head)', fontSize: 13, color: 'var(--cream-faint)', letterSpacing: '.08em' }}>
        <span style={{ width: 14, height: 14, border: '2px solid rgba(217,182,90,.3)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin360 .8s linear infinite' }} />
        Waiting for host to share game state…
      </div>
      <style>{`@keyframes spin360 { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!isGuestMode && (!snap || !gameRef.current)) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>Loading…</div>
    </div>
  )

  // Unified display — guest uses host's snapshot, host uses local snapshot
  const displaySnap = isGuestMode ? hostSnap! : snap!
  const displayPlayers = displaySnap.players
  const heroSeat = isGuestMode ? (myGuestSeat ?? 0) : 0
  const heroPlayer = displayPlayers[heroSeat]
  const game = gameRef.current

  const heroToAct = displaySnap.toAct === heroSeat &&
    heroPlayer && !heroPlayer.folded &&
    (displaySnap.street === 'preflop' || displaySnap.street === 'flop' ||
     displaySnap.street === 'turn' || displaySnap.street === 'river')

  const activeLegal: LegalActions | null = isGuestMode
    ? (heroToAct ? hostLegal : null)
    : (heroToAct && game ? game.legal() : null)

  const doAct = isGuestMode ? guestAct : act
  const buttonSeat = displaySnap.button
  const showResult = displaySnap.street === 'handover' && displaySnap.lastResult
  const safeRaise = activeLegal
    ? Math.min(Math.max(raiseTo, activeLegal.minRaiseTo), activeLegal.maxRaiseTo)
    : 0

  return (
    <div className="table-wrap">
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      <header className="topbar">
        <Link className="back" href="/">← Lobby</Link>
        <div className="title-c">
          <div className="t gold-text">TEXAS HOLD&apos;EM</div>
          <div className="s">
            NO-LIMIT · BLINDS 500/1,000
            {guestConnected && <span style={{ color: '#3ad07a', marginLeft: 8 }}>● LIVE</span>}
            {isGuestMode && <span style={{ color: '#3ad07a', marginLeft: 8 }}>● LIVE</span>}
          </div>
        </div>
        <div className="right">
          <button className="btn btn-sm btn-ghost desk-only" onClick={() => setShowHelp(true)}>How to Play</button>
          {!isGuestMode && (
            <button
              className="btn btn-sm desk-only"
              style={guestConnected ? { background: 'rgba(58,208,122,.15)', borderColor: '#3ad07a', color: '#3ad07a' } : {}}
              onClick={() => {
                if (modeRef.current !== 'solo') return
                const code = generateCode('poker')
                setInviteCode(code)
                setShowInvite(true)
                handleInvite(code)
              }}
            >
              {waitingForGuest ? '⏳ Waiting…' : guestConnected ? '✓ Friend joined' : 'Invite Friend'}
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            style={{ padding: '9px 13px', fontSize: 16 }}
            onClick={() => { const next = !muted; setMutedUI(next); setMuted(next) }}
            title={muted ? 'Unmute' : 'Mute'}
          >{muted ? '🔇' : '🔊'}</button>
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(isGuestMode ? (heroPlayer?.stack ?? bal) : bal)}</span>
          </div>
        </div>
      </header>

      {/* ── Desktop table ── */}
      <div className="felt-stage desk-only">
        <div className="table-oval felt felt-red" />
        <div className={'dealer-plaque' + (dealing ? ' dealing' : '')}>
          <div className="croupier">🤵<span className="bowtie">🎀</span></div>
          Dealer
        </div>
        <div className="center-area">
          {displaySnap.pot > 0 && (
            <div className="pot">
              <span className="coin" /><span className="lbl">Pot</span>
              <span className="v tabnum">{fmt(displaySnap.pot)}</span>
            </div>
          )}
          <div className="board">
            {[0, 1, 2, 3, 4].map(i => (
              displaySnap.community[i]
                ? <CardComp key={i} card={displaySnap.community[i]} idx={i} />
                : <div key={i} className="slot" />
            ))}
          </div>
        </div>
        {showResult && <div className="result-banner">{displaySnap.message}</div>}
        {displayPlayers.map((p, i) => (
          <SeatComp key={i} p={p} pos={POS[i]} snap={displaySnap} isButton={i === buttonSeat} isHero={i === heroSeat} />
        ))}
      </div>

      {/* ── Mobile table ── */}
      <div className="m-table mob-only">
        <div className="m-opps">
          {displayPlayers.filter((_, i) => i !== heroSeat).map(p => {
            const i = p.id
            const active = displaySnap.toAct === i && displaySnap.street !== 'handover' && displaySnap.street !== 'idle' && displaySnap.street !== 'showdown'
            const isWinner = displaySnap.lastResult?.winners.includes(i) && displaySnap.street === 'handover'
            const showCards = !!(displaySnap.lastResult?.showdown && !p.folded)
            return (
              <div key={i} className={`m-opp${active ? ' active' : ''}${p.folded ? ' folded' : ''}${isWinner ? ' winner' : ''}`}>
                {p.hole?.length === 2 && !p.sittingOut && (
                  <div className="m-opp-cards">
                    <CardComp card={p.hole[0]} faceDown={!showCards} />
                    <CardComp card={p.hole[1]} faceDown={!showCards} />
                  </div>
                )}
                <div className={`m-av${p.isBot ? ' bot' : ''}`}>{p.avatar}</div>
                <div className="m-opp-name">{p.name}</div>
                <div className="m-opp-stack">{p.sittingOut ? '—' : fmtShort(p.stack)}</div>
                {p.bet > 0 && <div className="m-opp-bet">{fmtShort(p.bet)}</div>}
                {p.lastAct && <div className="m-opp-act">{p.lastAct}</div>}
                {i === buttonSeat && <div className="m-btn-d">D</div>}
              </div>
            )
          })}
        </div>

        <div className="m-board-area">
          {showResult && <div className="m-result-banner">{displaySnap.message}</div>}
          {displaySnap.pot > 0 && (
            <div className="pot">
              <span className="coin" /><span className="lbl">Pot</span>
              <span className="v tabnum">{fmt(displaySnap.pot)}</span>
            </div>
          )}
          <div className="board">
            {[0, 1, 2, 3, 4].map(i => (
              displaySnap.community[i]
                ? <CardComp key={i} card={displaySnap.community[i]} idx={i} />
                : <div key={i} className="slot" />
            ))}
          </div>
        </div>

        {heroPlayer && (() => {
          const youActive = heroToAct
          const youWinner = displaySnap.lastResult?.winners.includes(heroSeat) && displaySnap.street === 'handover'
          return (
            <div className={`m-you${youActive ? ' active' : ''}${youWinner ? ' winner' : ''}${heroPlayer.folded ? ' folded' : ''}`}>
              <div className="m-you-info">
                <div className={`m-av you${buttonSeat === heroSeat ? ' dealer' : ''}`}>{heroPlayer.avatar}</div>
                <div>
                  <div className="m-you-name">You</div>
                  <div className="m-you-stack">{fmt(isGuestMode ? heroPlayer.stack : bal)}</div>
                </div>
                {heroPlayer.bet > 0 && <div className="m-opp-bet" style={{ position: 'static', transform: 'none', marginLeft: 'auto' }}>{fmtShort(heroPlayer.bet)}</div>}
              </div>
              <div className="m-you-cards">
                {heroPlayer.hole?.length === 2 && !heroPlayer.sittingOut && (
                  <>
                    <CardComp card={heroPlayer.hole[0]} idx={0} />
                    <CardComp card={heroPlayer.hole[1]} idx={1} />
                  </>
                )}
              </div>
              {displaySnap.lastResult?.hands?.[heroSeat]?.name && !heroPlayer.folded && (
                <div className="m-hand-name">{displaySnap.lastResult.hands[heroSeat].name}</div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Control bar ── */}
      <div className="control-bar">
        {!isGuestMode && displaySnap.street === 'idle' && (
          <div className="actions" style={{ flexDirection: 'column' }}>
            <div className="waitmsg" style={{ marginBottom: 6 }}>{displaySnap.message || 'Table paused'}</div>
            <button className="btn" onClick={async () => {
              if (game && game.players[0].stack < BB) {
                const res = await fetch('/api/game/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'refill', chips_wagered: 0, chips_won: 100000 }) })
                if (res.ok) { const d = await res.json(); game.setPlayerStack(d.chips); showToast('Topped up!', 'win') }
              }
              startHand()
            }}>
              {game && game.players[0].stack < BB ? 'Refill & Deal' : 'Deal In'}
            </button>
          </div>
        )}

        {isGuestMode && displaySnap.street === 'idle' && (
          <div className="waitmsg"><span className="spin" />Waiting for host to deal…</div>
        )}

        {heroToAct && activeLegal && (
          <>
            <div className="actions">
              <button className="btn btn-danger" onClick={() => doAct('fold')}>Fold</button>
              {activeLegal.canCheck
                ? <button className="btn btn-ghost" onClick={() => doAct('check')}>Check</button>
                : <button className="btn btn-ghost" onClick={() => doAct('call')}>Call {fmtShort(activeLegal.toCall)}</button>
              }
            </div>
            {activeLegal.canRaise && (
              <div className="raise-box">
                <div className="raise-top">
                  <input
                    type="number"
                    min={activeLegal.minRaiseTo}
                    max={activeLegal.maxRaiseTo}
                    step={BB}
                    value={raiseTo || ''}
                    placeholder={fmt(activeLegal.minRaiseTo)}
                    onChange={e => setRaiseTo(parseInt(e.target.value, 10) || 0)}
                    onBlur={() => setRaiseTo(safeRaise)}
                    onKeyDown={e => { if (e.key === 'Enter') doAct(safeRaise >= activeLegal.maxRaiseTo ? 'allin' : 'raise', safeRaise) }}
                  />
                </div>
                <div className="quick">
                  <button onClick={() => setRaiseTo(Math.min(activeLegal.maxRaiseTo, Math.max(activeLegal.minRaiseTo, Math.round((activeLegal.pot * 0.5) / BB) * BB + activeLegal.toCall)))}>½ Pot</button>
                  <button onClick={() => setRaiseTo(Math.min(activeLegal.maxRaiseTo, Math.max(activeLegal.minRaiseTo, Math.round(activeLegal.pot / BB) * BB + activeLegal.toCall)))}>Pot</button>
                  <button onClick={() => setRaiseTo(activeLegal.maxRaiseTo)}>All-in</button>
                </div>
              </div>
            )}
            {activeLegal.canRaise && (
              <div className="actions">
                <button className="btn" onClick={() => doAct(safeRaise >= activeLegal.maxRaiseTo ? 'allin' : 'raise', safeRaise)}>
                  {activeLegal.canCheck && activeLegal.toCall === 0 ? 'Bet' : 'Raise to'} {fmtShort(safeRaise)}
                </button>
              </div>
            )}
          </>
        )}

        {!heroToAct && displaySnap.street !== 'idle' && !showResult && (
          <div className="waitmsg">
            <span className="spin" />
            {dealing ? 'Dealing…' : (displayPlayers[displaySnap.toAct]?.name + ' is deciding…')}
          </div>
        )}

        {showResult && (
          <div className="actions" style={{ flexDirection: 'column' }}>
            <div className="waitmsg" style={{ marginBottom: 4 }}>{displaySnap.message}</div>
            {!isGuestMode
              ? <button className="btn" onClick={() => startHand()}>Next Hand →</button>
              : <div className="waitmsg" style={{ fontSize: 12 }}><span className="spin" />Waiting for next hand…</div>
            }
          </div>
        )}
      </div>

      {/* Waiting for guest banner */}
      {waitingForGuest && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'rgba(11,10,7,.92)', border: '1px solid rgba(217,182,90,.35)', borderRadius: 14, padding: '12px 24px', fontFamily: 'var(--fs-head)', fontSize: 13, color: 'var(--cream-dim)', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 14, height: 14, border: '2px solid rgba(217,182,90,.3)', borderTopColor: 'var(--gold)', borderRadius: '50%', display: 'inline-block', animation: 'spin360 .8s linear infinite' }} />
          Waiting for friend to join with code <strong style={{ color: 'var(--gold-l)', letterSpacing: '.1em' }}>{prettyCode(inviteCode)}</strong>…
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-bg" onClick={() => setShowInvite(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()}>
            <button className="x" onClick={() => setShowInvite(false)}>×</button>
            <h2 className="gold-text">Invite a friend</h2>
            <p>Share this code. Your friend enters it in the lobby&apos;s <strong style={{ color: 'var(--cream)' }}>Join Game</strong> button, and they&apos;ll sit at your table and replace a bot.</p>
            <div style={{ textAlign: 'center', margin: '18px 0' }}>
              <div style={{ fontFamily: 'var(--fs-head)', fontSize: 36, fontWeight: 800, letterSpacing: '.15em', color: 'var(--gold-l)', background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.3)', borderRadius: 14, padding: '18px 28px', display: 'inline-block' }}>
                {prettyCode(inviteCode)}
              </div>
            </div>
            <div className="invite-field">
              <button className="btn" style={{ flex: 1 }} onClick={() => navigator.clipboard.writeText(prettyCode(inviteCode)).then(() => showToast('Code copied!', 'win'))}>
                Copy Code
              </button>
            </div>
            <div className="seatnote">
              {waitingForGuest
                ? '⏳ Waiting for your friend to join…'
                : guestConnected
                ? '✓ Friend is connected — playing live!'
                : 'Blinds 500 / 1,000 · No-limit · 6 seats.'}
            </div>
          </div>
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div className="modal-bg" onClick={() => setShowHelp(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto', width: 520 }}>
            <button className="x" onClick={() => setShowHelp(false)}>×</button>
            <h2 className="gold-text">How to Play Texas Hold&apos;em</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.65 }}>
              <p><strong style={{ color: 'var(--cream)' }}>Objective:</strong> Make the best 5-card hand using any combination of your 2 hole cards and 5 community cards.</p>
              <p><strong style={{ color: 'var(--cream)' }}>Blinds:</strong> Each hand starts with a Small Blind (500) and Big Blind (1,000) posted by two players.</p>
              <div>
                <strong style={{ color: 'var(--cream)' }}>The Streets:</strong>
                <ul style={{ margin: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li><strong style={{ color: 'var(--cream)' }}>Preflop</strong> — 2 hole cards dealt; first betting round.</li>
                  <li><strong style={{ color: 'var(--cream)' }}>Flop</strong> — 3 community cards; second betting round.</li>
                  <li><strong style={{ color: 'var(--cream)' }}>Turn</strong> — 1 more card; third betting round.</li>
                  <li><strong style={{ color: 'var(--cream)' }}>River</strong> — final card; last betting round.</li>
                  <li><strong style={{ color: 'var(--cream)' }}>Showdown</strong> — best hand wins.</li>
                </ul>
              </div>
              <div>
                <strong style={{ color: 'var(--cream)' }}>Actions: </strong>
                Fold · Check · Call · Raise · All-in
              </div>
              <div>
                <strong style={{ color: 'var(--cream)' }}>Hand Rankings:</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', margin: '8px 0 0 0', fontSize: 13 }}>
                  {[['Royal Flush', 'A K Q J 10 suited'], ['Straight Flush', '5 suited in sequence'], ['Four of a Kind', '4 matching ranks'], ['Full House', '3 of a kind + pair'], ['Flush', '5 cards same suit'], ['Straight', '5 in sequence'], ['Three of a Kind', '3 matching ranks'], ['Two Pair', 'two pairs'], ['Pair', 'two matching cards'], ['High Card', 'none of the above']].map(([name, desc]) => (
                    <div key={name}><span style={{ color: 'var(--gold-l)', fontWeight: 600 }}>{name}</span><span style={{ color: 'var(--cream-faint)', fontSize: 11, display: 'block' }}>{desc}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        html, body { height: 100%; overflow: hidden; }
        .table-wrap { height: 100vh; height: 100svh; display: flex; flex-direction: column; }
        .topbar { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;z-index:30;background:linear-gradient(180deg, rgba(11,10,7,.95), rgba(11,10,7,.2)); }
        .back { display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--cream-dim);font-family:var(--fs-head);font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;border-radius:999px;border:1px solid rgba(217,182,90,.25);transition:.2s; }
        .back:hover { color:var(--gold-l);border-color:var(--gold); }
        .title-c { text-align:center; }
        .title-c .t { font-family:var(--fs-display);font-weight:900;font-size:20px;letter-spacing:.14em; }
        .title-c .s { font-family:var(--fs-head);font-size:9px;letter-spacing:.4em;color:var(--cream-faint); }
        .topbar .right { display:flex;align-items:center;gap:12px; }
        .felt-stage { flex:1;position:relative;margin:44px 30px 22px;min-height:0; }
        .table-oval { position:absolute;inset:4% 3%;border-radius:46% / 50%;border:1px solid rgba(217,182,90,.3);box-shadow:var(--shadow-pop); }
        .table-oval::after { content:"";position:absolute;inset:20px;border-radius:46% / 50%;border:2px solid rgba(217,182,90,.16); }
        .dealer-plaque { position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% - 118px));text-align:center;font-family:var(--fs-head);letter-spacing:.28em;font-size:9px;color:var(--cream-faint);text-transform:uppercase;z-index:3; }
        .dealer-plaque .croupier { width:52px;height:52px;border-radius:50%;margin:0 auto 6px;background:linear-gradient(160deg,#2a1f12,#140e08);border:1px solid rgba(217,182,90,.45);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(243,221,150,.2);position:relative; }
        .dealer-plaque .croupier .bowtie { position:absolute;bottom:7px;font-size:11px; }
        .dealer-plaque.dealing .croupier { animation:pulseGold 1s ease infinite; }
        .center-area { position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% + 22px));display:flex;flex-direction:column;align-items:center;gap:12px;z-index:4; }
        .pot { display:inline-flex;align-items:center;gap:9px;padding:7px 18px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(217,182,90,.4);font-family:var(--fs-head);font-weight:700; }
        .pot .coin { width:18px;height:18px;border-radius:50%;background:var(--gold-grad);box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .pot .v { color:var(--gold-l);font-size:16px; }
        .pot .lbl { font-size:9px;letter-spacing:.2em;color:var(--cream-faint);text-transform:uppercase; }
        .board { display:flex;gap:7px;min-height:96px;align-items:center; }
        .board .card { --w:66px;animation:dealIn .45s cubic-bezier(.2,.9,.25,1) backwards; }
        .board .slot { width:66px;height:94px;border-radius:8px;border:1px dashed rgba(217,182,90,.16); }
        .seat { position:absolute;width:178px;transform:translate(-50%,-50%);z-index:5; }
        .seat .pod { display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;background:linear-gradient(180deg, rgba(27,24,16,.96), rgba(11,10,7,.96));border:1px solid rgba(217,182,90,.28);box-shadow:0 8px 22px rgba(0,0,0,.5);position:relative;transition:.2s; }
        .seat.active .pod { border-color:var(--gold-l);box-shadow:0 0 0 2px rgba(217,182,90,.55), 0 10px 26px rgba(0,0,0,.5); }
        .seat.folded .pod { opacity:.4;filter:grayscale(.7); }
        .seat .av { width:42px;height:42px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-family:var(--fs-head);font-weight:800;font-size:18px;color:#2a1f08;background:var(--gold-grad);box-shadow:inset 0 1px 0 rgba(255,255,255,.5);position:relative; }
        .seat.bot .av { background:linear-gradient(160deg,#3a3327,#221d12);color:var(--gold-l);border:1px solid rgba(217,182,90,.4); }
        .seat .meta { min-width:0;flex:1; }
        .seat .nm { font-family:var(--fs-head);font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--cream); }
        .seat .st { font-size:12px;color:var(--gold-l);font-variant-numeric:tabular-nums;font-weight:600; }
        .seat .tag { position:absolute;top:-9px;right:10px;font-size:8px;letter-spacing:.14em;text-transform:uppercase;background:rgba(217,182,90,.18);border:1px solid rgba(217,182,90,.4);color:var(--gold-l);padding:2px 6px;border-radius:6px; }
        .seat .lastact { position:absolute;bottom:-10px;left:50%;transform:translate(-50%,100%);font-size:10px;letter-spacing:.06em;color:var(--cream-dim);background:rgba(0,0,0,.55);padding:2px 9px;border-radius:6px;white-space:nowrap;border:1px solid rgba(217,182,90,.2);z-index:6; }
        .dealer-btn { position:absolute;width:25px;height:25px;border-radius:50%;background:var(--ivory);color:#1a130a;font-family:var(--fs-head);font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.5);z-index:7;border:1px solid var(--gold-d); }
        .holes { display:flex;gap:4px;justify-content:center;margin-bottom:8px; }
        .holes .card { --w:46px;animation:dealIn .4s cubic-bezier(.2,.9,.25,1) backwards; }
        .seat.you .holes .card { --w:60px; }
        .seat .betchip { position:absolute;display:flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.62);border:1px solid rgba(217,182,90,.45);font-size:11px;font-weight:700;color:var(--gold-l);white-space:nowrap;z-index:6; }
        .seat .betchip .dot { width:11px;height:11px;border-radius:50%;background:var(--gold-grad);flex:0 0 auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .seat.winner .pod { border-color:var(--gold-l);box-shadow:0 0 0 2px var(--gold), 0 0 32px rgba(217,182,90,.65); }
        .rank-pill { position:absolute;left:50%;transform:translateX(-50%);top:-12px;font-size:9px;letter-spacing:.06em;background:var(--gold-grad);color:#2a1f08;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap;z-index:8;text-transform:uppercase; }
        .control-bar { padding:14px 24px 18px;min-height:116px;display:flex;align-items:center;justify-content:center;gap:20px;z-index:20;border-top:1px solid rgba(217,182,90,.16);background:linear-gradient(0deg, rgba(11,10,7,.7), transparent); }
        .actions { display:flex;gap:12px;align-items:center; }
        .actions .btn { min-width:122px; }
        .raise-box { display:flex;flex-direction:column;gap:9px;align-items:stretch;width:300px; }
        .raise-top { display:flex;align-items:center; }
        .raise-top input[type=number] { flex:1;background:rgba(0,0,0,.45);border:1.5px solid rgba(217,182,90,.4);border-radius:10px;padding:8px 14px;color:var(--gold-l);font-family:var(--fs-head);font-weight:800;font-size:18px;font-variant-numeric:tabular-nums;text-align:center;outline:none;width:100%; }
        .raise-top input[type=number]:focus { border-color:var(--gold);box-shadow:0 0 0 2px rgba(217,182,90,.2); }
        .raise-top input[type=number]::-webkit-inner-spin-button,.raise-top input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        .quick { display:flex;gap:7px; }
        .quick button { flex:1;font-family:var(--fs-head);font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:7px 0;border-radius:8px;background:rgba(217,182,90,.1);border:1px solid rgba(217,182,90,.3);color:var(--gold-l);cursor:pointer;transition:.15s; }
        .quick button:hover { background:rgba(217,182,90,.22); }
        .waitmsg { font-family:var(--fs-head);letter-spacing:.08em;color:var(--cream-dim);font-size:14px;display:flex;align-items:center;gap:10px; }
        .waitmsg .spin { width:14px;height:14px;border:2px solid rgba(217,182,90,.3);border-top-color:var(--gold);border-radius:50%;animation:spin360 .8s linear infinite; }
        @keyframes spin360 { to { transform: rotate(360deg); } }
        .result-banner { position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% - 96px));z-index:9;text-align:center;font-family:var(--fs-display);font-weight:900;font-size:22px;padding:12px 30px;border-radius:14px;animation:floatUp .35s;background:var(--gold-grad);color:#2a1f08;box-shadow:0 18px 50px rgba(0,0,0,.6);max-width:76%; }
        .modal-bg { position:fixed;inset:0;background:rgba(5,4,2,.72);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:center;justify-content:center;animation:floatUp .2s; }
        .modal { width:460px;max-width:92vw;padding:32px;border-radius:var(--radius-lg);position:relative; }
        .modal h2 { font-family:var(--fs-head);font-weight:700;font-size:24px;margin:0 0 6px; }
        .modal p { color:var(--cream-dim);font-size:14px;line-height:1.55;margin:0 0 20px; }
        .invite-field { display:flex;gap:10px; }
        .invite-field input { flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(217,182,90,.3);border-radius:10px;padding:0 14px;color:var(--gold-l);font-size:13px;height:46px; }
        .modal .x { position:absolute;top:16px;right:18px;background:none;border:none;color:var(--cream-faint);font-size:24px;cursor:pointer;line-height:1; }
        .modal .x:hover { color:var(--gold-l); }
        .seatnote { margin-top:18px;font-size:12px;color:var(--cream-faint);line-height:1.5;border-top:1px solid rgba(217,182,90,.15);padding-top:14px; }
        .mob-only { display: none; }
        @media (min-width: 641px) and (max-width: 1200px) {
          .topbar { padding: 9px 16px !important; }
          .title-c .s { display: none !important; }
          .felt-stage { margin: 6px 14px 4px !important; overflow: visible !important; }
          .dealer-plaque { transform: translate(-50%, calc(-50% - 86px)) !important; }
          .dealer-plaque .croupier { width: 42px !important; height: 42px !important; font-size: 19px !important; }
          .center-area { transform: translate(-50%, calc(-50% + 12px)) !important; gap: 8px !important; }
          .board { min-height: 72px !important; gap: 5px !important; }
          .board .card { --w: 52px !important; }
          .board .slot { width: 52px !important; height: 73px !important; }
          .seat { width: 154px !important; }
          .seat .pod { padding: 5px 9px !important; gap: 7px !important; }
          .seat .av { width: 32px !important; height: 32px !important; font-size: 13px !important; }
          .seat .nm { font-size: 11px !important; }
          .seat .st { font-size: 11px !important; }
          .holes .card { --w: 32px !important; }
          .seat.you .holes .card { --w: 36px !important; }
          .holes { margin-bottom: 5px !important; }
          .control-bar { padding: 7px 16px 9px !important; min-height: 72px !important; gap: 12px !important; }
          .actions .btn { min-width: 100px !important; font-size: 13px !important; }
          .raise-box { width: 244px !important; gap: 5px !important; }
          .raise-top input[type=number] { font-size: 15px !important; padding: 5px 10px !important; }
          .quick button { padding: 5px 0 !important; font-size: 10px !important; }
          .result-banner { font-size: 18px !important; padding: 8px 20px !important; transform: translate(-50%, calc(-50% - 72px)) !important; }
        }
        @media (max-width: 640px) {
          .desk-only { display: none !important; }
          .mob-only { display: flex !important; }
          .topbar { padding: 10px 14px !important; }
          .topbar .title-c .t { font-size: 15px !important; }
          .topbar .title-c .s { display: none; }
          .topbar .right { gap: 8px !important; }
          .m-table { flex: 1; flex-direction: column; background: radial-gradient(180% 120% at 50% 0%, #8a1c30 0%, #6a1325 42%, #440b18 100%); padding: 10px 8px 6px; gap: 8px; overflow: hidden; min-height: 0; }
          .m-opps { display: flex; gap: 7px; overflow-x: auto; flex: 0 0 auto; padding-bottom: 6px; scrollbar-width: none; }
          .m-opps::-webkit-scrollbar { display: none; }
          .m-opp { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 0 0 auto; width: 62px; padding: 6px 4px 10px; border-radius: 12px; background: rgba(0,0,0,.45); border: 1px solid rgba(217,182,90,.2); position: relative; transition: .2s; }
          .m-opp.active { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(217,182,90,.4); }
          .m-opp.folded { opacity: .3; filter: grayscale(.8); }
          .m-opp.winner { border-color: var(--gold); box-shadow: 0 0 14px rgba(217,182,90,.6); }
          .m-opp-cards { display: flex; gap: 2px; margin-bottom: 2px; }
          .m-opp-cards .card { --w: 26px !important; animation: none !important; }
          .m-av { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--fs-head); font-weight: 800; font-size: 14px; flex: 0 0 auto; }
          .m-av.bot { background: linear-gradient(160deg,#3a3327,#221d12); color: var(--gold-l); border: 1px solid rgba(217,182,90,.35); }
          .m-av.you { background: var(--gold-grad); color: #2a1f08; }
          .m-av.dealer::after { content:'D'; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: var(--ivory); color: #1a130a; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; bottom: -2px; right: -2px; border: 1px solid var(--gold-d); }
          .m-opp-name { font-size: 9px; color: var(--cream-dim); font-family: var(--fs-head); letter-spacing: .04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 58px; }
          .m-opp-stack { font-size: 11px; color: var(--gold-l); font-weight: 700; font-variant-numeric: tabular-nums; }
          .m-opp-bet { position: absolute; bottom: -9px; left: 50%; transform: translateX(-50%); font-size: 9px; color: var(--gold-l); background: rgba(0,0,0,.75); border: 1px solid rgba(217,182,90,.45); padding: 1px 6px; border-radius: 6px; white-space: nowrap; z-index: 5; }
          .m-opp-act { position: absolute; top: -9px; left: 50%; transform: translateX(-50%); font-size: 8px; color: var(--cream-dim); background: rgba(0,0,0,.7); border: 1px solid rgba(217,182,90,.2); padding: 1px 5px; border-radius: 5px; white-space: nowrap; z-index: 5; }
          .m-btn-d { position: absolute; top: -9px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: var(--ivory); color: #1a130a; font-family: var(--fs-head); font-weight: 800; font-size: 9px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--gold-d); z-index: 6; }
          .m-board-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 0; }
          .m-result-banner { font-family: var(--fs-display); font-weight: 900; font-size: 18px; padding: 9px 22px; border-radius: 12px; background: var(--gold-grad); color: #2a1f08; box-shadow: 0 10px 30px rgba(0,0,0,.5); text-align: center; }
          .m-board-area .board { gap: 5px !important; }
          .m-board-area .board .card { --w: 54px !important; }
          .m-board-area .board .slot { width: 54px !important; height: 76px !important; }
          .m-you { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: rgba(0,0,0,.55); border: 1px solid rgba(217,182,90,.35); border-radius: 16px; position: relative; transition: .2s; }
          .m-you.active { border-color: var(--gold); box-shadow: 0 0 0 2px rgba(217,182,90,.4); }
          .m-you.winner { border-color: var(--gold); box-shadow: 0 0 20px rgba(217,182,90,.55); }
          .m-you.folded { opacity: .5; }
          .m-you-info { display: flex; align-items: center; gap: 8px; }
          .m-you-name { font-family: var(--fs-head); font-weight: 700; font-size: 13px; color: var(--cream); }
          .m-you-stack { font-size: 12px; color: var(--gold-l); font-weight: 600; font-variant-numeric: tabular-nums; }
          .m-you-cards { display: flex; gap: 6px; }
          .m-you-cards .card { --w: 58px !important; }
          .m-hand-name { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); font-size: 9px; letter-spacing: .06em; background: var(--gold-grad); color: #2a1f08; font-weight: 800; padding: 2px 8px; border-radius: 6px; white-space: nowrap; z-index: 8; text-transform: uppercase; }
          .control-bar { flex-wrap: wrap; gap: 8px !important; padding: 10px 12px 14px !important; min-height: unset !important; }
          .actions .btn { min-width: 80px !important; font-size: 13px !important; padding: 12px 14px !important; flex: 1; }
          .raise-box { width: 100% !important; }
          .quick button { padding: 9px 0 !important; font-size: 12px !important; }
        }
      `}</style>
    </div>
  )
}
