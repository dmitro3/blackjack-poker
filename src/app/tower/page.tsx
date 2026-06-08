'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const FLOORS = [
  { bombs: 1, mult: 1.4 },
  { bombs: 1, mult: 2.0 },
  { bombs: 1, mult: 3.0 },
  { bombs: 1, mult: 4.5 },
  { bombs: 2, mult: 12 },
  { bombs: 2, mult: 35 },
  { bombs: 2, mult: 100 },
  { bombs: 2, mult: 300 },
]
const BET_OPTIONS = [1000, 5000, 10000, 25000, 50000]

const SAFE_CARDS = [
  { rank: 'A', suit: '♠', red: false },
  { rank: 'K', suit: '♥', red: true },
  { rank: 'Q', suit: '♦', red: true },
  { rank: 'J', suit: '♠', red: false },
  { rank: 'A', suit: '♦', red: true },
  { rank: 'K', suit: '♠', red: false },
  { rank: 'A', suit: '♥', red: true },
  { rank: 'A', suit: '♣', red: false },
]

function fmt(n: number) { return Number(n).toLocaleString('en-US') }
function mLabel(m: number) { return m >= 10 ? m + '×' : m.toFixed(1) + '×' }

function genBombs(): number[][] {
  return FLOORS.map(({ bombs }) => {
    const avail = [0, 1, 2]
    const res: number[] = []
    for (let i = 0; i < bombs; i++) {
      const idx = Math.floor(Math.random() * avail.length)
      res.push(...avail.splice(idx, 1))
    }
    return res
  })
}

type Phase = 'idle' | 'playing' | 'dead' | 'won'
type TileState = 'unknown' | 'active' | 'safe' | 'bomb' | 'reveal-bomb' | 'reveal-safe'

function TileCard({ state, onClick, floorIdx }: {
  state: TileState
  onClick?: () => void
  floorIdx: number
}) {
  const safe = SAFE_CARDS[floorIdx % SAFE_CARDS.length]
  const w = 82

  if (state === 'unknown') {
    return (
      <div className="card back" style={{ '--w': w + 'px', opacity: 0.35, cursor: 'default' } as React.CSSProperties} />
    )
  }
  if (state === 'active') {
    return (
      <div
        className="card back"
        onClick={onClick}
        style={{ '--w': w + 'px', cursor: 'pointer', boxShadow: '0 0 0 3px var(--gold-l), 0 0 28px rgba(217,182,90,.7), 0 8px 24px rgba(0,0,0,.5)', transform: 'translateY(-6px)', transition: 'all .15s' } as React.CSSProperties}
      />
    )
  }
  if (state === 'safe') {
    return (
      <div className={'card' + (safe.red ? ' red' : '')} style={{ '--w': w + 'px', boxShadow: '0 0 20px rgba(95,217,154,.5), 0 8px 20px rgba(0,0,0,.45)' } as React.CSSProperties}>
        <div className="pip-tl"><div className="rank">{safe.rank}</div><div className="pip-suit">{safe.suit}</div></div>
        <div className="center-suit">{safe.suit}</div>
        <div className="pip-br"><div className="rank">{safe.rank}</div><div className="pip-suit">{safe.suit}</div></div>
      </div>
    )
  }
  if (state === 'bomb') {
    return (
      <div className="card" style={{ '--w': w + 'px', background: 'linear-gradient(160deg,#3a0808,#1a0404)', color: '#ef4444', boxShadow: '0 0 24px rgba(239,68,68,.6), 0 8px 20px rgba(0,0,0,.5)' } as React.CSSProperties}>
        <div className="pip-tl"><div className="rank">💀</div></div>
        <div className="center-suit" style={{ fontSize: w * 0.38 }}>💀</div>
        <div className="pip-br"><div className="rank">💀</div></div>
      </div>
    )
  }
  if (state === 'reveal-bomb') {
    return (
      <div className="card" style={{ '--w': w + 'px', background: 'linear-gradient(160deg,#2a0606,#140303)', opacity: 0.7, color: '#ef4444' } as React.CSSProperties}>
        <div className="pip-tl"><div className="rank">💣</div></div>
        <div className="center-suit" style={{ fontSize: w * 0.36 }}>💣</div>
        <div className="pip-br"><div className="rank">💣</div></div>
      </div>
    )
  }
  // reveal-safe
  return (
    <div className={'card' + (safe.red ? ' red' : '')} style={{ '--w': w + 'px', opacity: 0.55 } as React.CSSProperties}>
      <div className="pip-tl"><div className="rank">{safe.rank}</div><div className="pip-suit">{safe.suit}</div></div>
      <div className="center-suit">{safe.suit}</div>
      <div className="pip-br"><div className="rank">{safe.rank}</div><div className="pip-suit">{safe.suit}</div></div>
    </div>
  )
}

