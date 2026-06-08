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

// Floor color theme: bottom (purple) → middle (deep violet) → top (gold)
const FLOOR_THEME = [
  { tile: 'rgba(109,40,217,.18)', active: 'rgba(124,58,237,.4)', border: 'rgba(167,139,250,.25)' },
  { tile: 'rgba(109,40,217,.2)', active: 'rgba(124,58,237,.45)', border: 'rgba(167,139,250,.28)' },
  { tile: 'rgba(88,28,221,.22)', active: 'rgba(109,40,217,.5)', border: 'rgba(167,139,250,.3)' },
  { tile: 'rgba(79,20,210,.25)', active: 'rgba(109,40,217,.55)', border: 'rgba(192,132,252,.32)' },
  { tile: 'rgba(150,30,120,.2)', active: 'rgba(180,40,140,.45)', border: 'rgba(232,121,249,.3)' },
  { tile: 'rgba(180,30,80,.2)', active: 'rgba(220,50,90,.4)', border: 'rgba(249,99,119,.3)' },
  { tile: 'rgba(200,60,20,.18)', active: 'rgba(234,88,12,.4)', border: 'rgba(251,146,60,.3)' },
  { tile: 'rgba(180,120,10,.18)', active: 'rgba(217,182,90,.35)', border: 'rgba(217,182,90,.4)' },
]

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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06021a' }}>
      <div style={{ color: '#c4b5fd', fontFamily: 'var(--fs-head)', letterSpacing: '.1em' }}>Loading…</div>
    </div>
  )

  // Display floors top (index 7) to bottom (index 0)
  const displayOrder = [7, 6, 5, 4, 3, 2, 1, 0]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #06021a 0%, #0b0428 50%, #130836 100%)', display: 'flex', flexDirection: 'column', color: 'var(--cream)' }}>
      {/* Ambient stars */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {[...Array(24)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', background: '#c4b5fd',
            width: 2, height: 2, opacity: 0.12 + (i % 5) * 0.06,
            left: (i * 17 + 3) % 97 + '%',
            top: (i * 11 + 7) % 93 + '%',
            animation: `twinkle ${2 + (i % 4) * 0.7}s ease-in-out ${(i * 0.4) % 2}s infinite alternate`,
          }} />
        ))}
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: 'rgba(6,2,26,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(167,139,250,.15)' }}>
        <Link href="/" style={{ color: 'var(--cream-dim)', fontFamily: 'var(--fs-head)', fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(167,139,250,.25)', textDecoration: 'none' }}>← Lobby</Link>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 20, letterSpacing: '.12em', background: 'linear-gradient(135deg, #f5f0ff, #c4b5fd, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TOWER OF CHANCE
          </div>
          <div style={{ fontFamily: 'var(--fs-head)', fontSize: 9, letterSpacing: '.4em', color: 'rgba(167,139,250,.45)' }}>CLIMB · RISK · CLAIM</div>
        </div>
        <div className="balance">
          <div className="coin">H</div>
          <span className="amt tabnum">{fmt(bal)}</span>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: 22, padding: '24px 24px', maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>

        {/* Tower */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {displayOrder.map(fi => {
            const theme = FLOOR_THEME[fi]
            const { mult, bombs: bombCount } = FLOORS[fi]
            const isActive = phase === 'playing' && fi === floor
            const isCleared = (picks[fi] !== null) && !bombMap[fi]?.includes(picks[fi] as number)
            const isDeadFloor = phase === 'dead' && fi === floor
            const isUpcoming = phase === 'playing' && fi > floor
            const isUnvisited = (phase === 'idle') || isUpcoming || (phase === 'dead' && fi > floor)

            return (
              <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Multiplier label */}
                <div style={{
                  width: 48, textAlign: 'right', flexShrink: 0,
                  fontFamily: 'var(--fs-head)', fontSize: 13, fontWeight: 700,
                  color: isActive ? '#d9b65a'
                    : isCleared ? (fi >= 4 ? '#fbbf24' : '#a78bfa')
                    : 'rgba(167,139,250,.25)',
                }}>
                  {mLabel(mult)}
                </div>

                {/* 3 Tiles */}
                {[0, 1, 2].map(ti => {
                  const pickedThis = picks[fi] === ti
                  const hasBomb = bombMap.length > 0 && bombMap[fi].includes(ti)

                  let bg = theme.tile
                  let border = `1px solid ${theme.border}`
                  let shadow = 'none'
                  let cursor = 'default'
                  let content: React.ReactNode = null
                  let opacity = 1

                  if (isUnvisited) {
                    opacity = fi === floor && phase === 'idle' ? 0.45 : 0.25
                    content = fi === 7
                      ? <span style={{ fontSize: 14, opacity: .5 }}>👑</span>
                      : <span style={{ fontSize: 9, color: 'rgba(167,139,250,.2)' }}>✦</span>
                  } else if (isActive) {
                    bg = theme.active
                    border = `1px solid rgba(167,139,250,.6)`
                    shadow = `0 0 18px rgba(124,58,237,.35), inset 0 0 12px rgba(167,139,250,.08)`
                    cursor = 'pointer'
                    content = <span style={{ fontSize: 22, filter: 'drop-shadow(0 0 6px rgba(196,181,253,.8))', userSelect: 'none' }}>⬡</span>
                  } else if (pickedThis && !hasBomb) {
                    // Safely picked
                    bg = 'rgba(5,150,105,.22)'
                    border = '1px solid rgba(52,211,153,.45)'
                    shadow = '0 0 14px rgba(52,211,153,.25)'
                    content = <span style={{ fontSize: 20 }}>💎</span>
                  } else if (pickedThis && hasBomb) {
                    // Hit a bomb
                    bg = 'rgba(185,28,28,.3)'
                    border = '1px solid rgba(239,68,68,.55)'
                    shadow = '0 0 16px rgba(239,68,68,.4)'
                    content = <span style={{ fontSize: 20 }}>💀</span>
                  } else if (isDeadFloor && hasBomb) {
                    // Reveal other bombs on death floor
                    bg = 'rgba(120,20,20,.2)'
                    border = '1px solid rgba(239,68,68,.25)'
                    opacity = 0.7
                    content = <span style={{ fontSize: 16 }}>💣</span>
                  } else if (isDeadFloor && !hasBomb) {
                    // Reveal safe tiles on death floor
                    bg = 'rgba(5,90,60,.15)'
                    border = '1px solid rgba(52,211,153,.2)'
                    opacity = 0.6
                    content = <span style={{ fontSize: 15 }}>💎</span>
                  } else if (!isActive && !isUnvisited) {
                    // Cleared floor, non-picked tile
                    opacity = 0.3
                    content = <span style={{ fontSize: 9, color: 'rgba(167,139,250,.15)' }}>✦</span>
                  }

                  return (
                    <div
                      key={ti}
                      onClick={() => isActive ? pickTile(ti) : undefined}
                      style={{
                        flex: 1, height: 52, borderRadius: 10,
                        background: bg, border, boxShadow: shadow,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor, opacity, transition: 'all .15s',
                        userSelect: 'none',
                      }}
                    />
                  )
                })}

                {/* Floor indicator */}
                <div style={{ width: 20, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {isActive && <span style={{ color: '#a78bfa', fontSize: 14, animation: 'arrowPulse 1s ease-in-out infinite alternate' }}>▶</span>}
                  {isCleared && <span style={{ color: '#34d399', fontSize: 13 }}>✓</span>}
                  {isDeadFloor && <span style={{ color: '#ef4444', fontSize: 13 }}>✗</span>}
                </div>
              </div>
            )
          })}

          {/* Tower base */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <div style={{ height: 3, width: '70%', borderRadius: 999, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,.3), transparent)' }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>

          {/* Difficulty card */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(109,40,217,.12)', border: '1px solid rgba(167,139,250,.2)' }}>
            <div style={{ fontSize: 9, letterSpacing: '.22em', color: 'rgba(167,139,250,.45)', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 10 }}>Danger guide</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'rgba(167,139,250,.65)' }}>Floors 1–4</span>
                <span style={{ color: '#34d399', fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 11 }}>1 of 3 cursed</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'rgba(167,139,250,.65)' }}>Floors 5–8</span>
                <span style={{ color: '#ef4444', fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 11 }}>2 of 3 cursed</span>
              </div>
            </div>
          </div>

          {/* Bet selector */}
          {(phase === 'idle' || phase === 'dead' || phase === 'won') && (
            <div>
              <div style={{ fontSize: 9, letterSpacing: '.22em', color: 'rgba(167,139,250,.45)', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 10 }}>Your bet</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {BET_OPTIONS.map(b => (
                  <button
                    key={b}
                    onClick={() => setBet(b)}
                    style={{
                      padding: '7px 11px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 11,
                      border: bet === b ? '1px solid rgba(167,139,250,.7)' : '1px solid rgba(124,58,237,.2)',
                      background: bet === b ? 'rgba(124,58,237,.35)' : 'rgba(20,10,45,.5)',
                      color: bet === b ? '#c4b5fd' : 'rgba(167,139,250,.5)',
                      fontFamily: 'var(--fs-head)', transition: '.15s',
                    }}
                  >
                    {b >= 1000 ? (b / 1000) + 'K' : b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live payout info */}
          {phase === 'playing' && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(0,0,0,.3)', border: '1px solid rgba(167,139,250,.15)' }}>
              <div style={{ fontSize: 9, letterSpacing: '.22em', color: 'rgba(167,139,250,.45)', textTransform: 'uppercase', fontFamily: 'var(--fs-head)', marginBottom: 8 }}>Floor {floor + 1} reward</div>
              <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 30, color: FLOORS[floor].mult >= 10 ? '#fbbf24' : '#c4b5fd' }}>
                {mLabel(FLOORS[floor].mult)}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(167,139,250,.5)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                = {fmt(Math.round(bet * FLOORS[floor].mult))}
              </div>
              {floor > 0 && (
                <>
                  <div style={{ height: 1, background: 'rgba(167,139,250,.1)', margin: '12px 0' }} />
                  <div style={{ fontSize: 10, color: 'rgba(167,139,250,.45)', letterSpacing: '.1em', fontFamily: 'var(--fs-head)', textTransform: 'uppercase' }}>Safe to cash out</div>
                  <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: 20, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>
                    {fmt(safePayoutNow)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Result card */}
          {(phase === 'dead' || phase === 'won') && (
            <div style={{ padding: '18px', borderRadius: 14, background: phase === 'won' ? 'rgba(5,150,105,.14)' : 'rgba(185,28,28,.12)', border: `1px solid ${phase === 'won' ? 'rgba(52,211,153,.35)' : 'rgba(239,68,68,.3)'}`, textAlign: 'center' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>{phase === 'won' ? '🏆' : '💥'}</div>
              <div style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 15, color: phase === 'won' ? '#34d399' : '#ef4444', marginBottom: 6 }}>
                {phase === 'won' ? 'Cashed Out!' : 'Wiped Out'}
              </div>
              {phase === 'won' && (
                <div style={{ fontFamily: 'var(--fs-display)', fontWeight: 900, fontSize: 26, color: '#d9b65a', fontVariantNumeric: 'tabular-nums' }}>
                  +{fmt(payout)}
                </div>
              )}
            </div>
          )}

          {/* Start button */}
          {(phase === 'idle') && (
            <button
              onClick={startGame}
              disabled={bet > bal}
              style={{
                padding: '15px 0', borderRadius: 12, border: 'none',
                cursor: bet > bal ? 'not-allowed' : 'pointer',
                background: bet > bal ? 'rgba(124,58,237,.15)' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#fff', fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 14,
                letterSpacing: '.1em', textTransform: 'uppercase',
                boxShadow: bet > bal ? 'none' : '0 8px 28px rgba(109,40,217,.45)',
                opacity: bet > bal ? 0.45 : 1, transition: '.2s',
              }}
            >
              Climb — {fmt(bet)}
            </button>
          )}

          {/* Cash out */}
          {phase === 'playing' && floor > 0 && (
            <button
              onClick={cashOut}
              style={{
                padding: '13px 0', borderRadius: 12, cursor: 'pointer',
                background: 'rgba(167,139,250,.14)', border: '1px solid rgba(167,139,250,.4)',
                color: '#c4b5fd', fontFamily: 'var(--fs-head)', fontWeight: 700,
                fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', transition: '.2s',
              }}
            >
              Cash Out {fmt(safePayoutNow)}
            </button>
          )}

          {/* Play again */}
          {(phase === 'dead' || phase === 'won') && (
            <button
              onClick={reset}
              style={{
                padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                color: '#fff', fontFamily: 'var(--fs-head)', fontWeight: 700,
                fontSize: 14, letterSpacing: '.1em', textTransform: 'uppercase',
                boxShadow: '0 6px 20px rgba(109,40,217,.4)', transition: '.2s',
              }}
            >
              Play Again
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes twinkle { from { opacity: .08; } to { opacity: .3; } }
        @keyframes arrowPulse { from { opacity: .6; transform: translateX(0); } to { opacity: 1; transform: translateX(3px); } }
      `}</style>
    </div>
  )
}
