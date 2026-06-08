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

const CHIPS_DEF = [
  { v: 1000,   color: '#3a3a3a', label: '1K' },
  { v: 5000,   color: '#b3122a', label: '5K' },
  { v: 25000,  color: '#137a4a', label: '25K' },
  { v: 100000, color: '#2a2a6e', label: '100K' },
]

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
function fmtShort(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K'
  return '' + n
}
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
  const emojiSize = 'calc(var(--w) * 0.38)' // scales with CSS-controlled --w

  if (state === 'unknown') return (
    <div className="card back" style={{ opacity: 0.38, cursor: 'default' }} />
  )
  if (state === 'active') return (
    <div
      className="card back"
      onClick={onClick}
      style={{ cursor: 'pointer', boxShadow: '0 0 0 4px var(--gold-l), 0 0 36px rgba(217,182,90,.7), 0 12px 32px rgba(0,0,0,.6)', transform: 'translateY(-10px)', transition: 'all .15s' }}
    />
  )
  if (state === 'safe') return (
    <div className={'card' + (safe.red ? ' red' : '')} style={{ boxShadow: '0 0 24px rgba(95,217,154,.55), 0 10px 24px rgba(0,0,0,.5)' }}>
      <div className="pip-tl"><div className="rank">{safe.rank}</div><div className="pip-suit">{safe.suit}</div></div>
      <div className="center-suit">{safe.suit}</div>
      <div className="pip-br"><div className="rank">{safe.rank}</div><div className="pip-suit">{safe.suit}</div></div>
    </div>
  )
  if (state === 'bomb') return (
    <div className="card" style={{ background: 'linear-gradient(160deg,#3a0808,#1a0404)', color: '#ef4444', boxShadow: '0 0 28px rgba(239,68,68,.65), 0 10px 24px rgba(0,0,0,.6)' }}>
      <div className="pip-tl"><div className="rank">💀</div></div>
      <div className="center-suit" style={{ fontSize: emojiSize }}>💀</div>
      <div className="pip-br"><div className="rank">💀</div></div>
    </div>
  )
  if (state === 'reveal-bomb') return (
    <div className="card" style={{ background: 'linear-gradient(160deg,#2a0606,#140303)', opacity: 0.72, color: '#ef4444' }}>
      <div className="pip-tl"><div className="rank">💣</div></div>
      <div className="center-suit" style={{ fontSize: emojiSize }}>💣</div>
      <div className="pip-br"><div className="rank">💣</div></div>
    </div>
  )
  // reveal-safe
  return (
    <div className={'card' + (safe.red ? ' red' : '')} style={{ opacity: 0.55 }}>
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
  const [revealFloor, setRevealFloor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [showCustomBet, setShowCustomBet] = useState(false)
  const [customBetVal, setCustomBetVal] = useState('')
  const [customBetAmount, setCustomBetAmount] = useState(0)
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
    setRevealFloor(null)
    setPhase('playing')
  }

  function pickTile(tileIdx: number) {
    if (phase !== 'playing' || revealFloor !== null) return
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
      const currentFloor = floor
      const earned = Math.round(bet * FLOORS[currentFloor].mult)
      setRevealFloor(currentFloor)
      setTimeout(() => {
        setRevealFloor(null)
        if (currentFloor >= FLOORS.length - 1) {
          setBal(b => b + earned)
          setPayout(earned)
          setPhase('won')
          fetch('/api/game/session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: 'tower', chips_wagered: bet, chips_won: earned }),
          }).catch(() => {})
        } else {
          setFloor(currentFloor + 1)
        }
      }, 950)
    }
  }

  function cashOut() {
    if (phase !== 'playing' || floor === 0 || revealFloor !== null) return
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
    setRevealFloor(null)
  }

  const displayFloor = revealFloor !== null ? revealFloor
    : phase === 'won' && picks[floor] === null ? floor - 1
    : floor

  function getTileState(fi: number, ti: number): TileState {
    if (phase === 'idle') return 'unknown'
    if (revealFloor !== null && fi === revealFloor) {
      if (picks[fi] === ti) return 'safe'
      return bombMap[fi]?.includes(ti) ? 'reveal-bomb' : 'reveal-safe'
    }
    if (phase === 'playing' && fi === floor && revealFloor === null) return 'active'
    if (phase === 'dead' && fi === floor) {
      if (picks[fi] === ti) return 'bomb'
      return bombMap[fi]?.includes(ti) ? 'reveal-bomb' : 'reveal-safe'
    }
    if (phase === 'won' && fi === displayFloor) {
      if (picks[fi] === ti) return 'safe'
      return bombMap[fi]?.includes(ti) ? 'reveal-bomb' : 'reveal-safe'
    }
    return 'unknown'
  }

  const historyFloors = Array.from({ length: displayFloor }, (_, i) => i)

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold-l)', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>Loading…</div>
    </div>
  )

  return (
    <div className="twr-wrap">

      {/* Header */}
      <header className="topbar">
        <Link className="back" href="/">← Lobby</Link>
        <div className="title-c">
          <div className="t gold-text">TOWER OF CHANCE</div>
          <div className="s">CLIMB · RISK · CLAIM · 300× MAX</div>
        </div>
        <div className="right">
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHelp(true)}>How to Play</button>
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(bal)}</span>
          </div>
        </div>
      </header>

      {/* Main green felt stage */}
      <div className="twr-stage">

        {/* Center — takes all available height, cards live here */}
        <div className="twr-center">

          {/* Progress dots */}
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
              {revealFloor !== null && (
                <span style={{ fontFamily: 'var(--fs-head)', fontSize: 12, letterSpacing: '.2em', color: '#5fd99a', textTransform: 'uppercase' }}>✓ Safe</span>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 36, color: 'var(--gold-l)', opacity: 0.28, letterSpacing: '.1em' }}>TOWER</div>
              <div style={{ fontFamily: 'var(--fs-head)', fontSize: 10, letterSpacing: '.32em', color: 'var(--cream-faint)', marginTop: 4 }}>SET YOUR BET BELOW AND CLIMB</div>
            </div>
          )}

          {/* BIG cards — slide in from below on floor advance */}
          <div key={`cards-${displayFloor}-${phase}`} className="twr-card-row" style={phase === 'idle' ? { opacity: 0.2, pointerEvents: 'none' } : undefined}>
            {[0, 1, 2].map(ti => (
              <TileCard
                key={ti}
                state={phase === 'idle' ? 'unknown' : getTileState(displayFloor, ti)}
                onClick={phase === 'playing' && revealFloor === null ? () => pickTile(ti) : undefined}
                floorIdx={displayFloor}
              />
            ))}
          </div>

          {/* Phase result */}
          {phase === 'dead' && <div className="twr-phase-msg dead">💀 Eliminated on Floor {floor + 1}</div>}
          {phase === 'won' && <div className="twr-phase-msg won">🏆 +{fmt(payout)} chips</div>}

          {/* Cleared floor history */}
          {historyFloors.length > 0 && (
            <div className="twr-history">
              {historyFloors.map(i => (
                <div key={i} className="twr-hist-item">
                  <span style={{ color: 'var(--cream-faint)' }}>F{i + 1}</span>
                  <span style={{ color: 'var(--gold-l)', fontWeight: 700 }}>{mLabel(FLOORS[i].mult)}</span>
                  <span style={{ color: '#5fd99a' }}>✓</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom control bar */}
        <div className="twr-ctrl-bar">
          <div className="twr-ctrl-left">
            {phase !== 'playing' ? (
              /* Chip selector for bet amount */
              <div className="chip-sel">
                {CHIPS_DEF.map(c => (
                  <div key={c.v} className={'chip' + (bet === c.v ? ' sel' : '')} style={{ background: c.color }} onClick={() => setBet(c.v)}>
                    <span>{c.label}</span>
                  </div>
                ))}
                {customBetAmount > 0 && (
                  <div className={'chip' + (bet === customBetAmount ? ' sel' : '')} style={{ background: 'linear-gradient(160deg,#5a3a8a,#3b1d6e)' }} onClick={() => setBet(customBetAmount)}>
                    <span>{fmtShort(customBetAmount)}</span>
                  </div>
                )}
                <div className="chip" style={{ background: 'linear-gradient(160deg,#5a3a8a,#2d155c)', border: '2px dashed rgba(167,139,250,.6)', fontSize: 11 }} onClick={() => { setCustomBetVal(''); setShowCustomBet(true) }}>
                  <span>CUST</span>
                </div>
                <div className={'chip' + (bet === bal ? ' sel' : '')} style={{ background: 'linear-gradient(160deg,#8f0f22,#440b18)', fontSize: 10 }} onClick={() => setBet(bal)}>
                  <span>ALL IN</span>
                </div>
              </div>
            ) : (
              /* Live floor info during play */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.18em', color: 'var(--cream-faint)', textTransform: 'uppercase' }}>
                  Clear Floor {floor + 1} to win
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 28, color: FLOORS[floor].mult >= 10 ? 'var(--gold-l)' : 'var(--cream)' }}>
                    {mLabel(FLOORS[floor].mult)}
                  </span>
                  <span style={{ color: 'var(--cream-faint)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                    = {fmt(Math.round(bet * FLOORS[floor].mult))}
                  </span>
                </div>
                {floor > 0 && (
                  <div style={{ fontSize: 13, color: '#5fd99a', fontVariantNumeric: 'tabular-nums' }}>
                    Cash out now: {fmt(safePayoutNow)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="twr-ctrl-right">
            {phase === 'idle' && (
              <button onClick={startGame} disabled={bet > bal} className="btn" style={{ padding: '16px 32px', fontSize: 15, opacity: bet > bal ? 0.4 : 1, whiteSpace: 'nowrap' }}>
                Start Climb — {fmt(bet)}
              </button>
            )}
            {phase === 'playing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch', minWidth: 180 }}>
                {floor > 0 && revealFloor === null && (
                  <button onClick={cashOut} className="btn btn-ghost" style={{ padding: '13px 24px', fontSize: 13 }}>
                    Cash Out {fmt(safePayoutNow)}
                  </button>
                )}
                {floor === 0 && (
                  <div style={{ fontFamily: 'var(--fs-head)', fontSize: 11, letterSpacing: '.15em', color: 'var(--cream-faint)', textTransform: 'uppercase', textAlign: 'center', padding: '10px 0' }}>
                    Pick a card to advance
                  </div>
                )}
              </div>
            )}
            {(phase === 'dead' || phase === 'won') && (
              <button onClick={reset} className="btn" style={{ padding: '16px 32px', fontSize: 15, whiteSpace: 'nowrap' }}>
                Play Again
              </button>
            )}
          </div>
        </div>
      </div>

      {/* How to Play modal */}
      {showHelp && (
        <div className="twr-modal-bg" onClick={() => setShowHelp(false)}>
          <div className="gilt twr-modal" onClick={e => e.stopPropagation()}>
            <button className="twr-modal-x" onClick={() => setShowHelp(false)}>×</button>
            <h2 className="gold-text" style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 24, margin: '0 0 8px' }}>How to Play Tower of Chance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--cream-dim)', fontSize: 14, lineHeight: 1.65 }}>
              <p><strong style={{ color: 'var(--cream)' }}>Objective:</strong> Climb 8 floors by picking one safe card per floor. Reach the top to win 300× your bet. Cash out at any floor to lock in that floor&apos;s multiplier.</p>
              <p><strong style={{ color: 'var(--cream)' }}>Each floor</strong> has 3 face-down cards. One (or more) hide a bomb. Pick a safe card to advance to the next floor. Hit a bomb and you lose your bet.</p>

              <div style={{ padding: 16, borderRadius: 12, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.2)' }}>
                <div style={{ fontFamily: 'var(--fs-head)', fontSize: 10, letterSpacing: '.22em', color: 'var(--cream-faint)', textTransform: 'uppercase', marginBottom: 12 }}>Danger Guide</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FLOORS.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < FLOORS.length - 1 ? '1px solid rgba(217,182,90,.08)' : 'none' }}>
                      <span style={{ color: 'var(--cream-faint)', fontSize: 13 }}>Floor {i + 1}</span>
                      <span style={{ color: f.bombs >= 2 ? '#e7708a' : '#5fd99a', fontWeight: 700, fontSize: 13 }}>{f.bombs} of 3 bombs</span>
                      <span style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 14, color: f.mult >= 10 ? 'var(--gold-l)' : 'var(--cream)' }}>{mLabel(f.mult)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p><strong style={{ color: 'var(--cream)' }}>Cash Out:</strong> After clearing at least one floor, a Cash Out button appears. Use it to collect the previous floor&apos;s multiplier and end the game safely.</p>
              <p><strong style={{ color: 'var(--cream)' }}>Tip:</strong> Floors 1–4 have 1 bomb (33% danger). Floors 5–8 have 2 bombs (67% danger). The multipliers jump dramatically at floor 5 to compensate.</p>
            </div>
          </div>
        </div>
      )}

      {/* Custom bet modal */}
      {showCustomBet && (
        <div className="twr-modal-bg" onClick={() => setShowCustomBet(false)}>
          <div className="gilt twr-modal" onClick={e => e.stopPropagation()} style={{ width: 320 }}>
            <button className="twr-modal-x" onClick={() => setShowCustomBet(false)}>×</button>
            <h2 className="gold-text" style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 22, margin: '0 0 8px' }}>Custom Bet</h2>
            <p style={{ color: 'var(--cream-dim)', fontSize: 14, margin: '0 0 16px' }}>Enter any amount to use as your bet.</p>
            <input
              type="number"
              value={customBetVal}
              onChange={e => setCustomBetVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseInt(customBetVal, 10)
                  if (v > 0) { setCustomBetAmount(v); setBet(v) }
                  setShowCustomBet(false)
                }
              }}
              placeholder="e.g. 7500"
              style={{ width: '100%', background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.35)', borderRadius: 10, padding: '10px 14px', color: 'var(--gold-l)', fontSize: 20, fontFamily: 'var(--fs-head)', letterSpacing: '.06em', outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
            <button className="btn" style={{ width: '100%', marginTop: 14 }} onClick={() => {
              const v = parseInt(customBetVal, 10)
              if (v > 0) { setCustomBetAmount(v); setBet(v) }
              setShowCustomBet(false)
            }}>Set Bet</button>
          </div>
        </div>
      )}

      <style>{`
        .twr-wrap { height:100vh;height:100svh;display:flex;flex-direction:column;overflow:hidden; }

        .topbar { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;z-index:30;flex-shrink:0;background:linear-gradient(180deg,rgba(11,10,7,.95),rgba(11,10,7,.2)); }
        .back { display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--cream-dim);font-family:var(--fs-head);font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;border-radius:999px;border:1px solid rgba(217,182,90,.25);transition:.2s; }
        .back:hover { color:var(--gold-l);border-color:var(--gold); }
        .title-c { text-align:center; }
        .title-c .t { font-family:var(--fs-display);font-weight:900;font-size:20px;letter-spacing:.14em; }
        .title-c .s { font-family:var(--fs-head);font-size:9px;letter-spacing:.4em;color:var(--cream-faint); }
        .topbar .right { display:flex;align-items:center;gap:12px; }

        /* Green felt stage — flex column */
        .twr-stage {
          flex:1;display:flex;flex-direction:column;min-height:0;
          margin:0 18px 18px;border-radius:30px;
          border:1px solid rgba(217,182,90,.3);
          background:radial-gradient(120% 100% at 50% 0%,#137a4a 0%,#0c5a37 38%,#073b25 100%);
          box-shadow:inset 0 0 140px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.05);
        }

        /* Center area — fills available height, cards centered */
        .twr-center {
          flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:18px;padding:24px 24px 12px;min-height:0;overflow:hidden;
        }

        /* Progress dots */
        .twr-progress { display:flex;gap:8px;align-items:center;flex-shrink:0; }
        .twr-dot { width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--fs-head);font-weight:700;font-size:11px;transition:.3s;flex-shrink:0; }
        .twr-dot.upcoming { background:rgba(0,0,0,.3);border:1px solid rgba(217,182,90,.12);color:rgba(255,255,255,.18); }
        .twr-dot.active { background:rgba(217,182,90,.22);border:2px solid var(--gold-l);color:var(--gold-l);box-shadow:0 0 14px rgba(217,182,90,.4); }
        .twr-dot.cleared { background:rgba(95,217,154,.18);border:1px solid rgba(95,217,154,.45);color:#5fd99a; }
        .twr-dot.dead { background:rgba(239,68,68,.18);border:2px solid #ef4444;color:#ef4444; }

        /* Floor label */
        .twr-floor-label { display:flex;align-items:baseline;gap:14px;flex-shrink:0; }
        .twr-fl-num { font-family:var(--fs-head);font-weight:700;font-size:16px;color:var(--cream);letter-spacing:.06em; }
        .twr-fl-mult { font-family:var(--fs-display);font-weight:900;font-size:28px; }

        /* BIG card row — 160px cards, centered, animates in */
        @keyframes floorIn { from { transform:translateY(60px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        .twr-card-row {
          display:flex;gap:20px;align-items:flex-end;flex-shrink:0;
          animation:floorIn .4s cubic-bezier(.2,.8,.2,1);
        }
        /* Override card size for tower — 160px desktop, 90px mobile */
        .twr-card-row .card { --w:160px !important; }

        /* Phase messages */
        .twr-phase-msg { font-family:var(--fs-head);font-weight:700;font-size:16px;letter-spacing:.06em;padding:9px 22px;border-radius:999px;animation:floatUp .3s;flex-shrink:0; }
        .twr-phase-msg.dead { background:rgba(185,28,28,.22);border:1px solid rgba(239,68,68,.38);color:#ef4444; }
        .twr-phase-msg.won { background:rgba(95,217,154,.12);border:1px solid rgba(95,217,154,.32);color:#5fd99a; }

        /* History strip */
        .twr-history { display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:8px 12px;background:rgba(0,0,0,.22);border-radius:10px;flex-shrink:0; }
        .twr-hist-item { display:flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;background:rgba(95,217,154,.07);border:1px solid rgba(95,217,154,.18);border-radius:6px;font-family:var(--fs-head); }

        /* Bottom control bar */
        .twr-ctrl-bar {
          flex-shrink:0;display:flex;align-items:center;justify-content:space-between;
          padding:14px 24px 20px;border-top:1px solid rgba(217,182,90,.18);gap:20px;
          background:rgba(7,59,37,.6);backdrop-filter:blur(4px);
          border-radius:0 0 30px 30px;
        }
        .twr-ctrl-left { flex:1;min-width:0; }
        .twr-ctrl-right { flex-shrink:0; }

        /* Chip selector — reuse global .chip styles */
        .chip-sel { display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
        .chip-sel .chip { width:54px;height:54px;font-size:13px; }
        .chip-sel .chip.sel { outline:3px solid var(--gold-l);outline-offset:2px;transform:translateY(-4px); }

        /* Modals */
        .twr-modal-bg { position:fixed;inset:0;background:rgba(5,4,2,.75);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:center;justify-content:center;animation:floatUp .2s; }
        .twr-modal { width:500px;max-width:92vw;max-height:88vh;overflow-y:auto;padding:32px;border-radius:var(--radius-lg);position:relative; }
        .twr-modal-x { position:absolute;top:16px;right:18px;background:none;border:none;color:var(--cream-faint);font-size:24px;cursor:pointer;line-height:1; }

        .balance { display:flex;align-items:center;gap:8px; }
        .coin { width:26px;height:26px;border-radius:50%;background:var(--gold-grad);display:flex;align-items:center;justify-content:center;font-family:var(--fs-head);font-weight:800;font-size:11px;color:#2a1f08; }
        .amt { font-family:var(--fs-head);font-weight:700;font-size:16px;color:var(--gold-l); }

        @media (max-width:640px) {
          .twr-stage { margin:0 8px 10px;border-radius:20px; }
          .twr-card-row .card { --w:90px !important; }
          .twr-ctrl-bar { flex-direction:column;align-items:stretch;gap:12px;padding:12px 16px 16px; }
          .twr-ctrl-right { display:flex;justify-content:center; }
          .chip-sel { justify-content:center; }
          .topbar { padding:10px 14px; }
          .title-c .s { display:none; }
        }
      `}</style>
    </div>
  )
}