export default function TowerPage() {
  const [bal, setBal] = useState(100000)
  const [bet, setBet] = useState(5000)
  const [phase, setPhase] = useState<Phase>('idle')
  const [floor, setFloor] = useState(0)
  const [bombMap, setBombMap] = useState<number[][]>([])
  const [picks, setPicks] = useState<(number | null)[]>(Array(8).fill(null))
  const [payout, setPayout] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('chips').eq('id', user.id).single()
      if (p) setBal(p.chips)
      setLoading(false)
    }
    init()
  }, [router])

  const safePayoutNow = phase === 'playing' && floor > 0
    ? Math.round(bet * FLOORS[floor - 1].mult)
    : 0

  function startGame() {
    if (bet <= 0 || bet > bal) return
    setBal(b => b - bet)
    setBombMap(genBombs())
    setPicks(Array(8).fill(null))
    setFloor(0)
    setPayout(0)
    setPhase('playing')
  }

  function pickTile(tileIdx: number) {
    if (phase !== 'playing') return
    const isBomb = bombMap[floor].includes(tileIdx)
    const newPicks = [...picks]
    newPicks[floor] = tileIdx
    setPicks(newPicks)

    if (isBomb) {
      setPhase('dead')
      fetch('/api/game/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'tower', chips_wagered: bet, chips_won: 0 }),
      }).catch(() => {})
    } else {
      const earned = Math.round(bet * FLOORS[floor].mult)
      if (floor >= FLOORS.length - 1) {
        setBal(b => b + earned)
        setPayout(earned)
        setPhase('won')
        fetch('/api/game/session', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: 'tower', chips_wagered: bet, chips_won: earned }),
        }).catch(() => {})
      } else {
        setFloor(floor + 1)
      }
    }
  }

  function cashOut() {
    if (phase !== 'playing' || floor === 0) return
    const earned = safePayoutNow
    setBal(b => b + earned)
    setPayout(earned)
    setPhase('won')
    fetch('/api/game/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'tower', chips_wagered: bet, chips_won: earned }),
    }).catch(() => {})
  }

  function reset() {
    setPhase('idle')
    setPicks(Array(8).fill(null))
    setBombMap([])
    setPayout(0)
  }

  // Which floor to show in the big card view
  const displayFloor = phase === 'won' && picks[floor] === null ? floor - 1 : floor

  function getTileState(fi: number, ti: number): TileState {
    if (phase === 'idle') return 'unknown'
    if (phase === 'playing') return 'active'
    if (phase === 'dead') {
      if (picks[fi] === ti) return 'bomb'
      return bombMap[fi]?.includes(ti) ? 'reveal-bomb' : 'reveal-safe'
    }
    // won
    if (picks[fi] === ti) return 'safe'
    return 'reveal-safe'
  }

  // History: floors cleared before displayFloor
  const historyFloors = Array.from({ length: displayFloor }, (_, i) => i)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>Loading…</div>
    </div>
  )

  return (
    <div className="twr-wrap">

      <header className="topbar">
        <Link className="back" href="/">← Lobby</Link>
        <div className="title-c">
          <div className="t gold-text">TOWER OF CHANCE</div>
          <div className="s">CLIMB · RISK · CLAIM · 300× MAX</div>
        </div>
        <div className="right">
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(bal)}</span>
          </div>
        </div>
      </header>

      <div className="twr-stage">

        {/* Main tower view */}
        <div className="twr-main">

          {/* Progress dots — 8 circles */}
          <div className="twr-progress">
            {FLOORS.map((_, i) => {
              const cleared = phase !== 'idle' && i < displayFloor
              const active = phase !== 'idle' && i === displayFloor
              const dead = phase === 'dead' && i === displayFloor
              return (
                <div key={i} className={`twr-dot ${cleared ? 'cleared' : active ? (dead ? 'dead' : 'active') : 'upcoming'}`}>
                  {cleared ? '✓' : i + 1}
                </div>
              )
            })}
          </div>

          {/* Floor label */}
          {phase !== 'idle' ? (
            <div className="twr-floor-label">
              <span className="twr-fl-num">Floor {displayFloor + 1} of 8</span>
              <span className="twr-fl-mult" style={{ color: FLOORS[displayFloor].mult >= 10 ? 'var(--gold-l)' : 'var(--cream-dim)' }}>
                {mLabel(FLOORS[displayFloor].mult)}
              </span>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 40, color: 'var(--gold-l)', opacity: 0.3, letterSpacing: '.08em' }}>TOWER</div>
              <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.3em', color: 'var(--cream-faint)', marginTop: 4 }}>SET YOUR BET AND CLIMB</div>
            </div>
          )}

          {/* Big cards — animated on floor change */}
          <div key={`cards-${displayFloor}-${phase}`} className="twr-big-cards" style={phase === 'idle' ? { opacity: 0.22, pointerEvents: 'none' } : undefined}>
            {[0, 1, 2].map(ti => (
              <TileCard
                key={ti}
                state={phase === 'idle' ? 'unknown' : getTileState(displayFloor, ti)}
                onClick={phase === 'playing' ? () => pickTile(ti) : undefined}
                floorIdx={displayFloor}
              />
            ))}
          </div>

          {/* Phase result message */}
          {phase === 'dead' && (
            <div className="twr-phase-msg dead">💀 Eliminated — Floor {floor + 1}</div>
          )}
          {phase === 'won' && (
            <div className="twr-phase-msg won">🏆 +{fmt(payout)}</div>
          )}

          {/* History strip — cleared floors */}
          {historyFloors.length > 0 && (
            <div className="twr-history">
              {historyFloors.map(i => (
                <div key={i} className="twr-hist-item">
                  <span className="twr-hist-fl">F{i + 1}</span>
                  <span className="twr-hist-m">{mLabel(FLOORS[i].mult)}</span>
                  <span className="twr-hist-ok">✓</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls panel */}
        <div className="twr-ctrl">
          <div className="twr-guide">
            <div className="twr-guide-title">Danger Guide</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--cream-faint)' }}>Floors 1–4</span>
              <span style={{ color: '#5fd99a', fontWeight: 700 }}>1 of 3 cursed</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--cream-faint)' }}>Floors 5–8</span>
              <span style={{ color: '#e7708a', fontWeight: 700 }}>2 of 3 cursed</span>
            </div>
          </div>

          {(phase === 'idle' || phase === 'dead' || phase === 'won') && (
            <div>
              <div className="twr-section-label">Your Bet</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BET_OPTIONS.map(b => (
                  <button key={b} onClick={() => setBet(b)} style={{
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11,
                    border: bet === b ? '1px solid var(--gold-l)' : '1px solid rgba(217,182,90,.2)',
                    background: bet === b ? 'rgba(217,182,90,.15)' : 'rgba(0,0,0,.3)',
                    color: bet === b ? 'var(--gold-l)' : 'var(--cream-faint)',
                    fontFamily: 'var(--fs-head)',
                  }}>
                    {b >= 1000 ? (b / 1000) + 'K' : b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <div className="twr-live">
              <div className="twr-section-label">Floor {floor + 1} — If you clear it</div>
              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 32, color: FLOORS[floor].mult >= 10 ? 'var(--gold-l)' : 'var(--cream)' }}>
                {mLabel(FLOORS[floor].mult)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--cream-faint)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                = {fmt(Math.round(bet * FLOORS[floor].mult))} chips
              </div>
              {floor > 0 && (
                <>
                  <div style={{ height: 1, background: 'rgba(217,182,90,.15)', margin: '14px 0' }} />
                  <div style={{ fontSize: 11, color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em', textTransform: 'uppercase' }}>Safe to cash out now</div>
                  <div style={{ fontWeight: 700, color: '#5fd99a', fontSize: 22, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                    {fmt(safePayoutNow)}
                  </div>
                </>
              )}
            </div>
          )}

          {(phase === 'dead' || phase === 'won') && (
            <div className="twr-result" style={{ background: phase === 'won' ? 'rgba(95,217,154,.1)' : 'rgba(185,28,28,.1)', borderColor: phase === 'won' ? 'rgba(95,217,154,.3)' : 'rgba(239,68,68,.25)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{phase === 'won' ? '🏆' : '💀'}</div>
              <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 16, color: phase === 'won' ? '#5fd99a' : '#ef4444', marginBottom: 6 }}>
                {phase === 'won' ? 'Cashed Out!' : 'Eliminated'}
              </div>
              {phase === 'won' && (
                <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 28, color: 'var(--gold-l)', fontVariantNumeric: 'tabular-nums' }}>
                  +{fmt(payout)}
                </div>
              )}
            </div>
          )}

          {phase === 'idle' && (
            <button onClick={startGame} disabled={bet > bal} className="btn"
              style={{ width: '100%', padding: '15px 0', fontSize: 14, opacity: bet > bal ? 0.4 : 1 }}>
              Start Climb — {fmt(bet)}
            </button>
          )}

          {phase === 'playing' && floor > 0 && (
            <button onClick={cashOut} className="btn btn-ghost"
              style={{ width: '100%', padding: '13px 0', fontSize: 13 }}>
              Cash Out {fmt(safePayoutNow)}
            </button>
          )}

          {(phase === 'dead' || phase === 'won') && (
            <button onClick={reset} className="btn" style={{ width: '100%', padding: '14px 0', fontSize: 14 }}>
              Play Again
            </button>
          )}
        </div>
      </div>

      <style>{`
        .twr-wrap { height:100vh;display:flex;flex-direction:column; }
        .topbar { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;z-index:30;background:linear-gradient(180deg,rgba(11,10,7,.95),rgba(11,10,7,.2)); }
        .back { display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--cream-dim);font-family:var(--fs-head);font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;border-radius:999px;border:1px solid rgba(217,182,90,.25);transition:.2s; }
        .back:hover { color:var(--gold-l);border-color:var(--gold); }
        .title-c { text-align:center; }
        .title-c .t { font-family:var(--fs-display);font-weight:900;font-size:20px;letter-spacing:.14em; }
        .title-c .s { font-family:var(--fs-head);font-size:9px;letter-spacing:.4em;color:var(--cream-faint); }
        .topbar .right { display:flex;align-items:center;gap:12px; }

        .twr-stage { flex:1;display:grid;grid-template-columns:1fr 280px;gap:22px;padding:22px;min-height:0;margin:0 18px 18px;border-radius:30px;border:1px solid rgba(217,182,90,.3);background:radial-gradient(120% 100% at 50% 0%,#137a4a 0%,#0c5a37 38%,#073b25 100%);box-shadow:inset 0 0 140px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.05);overflow-y:auto; }

        .twr-main { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px; }

        .twr-progress { display:flex;gap:8px;align-items:center; }
        .twr-dot { width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--fs-head);font-weight:700;font-size:11px;transition:.3s; }
        .twr-dot.upcoming { background:rgba(0,0,0,.3);border:1px solid rgba(217,182,90,.12);color:rgba(255,255,255,.18); }
        .twr-dot.active { background:rgba(217,182,90,.22);border:2px solid var(--gold-l);color:var(--gold-l);box-shadow:0 0 14px rgba(217,182,90,.4); }
        .twr-dot.cleared { background:rgba(95,217,154,.18);border:1px solid rgba(95,217,154,.45);color:#5fd99a; }
        .twr-dot.dead { background:rgba(239,68,68,.18);border:2px solid #ef4444;color:#ef4444; }

        .twr-floor-label { display:flex;align-items:baseline;gap:14px; }
        .twr-fl-num { font-family:var(--fs-head);font-weight:700;font-size:17px;color:var(--cream);letter-spacing:.06em; }
        .twr-fl-mult { font-family:var(--fs-display);font-weight:900;font-size:30px; }

        @keyframes floorIn { from { transform:translateY(55px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        .twr-big-cards { display:flex;gap:16px;align-items:flex-end;animation:floorIn .4s cubic-bezier(.2,.8,.2,1); }

        .twr-phase-msg { font-family:var(--fs-head);font-weight:700;font-size:17px;letter-spacing:.06em;padding:10px 24px;border-radius:999px;animation:floatUp .3s; }
        .twr-phase-msg.dead { background:rgba(185,28,28,.22);border:1px solid rgba(239,68,68,.38);color:#ef4444; }
        .twr-phase-msg.won { background:rgba(95,217,154,.12);border:1px solid rgba(95,217,154,.32);color:#5fd99a; }

        .twr-history { display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:10px 14px;background:rgba(0,0,0,.22);border-radius:12px; }
        .twr-hist-item { display:flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;background:rgba(95,217,154,.07);border:1px solid rgba(95,217,154,.18);border-radius:6px; }
        .twr-hist-fl { color:var(--cream-faint);font-family:var(--fs-head);letter-spacing:.04em; }
        .twr-hist-m { color:var(--gold-l);font-weight:700;font-family:var(--fs-head); }
        .twr-hist-ok { color:#5fd99a; }

        .twr-ctrl { display:flex;flex-direction:column;gap:16px;background:rgba(11,10,7,.65);border-radius:18px;padding:18px;border:1px solid rgba(217,182,90,.22);backdrop-filter:blur(2px);align-self:start;position:sticky;top:0; }
        .twr-guide { padding:14px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid rgba(217,182,90,.15); }
        .twr-guide-title { font-size:9px;letter-spacing:.22em;color:var(--cream-faint);text-transform:uppercase;font-family:var(--fs-head);margin-bottom:10px; }
        .twr-section-label { font-size:9px;letter-spacing:.22em;color:var(--cream-faint);text-transform:uppercase;font-family:var(--fs-head);margin-bottom:10px; }
        .twr-live { padding:14px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid rgba(217,182,90,.15); }
        .twr-result { padding:18px;border-radius:12px;border:1px solid;text-align:center; }

        .balance { display:flex;align-items:center;gap:8px; }
        .coin { width:26px;height:26px;border-radius:50%;background:var(--gold-grad);display:flex;align-items:center;justify-content:center;font-family:var(--fs-head);font-weight:800;font-size:11px;color:#2a1f08; }
        .amt { font-family:var(--fs-head);font-weight:700;font-size:16px;color:var(--gold-l); }

        @media (max-width:640px) {
          .twr-stage { grid-template-columns:1fr !important;grid-template-rows:1fr auto;margin:0 10px 10px;padding:16px; }
          .twr-ctrl { position:static !important; }
        }
      `}</style>
    </div>
  )
}
