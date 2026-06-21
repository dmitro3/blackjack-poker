'use client'

import Link from 'next/link'

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

interface VibrantLobbyProps {
  chips: number
  refillEnabled: boolean
  refillAmount: number
  onRefill: () => void
}

interface GameCard {
  href: string
  name: string
  tagline: string
  cta: string
  badge: string
  bg: string
  shimmer: string
  borderColor: string
  glowColor: string
  btnBg: string
  btnColor: string
  visual: React.ReactNode
}

function CardVisual({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', minHeight: 180,
    }}>
      {children}
    </div>
  )
}

const BlackjackVisual = () => (
  <CardVisual>
    <div style={{ position: 'relative', zIndex: 2 }}>
      {/* Big A */}
      <div style={{
        width: 100, height: 140, borderRadius: 10, background: 'linear-gradient(150deg,#fffdf6,#f0ead4)',
        boxShadow: '0 20px 50px rgba(0,0,0,.6), 0 0 30px rgba(100,160,255,.3)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '10px 12px', position: 'relative',
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#1a1a2e', lineHeight: 1, fontFamily: 'serif' }}>A</div>
        <div style={{ fontSize: 32, textAlign: 'center', lineHeight: 1 }}>♠</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#1a1a2e', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', fontFamily: 'serif' }}>A</div>
        {/* Shine */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255,255,255,.5) 0%, transparent 60%)', pointerEvents: 'none' }} />
      </div>
      {/* K behind */}
      <div style={{
        width: 100, height: 140, borderRadius: 10, background: 'linear-gradient(150deg,#fffdf6,#f0ead4)',
        boxShadow: '0 20px 50px rgba(0,0,0,.5)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '10px 12px', position: 'absolute', top: 10, left: 50,
        transform: 'rotate(12deg)',
      }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#c0001a', lineHeight: 1, fontFamily: 'serif' }}>K</div>
        <div style={{ fontSize: 28, textAlign: 'center', lineHeight: 1, color: '#c0001a' }}>♥</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#c0001a', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', fontFamily: 'serif' }}>K</div>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255,255,255,.5) 0%, transparent 60%)', pointerEvents: 'none' }} />
      </div>
    </div>
    {/* Glow */}
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 60%, rgba(100,160,255,.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

const PokerVisual = () => (
  <CardVisual>
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Community cards */}
      <div style={{ display: 'flex', gap: 5 }}>
        {[{r:'A',s:'♠',col:'#111'},{r:'K',s:'♠',col:'#111'},{r:'Q',s:'♥',col:'#c0001a'}].map((c,i) => (
          <div key={i} style={{
            width: 48, height: 66, borderRadius: 6, background: 'linear-gradient(150deg,#fffdf6,#eee8d5)',
            boxShadow: '0 8px 20px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', padding: '5px 6px',
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: c.col, lineHeight: 1, fontFamily: 'serif' }}>{c.r}</div>
            <div style={{ fontSize: 18, textAlign: 'center', lineHeight: 1, color: c.col }}>{c.s}</div>
          </div>
        ))}
      </div>
      {/* Hole cards face down */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1].map(i => (
          <div key={i} style={{
            width: 52, height: 70, borderRadius: 7,
            background: 'repeating-linear-gradient(45deg, #7a1020 0 5px, #5e0c19 5px 10px)',
            boxShadow: '0 10px 25px rgba(0,0,0,.5), inset 0 0 0 2px rgba(217,182,90,.4)',
          }} />
        ))}
      </div>
      {/* Chips */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['#e8c55a','#e87070','#5aabe8'].map((col, i) => (
          <div key={i} style={{
            width: 28, height: 28, borderRadius: '50%', background: col,
            boxShadow: `0 3px 0 rgba(0,0,0,.4), 0 4px 10px rgba(0,0,0,.3)`,
            border: '2px dashed rgba(255,255,255,.4)',
          }} />
        ))}
      </div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,80,100,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

const RouletteVisual = () => (
  <CardVisual>
    <div style={{ position: 'relative', zIndex: 2 }}>
      <div style={{
        width: 140, height: 140, borderRadius: '50%',
        background: `conic-gradient(from 0deg,
          #137a4a 0 10deg,#b3122a 10deg 20deg,#111 20deg 30deg,#b3122a 30deg 40deg,
          #111 40deg 50deg,#b3122a 50deg 60deg,#111 60deg 70deg,#b3122a 70deg 80deg,
          #b3122a 80deg 90deg,#111 90deg 100deg,#b3122a 100deg 110deg,#111 110deg 120deg,
          #b3122a 120deg 130deg,#111 130deg 140deg,#b3122a 140deg 150deg,#111 150deg 160deg,
          #b3122a 160deg 170deg,#111 170deg 180deg,#137a4a 180deg 190deg,#b3122a 190deg 200deg,
          #111 200deg 210deg,#b3122a 210deg 220deg,#111 220deg 230deg,#b3122a 230deg 240deg,
          #111 240deg 250deg,#b3122a 250deg 260deg,#111 260deg 270deg,#b3122a 270deg 280deg,
          #111 280deg 290deg,#b3122a 290deg 300deg,#111 300deg 310deg,#b3122a 310deg 320deg,
          #111 320deg 330deg,#b3122a 330deg 340deg,#111 340deg 350deg,#b3122a 350deg 360deg)`,
        boxShadow: 'inset 0 0 0 8px rgba(200,160,40,.7), inset 0 0 0 11px #1a0a2e, 0 0 40px rgba(180,100,255,.4), 0 20px 50px rgba(0,0,0,.6)',
        animation: 'spinSlow 10s linear infinite',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, #c8a028, #f0d060, #c8a028)',
          boxShadow: 'inset 0 2px 6px rgba(255,255,255,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'serif', fontWeight: 900, fontSize: 18, color: '#1a0a00',
        }}>0</div>
      </div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(160,80,255,.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

const SlotsVisual = () => (
  <CardVisual>
    <div style={{ zIndex: 2, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <div style={{
        background: 'linear-gradient(180deg,#2a1800,#1a0e00)',
        border: '2px solid rgba(255,160,40,.7)', borderBottom: 'none',
        borderRadius: '10px 10px 0 0', padding: '5px 18px',
        fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 10, letterSpacing: '.4em',
        color: '#ffb830', textShadow: '0 0 12px rgba(255,160,40,.9)',
      }}>JACKPOT</div>
      <div style={{
        background: 'rgba(0,0,0,.85)', border: '2px solid rgba(255,160,40,.7)',
        borderRadius: '0 0 10px 10px', padding: '10px 12px',
        display: 'flex', gap: 6, alignItems: 'center', position: 'relative',
      }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, background: 'rgba(255,160,40,.5)', transform: 'translateY(-50%)', zIndex: 3 }} />
        {['7','7','7'].map((s, i) => (
          <div key={i} style={{
            width: 52, height: 64, borderRadius: 6,
            background: 'linear-gradient(180deg,#1a0e00,#0a0700)',
            border: '1px solid rgba(255,160,40,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 30,
            color: '#ffb830', textShadow: '0 0 20px rgba(255,160,40,1)',
            position: 'relative', zIndex: 2,
          }}>{s}</div>
        ))}
      </div>
      <div style={{
        marginTop: 8, fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 11,
        letterSpacing: '.2em', color: '#ffb830', textShadow: '0 0 10px rgba(255,160,40,.8)',
      }}>× 100 WIN</div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 60%, rgba(255,120,0,.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

const BaccaratVisual = () => (
  <CardVisual>
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'rgba(50,220,160,.7)', fontFamily: 'Cinzel,serif', textTransform: 'uppercase' }}>Banker · 9</div>
      <div style={{ display: 'flex' }}>
        {[{r:'K',s:'♠',col:'#111'},{r:'9',s:'♦',col:'#c0001a'}].map((c,i) => (
          <div key={i} style={{
            width: 54, height: 74, borderRadius: 7, background: 'linear-gradient(150deg,#fffdf6,#eee8d5)',
            boxShadow: '0 10px 24px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', padding: '6px 7px',
            marginLeft: i ? '-22px' : 0, transform: i ? 'rotate(5deg)' : 'rotate(-5deg)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: c.col, fontFamily: 'serif' }}>{c.r}</div>
            <div style={{ fontSize: 18, textAlign: 'center', color: c.col }}>{c.s}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, letterSpacing: '.3em', color: 'rgba(50,220,160,.5)', fontFamily: 'Cinzel,serif' }}>— VS —</div>
      <div style={{ display: 'flex' }}>
        {[{r:'A',s:'♥',col:'#c0001a'},{r:'8',s:'♣',col:'#111'}].map((c,i) => (
          <div key={i} style={{
            width: 54, height: 74, borderRadius: 7, background: 'linear-gradient(150deg,#fffdf6,#eee8d5)',
            boxShadow: '0 10px 24px rgba(0,0,0,.55)', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', padding: '6px 7px',
            marginLeft: i ? '-22px' : 0, transform: i ? 'rotate(5deg)' : 'rotate(-5deg)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: c.col, fontFamily: 'serif' }}>{c.r}</div>
            <div style={{ fontSize: 18, textAlign: 'center', color: c.col }}>{c.s}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'rgba(50,220,160,.7)', fontFamily: 'Cinzel,serif', textTransform: 'uppercase' }}>Player · 9</div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(20,180,120,.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

const TowerVisual = () => (
  <CardVisual>
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {[{label:'FLOOR 8',col:'#ffd700',glow:'rgba(255,215,0,.8)'},{label:'FLOOR 7',col:'#f0c000',glow:'rgba(240,192,0,.6)'},{label:'FLOOR 6',col:'#daa520',glow:'rgba(218,165,32,.4)'}].map((f,i) => (
        <div key={i} style={{
          width: 120 - i*14, height: 32,
          background: `linear-gradient(90deg, rgba(255,215,0,.${3-i}) 0%, rgba(255,215,0,.0${8-i*2}) 100%)`,
          border: `1px solid rgba(255,215,0,.${4-i})`,
          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, letterSpacing: '.2em', color: f.col, fontFamily: 'Cinzel,serif',
          textShadow: `0 0 10px ${f.glow}`,
          boxShadow: `0 0 15px rgba(255,215,0,.${2-i*0})`,
        }}>{f.label}</div>
      ))}
      <div style={{ display: 'flex', gap: -10, marginTop: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 56, height: 78, borderRadius: 6,
            background: 'repeating-linear-gradient(45deg, #7a1020 0 5px, #5e0c19 5px 10px)',
            boxShadow: '0 8px 20px rgba(0,0,0,.5), inset 0 0 0 2px rgba(217,182,90,.4)',
            marginLeft: i ? '-18px' : 0,
            transform: `rotate(${(i-1)*10}deg) translateY(${i===1?-8:4}px)`,
            zIndex: 3-i,
            position: 'relative',
          }} />
        ))}
      </div>
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,180,0,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

const SportsVisual = () => (
  <CardVisual>
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 24, alignItems: 'center' }}>
      {[
        { emoji: '🏀', glow: 'rgba(255,120,40,.7)' },
        { emoji: '🏈', glow: 'rgba(100,180,255,.7)' },
        { emoji: '⚽', glow: 'rgba(80,200,80,.7)' },
        { emoji: '⛳', glow: 'rgba(220,180,60,.7)' },
      ].map((s, i) => (
        <div key={i} style={{
          fontSize: 44, lineHeight: 1,
          filter: `drop-shadow(0 0 18px ${s.glow})`,
          animation: `bob${i} 2s ease-in-out infinite`,
        }}>{s.emoji}</div>
      ))}
    </div>
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(50,150,255,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
  </CardVisual>
)

interface TileProps {
  href: string
  bg: string
  borderColor: string
  glowColor: string
  badge: string
  badgeBg: string
  badgeText: string
  name: string
  tagline: string
  cta: string
  btnBg: string
  btnShadow: string
  visual: React.ReactNode
  gridColumn?: string
}

function GameTile({ href, bg, borderColor, glowColor, badge, badgeBg, badgeText, name, tagline, cta, btnBg, btnShadow, visual, gridColumn }: TileProps) {
  return (
    <Link href={href} className="vibrant-tile" style={{
      gridColumn,
      position: 'relative', borderRadius: 18, overflow: 'hidden',
      textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column',
      background: bg,
      border: `1.5px solid ${borderColor}`,
      boxShadow: `0 4px 0 rgba(0,0,0,.4), 0 20px 50px rgba(0,0,0,.5), 0 0 0 1px ${glowColor}`,
      minHeight: 320,
      transition: 'transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s',
    }}>
      {/* Badge */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 10,
        background: badgeBg, color: badgeText,
        padding: '4px 12px', borderRadius: 999,
        fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 9, letterSpacing: '.2em',
        boxShadow: '0 2px 8px rgba(0,0,0,.4)',
      }}>{badge}</div>

      {/* Visual */}
      {visual}

      {/* Info strip */}
      <div style={{
        padding: '16px 20px 20px',
        background: 'linear-gradient(180deg, rgba(0,0,0,.0) 0%, rgba(0,0,0,.65) 100%)',
        backdropFilter: 'blur(4px)',
        borderTop: `1px solid ${borderColor}`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div>
          <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: '.04em', textShadow: '0 2px 8px rgba(0,0,0,.6)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 2, letterSpacing: '.02em' }}>{tagline}</div>
        </div>
        <div style={{
          padding: '11px 0', borderRadius: 10,
          background: btnBg,
          boxShadow: btnShadow,
          textAlign: 'center',
          fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 13, letterSpacing: '.18em',
          color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.4)',
        }}>{cta}</div>
      </div>
    </Link>
  )
}

export default function VibrantLobby({ chips, refillEnabled, refillAmount, onRefill }: VibrantLobbyProps) {
  return (
    <div style={{ position: 'relative' }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', top: -120, left: '20%', width: 600, height: 600,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(80,40,200,.12) 0%, transparent 70%)',
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', top: 200, right: '10%', width: 400, height: 400,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,60,60,.08) 0%, transparent 70%)',
        pointerEvents: 'none', filter: 'blur(40px)',
      }} />

      {/* Balance bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 32, padding: '18px 24px',
        background: 'linear-gradient(135deg, rgba(20,15,5,.9), rgba(10,8,2,.95))',
        borderRadius: 16, border: '1px solid rgba(217,182,90,.25)',
        boxShadow: '0 4px 30px rgba(0,0,0,.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f3dd96, #d9b65a, #9c7b2e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 20, color: '#2a1f08',
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,.5), 0 4px 12px rgba(0,0,0,.4)',
          }}>H</div>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(217,182,90,.6)', letterSpacing: '.2em', fontFamily: 'Cinzel,serif', textTransform: 'uppercase', marginBottom: 3 }}>Your Balance</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 32, color: '#f3dd96', letterSpacing: '.04em', lineHeight: 1 }}>
              {fmt(chips)}
            </div>
          </div>
        </div>
        {refillEnabled && chips < refillAmount && (
          <button
            onClick={onRefill}
            style={{
              padding: '12px 28px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #f3dd96, #d9b65a, #9c7b2e)',
              color: '#2a1f08', fontFamily: 'Cinzel,serif', fontWeight: 900,
              fontSize: 13, letterSpacing: '.14em',
              boxShadow: '0 4px 0 #6e521c, 0 8px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.5)',
              transition: 'transform .12s, box-shadow .12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
          >
            REFILL CHIPS
          </button>
        )}
      </div>

      {/* Section heading */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, rgba(217,182,90,.3))' }} />
        <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, letterSpacing: '.4em', color: 'rgba(217,182,90,.6)', textTransform: 'uppercase' }}>Choose Your Game</div>
        <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, rgba(217,182,90,.3), transparent)' }} />
      </div>

      {/* Game grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="vibrant-grid">
        <GameTile
          href="/blackjack"
          bg="linear-gradient(155deg, #06112e 0%, #0d2060 55%, #0a1840 100%)"
          borderColor="rgba(80,140,255,.45)"
          glowColor="rgba(60,100,220,.2)"
          badge="SOLO · ALWAYS OPEN"
          badgeBg="rgba(80,140,255,.25)"
          badgeText="#80b4ff"
          name="Blackjack"
          tagline="Beat the dealer to 21"
          cta="PLAY NOW"
          btnBg="linear-gradient(135deg, #2563eb, #1d4ed8)"
          btnShadow="0 4px 0 #1e3a8a, 0 6px 20px rgba(37,99,235,.4)"
          visual={<BlackjackVisual />}
        />

        <GameTile
          href="/poker"
          bg="linear-gradient(155deg, #1a0308 0%, #4a0814 55%, #380510 100%)"
          borderColor="rgba(255,80,100,.4)"
          glowColor="rgba(200,40,70,.2)"
          badge="2 PLAYERS · INVITE"
          badgeBg="rgba(255,80,100,.2)"
          badgeText="#ff8090"
          name="Texas Hold'em"
          tagline="Invite friends & go head to head"
          cta="PLAY NOW"
          btnBg="linear-gradient(135deg, #dc2626, #991b1b)"
          btnShadow="0 4px 0 #7f1d1d, 0 6px 20px rgba(220,38,38,.4)"
          visual={<PokerVisual />}
        />

        <GameTile
          href="/roulette"
          bg="linear-gradient(155deg, #120520 0%, #2e0a5a 55%, #220845 100%)"
          borderColor="rgba(160,80,255,.45)"
          glowColor="rgba(120,50,200,.2)"
          badge="36× MAX WIN"
          badgeBg="rgba(160,80,255,.2)"
          badgeText="#c084fc"
          name="Roulette"
          tagline="Rouge, noir, or your lucky number"
          cta="SPIN NOW"
          btnBg="linear-gradient(135deg, #9333ea, #7c3aed)"
          btnShadow="0 4px 0 #6b21a8, 0 6px 20px rgba(147,51,234,.4)"
          visual={<RouletteVisual />}
        />

        <GameTile
          href="/slots"
          bg="linear-gradient(155deg, #1c0a00 0%, #4a1800 55%, #381200 100%)"
          borderColor="rgba(255,140,20,.45)"
          glowColor="rgba(200,90,0,.2)"
          badge="100× JACKPOT"
          badgeBg="rgba(255,140,20,.2)"
          badgeText="#fb923c"
          name="Slots"
          tagline="Classic three-reel jackpot machine"
          cta="PULL LEVER"
          btnBg="linear-gradient(135deg, #ea580c, #c2410c)"
          btnShadow="0 4px 0 #9a3412, 0 6px 20px rgba(234,88,12,.4)"
          visual={<SlotsVisual />}
        />

        <GameTile
          href="/baccarat"
          bg="linear-gradient(155deg, #001810 0%, #003d26 55%, #002d1c 100%)"
          borderColor="rgba(30,210,130,.4)"
          glowColor="rgba(10,170,90,.2)"
          badge="TIE PAYS 8×"
          badgeBg="rgba(30,210,130,.18)"
          badgeText="#34d399"
          name="Baccarat"
          tagline="Player, Banker, or Tie"
          cta="PLAY NOW"
          btnBg="linear-gradient(135deg, #059669, #047857)"
          btnShadow="0 4px 0 #065f46, 0 6px 20px rgba(5,150,105,.4)"
          visual={<BaccaratVisual />}
        />

        <GameTile
          href="/tower"
          bg="linear-gradient(155deg, #100a00 0%, #2d1e00 55%, #221600 100%)"
          borderColor="rgba(255,200,40,.4)"
          glowColor="rgba(200,140,0,.2)"
          badge="UP TO 300×"
          badgeBg="rgba(255,200,40,.18)"
          badgeText="#fcd34d"
          name="Tower of Chance"
          tagline="Pick a card, dodge the bomb, climb 8 floors"
          cta="START CLIMB"
          btnBg="linear-gradient(135deg, #d97706, #b45309)"
          btnShadow="0 4px 0 #92400e, 0 6px 20px rgba(217,119,6,.4)"
          visual={<TowerVisual />}
        />

        <GameTile
          href="/sports"
          bg="linear-gradient(155deg, #030814 0%, #080f28 55%, #060c20 100%)"
          borderColor="rgba(56,180,255,.35)"
          glowColor="rgba(20,130,220,.15)"
          badge="LIVE EVENTS"
          badgeBg="rgba(56,180,255,.18)"
          badgeText="#38bdf8"
          name="Sports Book"
          tagline="Predict real events · Win 2× your chips"
          cta="PLACE BETS"
          btnBg="linear-gradient(135deg, #0ea5e9, #0284c7)"
          btnShadow="0 4px 0 #075985, 0 6px 20px rgba(14,165,233,.4)"
          visual={<SportsVisual />}
          gridColumn="span 3"
        />
      </div>

      <style>{`
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        .vibrant-tile:hover {
          transform: translateY(-6px) scale(1.02) !important;
          box-shadow: 0 16px 0 rgba(0,0,0,.3), 0 32px 80px rgba(0,0,0,.6), 0 0 60px var(--glow) !important;
        }
        .vibrant-tile:active { transform: translateY(-2px) scale(1.005) !important; }
        @media (max-width: 900px) {
          .vibrant-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .vibrant-grid > [style*="span 3"] { grid-column: span 2 !important; }
        }
        @media (max-width: 560px) {
          .vibrant-grid { grid-template-columns: 1fr !important; }
          .vibrant-grid > [style*="span 3"],
          .vibrant-grid > [style*="span 2"] { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  )
}
