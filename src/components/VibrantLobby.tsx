'use client'

import Link from 'next/link'

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

interface VibrantLobbyProps {
  chips: number
  refillEnabled: boolean
  refillAmount: number
  onRefill: () => void
}

// ─── Individual card visuals ────────────────────────────────────────────────

function BlackjackArt() {
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      {/* Felt */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #1a4d2e 0%, #0d2918 60%, #060f0a 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.018) 0 1px, transparent 1px 8px)', mixBlendMode: 'overlay' }} />
      {/* Ghost 21 */}
      <div style={{ position: 'absolute', fontSize: 200, fontWeight: 900, fontFamily: 'Georgia,serif', color: 'rgba(255,255,255,.04)', lineHeight: 1, userSelect: 'none', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>21</div>
      {/* Cards */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ width: 88, height: 124, borderRadius: 8, background: '#fff', boxShadow: '-4px 8px 40px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 10px', transform: 'rotate(-10deg) translateY(6px)', position: 'relative' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111', lineHeight: 1, fontFamily: 'Georgia,serif' }}>A</div>
          <div style={{ fontSize: 42, textAlign: 'center', color: '#111', lineHeight: 1 }}>♠</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', fontFamily: 'Georgia,serif' }}>A</div>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'linear-gradient(135deg,rgba(255,255,255,.6) 0%, transparent 50%)', pointerEvents: 'none' }} />
        </div>
        <div style={{ width: 88, height: 124, borderRadius: 8, background: '#fff', boxShadow: '4px 8px 40px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '8px 10px', transform: 'rotate(8deg) translateY(6px)', marginLeft: -28, position: 'relative' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#c00020', lineHeight: 1, fontFamily: 'Georgia,serif' }}>K</div>
          <div style={{ fontSize: 42, textAlign: 'center', color: '#c00020', lineHeight: 1 }}>♥</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#c00020', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', fontFamily: 'Georgia,serif' }}>K</div>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: 'linear-gradient(135deg,rgba(255,255,255,.6) 0%, transparent 50%)', pointerEvents: 'none' }} />
        </div>
      </div>
      {/* Gold table rail at bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 14, background: 'linear-gradient(180deg, #8b6914, #c9a227)', borderTop: '1px solid #e8c84a' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.7))', pointerEvents: 'none' }} />
    </div>
  )
}

function PokerArt() {
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #3d0810 0%, #1e0408 70%, #0a0202 100%)' }} />
      {/* Community cards row */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{r:'A',s:'♠',c:'#111'},{r:'K',s:'♠',c:'#111'},{r:'Q',s:'♥',c:'#c00020'},{r:'J',s:'♥',c:'#c00020'},{r:'10',s:'♠',c:'#111'}].map((card, i) => (
            <div key={i} style={{ width: 42, height: 58, borderRadius: 5, background: '#fff', boxShadow: '0 6px 16px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 5px', position: 'relative' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: card.c, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.r}</div>
              <div style={{ fontSize: 16, textAlign: 'center', color: card.c, lineHeight: 1 }}>{card.s}</div>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 5, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 60%)', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
        {/* Hole cards & chips */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[0,1].map(i => (
            <div key={i} style={{ width: 42, height: 58, borderRadius: 5, background: 'repeating-linear-gradient(45deg,#7a1020 0 4px,#5e0c19 4px 8px)', boxShadow: '0 6px 16px rgba(0,0,0,.7), inset 0 0 0 1.5px rgba(217,182,90,.4)' }} />
          ))}
          <div style={{ display: 'flex', marginLeft: 8 }}>
            {['#e8c55a','#e87070','#5aabe8','#7ed88a'].map((col, i) => (
              <div key={i} style={{ width: 30, height: 30, borderRadius: '50%', background: col, border: '2px dashed rgba(255,255,255,.5)', boxShadow: '0 3px 0 rgba(0,0,0,.5)', marginLeft: i ? -10 : 0, position: 'relative', zIndex: 4-i }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,.75))', pointerEvents: 'none' }} />
    </div>
  )
}

function RouletteArt() {
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #1e0640 0%, #0e0320 70%, #050110 100%)' }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{
          width: 160, height: 160, borderRadius: '50%',
          background: `conic-gradient(from 0deg,
            #1a6b3a 0 9.73deg,#c0001a 9.73deg 19.46deg,#111 19.46deg 29.18deg,#c0001a 29.18deg 38.91deg,
            #111 38.91deg 48.64deg,#c0001a 48.64deg 58.37deg,#111 58.37deg 68.1deg,#c0001a 68.1deg 77.83deg,
            #111 77.83deg 87.56deg,#c0001a 87.56deg 97.29deg,#111 97.29deg 107.02deg,#c0001a 107.02deg 116.75deg,
            #111 116.75deg 126.47deg,#c0001a 126.47deg 136.2deg,#111 136.2deg 145.93deg,#c0001a 145.93deg 155.66deg,
            #111 155.66deg 165.39deg,#c0001a 165.39deg 175.12deg,#1a6b3a 175.12deg 184.85deg,#c0001a 184.85deg 194.58deg,
            #111 194.58deg 204.31deg,#c0001a 204.31deg 214.04deg,#111 214.04deg 223.77deg,#c0001a 223.77deg 233.5deg,
            #111 233.5deg 243.23deg,#c0001a 243.23deg 252.96deg,#111 252.96deg 262.69deg,#c0001a 262.69deg 272.42deg,
            #111 272.42deg 282.15deg,#c0001a 282.15deg 291.88deg,#111 291.88deg 301.61deg,#c0001a 301.61deg 311.34deg,
            #111 311.34deg 321.07deg,#c0001a 321.07deg 330.8deg,#111 330.8deg 340.53deg,#c0001a 340.53deg 360deg)`,
          boxShadow: '0 0 0 8px #c9a227, 0 0 0 12px #1a0040, 0 0 60px rgba(140,60,255,.5), 0 20px 60px rgba(0,0,0,.8)',
          animation: 'spinSlow 8s linear infinite',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#c9a227,#f0d060,#c9a227)', boxShadow: 'inset 0 2px 6px rgba(255,255,255,.5),inset 0 -3px 8px #8b6914', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontWeight: 900, fontSize: 22, color: '#1a0a00' }}>0</div>
        </div>
        {/* Ball */}
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', boxShadow: '0 2px 6px rgba(0,0,0,.6)', zIndex: 3 }} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.75))', pointerEvents: 'none' }} />
    </div>
  )
}

function SlotsArt() {
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, #3d1500 0%, #1e0800 60%, #080300 100%)' }} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {/* Jackpot label */}
        <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 13, letterSpacing: '.4em', color: '#ffb020', textShadow: '0 0 20px rgba(255,160,0,.9)', textTransform: 'uppercase' }}>Jackpot</div>
        {/* Multiplier */}
        <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 52, color: '#ffb020', textShadow: '0 0 30px rgba(255,160,0,.8), 0 0 60px rgba(255,100,0,.4)', lineHeight: 1, letterSpacing: '-.02em' }}>100×</div>
        {/* Reels */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,.6)', padding: '10px 14px', borderRadius: 10, border: '2px solid rgba(255,160,0,.4)', boxShadow: '0 0 20px rgba(255,100,0,.25), inset 0 0 20px rgba(0,0,0,.5)' }}>
          {['7','7','7'].map((s, i) => (
            <div key={i} style={{ width: 52, height: 66, borderRadius: 7, background: 'linear-gradient(180deg,#1a0900,#0a0400)', border: '1px solid rgba(255,160,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 36, color: '#ffb020', textShadow: '0 0 20px rgba(255,160,0,1)' }}>{s}</div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,.7))', pointerEvents: 'none' }} />
    </div>
  )
}

function BaccaratArt() {
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #00302a 0%, #001810 60%, #000a07 100%)' }} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'rgba(50,220,160,.65)', fontFamily: 'Cinzel,serif', textTransform: 'uppercase' }}>Banker</div>
        <div style={{ display: 'flex' }}>
          {[{r:'K',s:'♠',c:'#111'},{r:'9',s:'♦',c:'#c00020'}].map((card,i) => (
            <div key={i} style={{ width: 56, height: 78, borderRadius: 6, background: '#fff', boxShadow: '0 10px 28px rgba(0,0,0,.65)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px 7px', marginLeft: i?-20:0, transform: `rotate(${i?4:-4}deg)`, position: 'relative', zIndex: 2-i }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: card.c, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.r}</div>
              <div style={{ fontSize: 20, textAlign: 'center', color: card.c, lineHeight: 1 }}>{card.s}</div>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 60%)', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', padding: '4px 16px', borderRadius: 999, background: 'rgba(50,220,160,.1)', border: '1px solid rgba(50,220,160,.25)' }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 22, color: '#32dca0', textShadow: '0 0 15px rgba(50,220,160,.6)' }}>9</span>
          <span style={{ fontSize: 10, color: 'rgba(50,220,160,.5)', letterSpacing: '.2em', fontFamily: 'Cinzel,serif' }}>VS</span>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 22, color: '#32dca0', textShadow: '0 0 15px rgba(50,220,160,.6)' }}>9</span>
        </div>
        <div style={{ display: 'flex' }}>
          {[{r:'A',s:'♥',c:'#c00020'},{r:'8',s:'♣',c:'#111'}].map((card,i) => (
            <div key={i} style={{ width: 56, height: 78, borderRadius: 6, background: '#fff', boxShadow: '0 10px 28px rgba(0,0,0,.65)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px 7px', marginLeft: i?-20:0, transform: `rotate(${i?4:-4}deg)`, position: 'relative', zIndex: 2-i }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: card.c, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.r}</div>
              <div style={{ fontSize: 20, textAlign: 'center', color: card.c, lineHeight: 1 }}>{card.s}</div>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 60%)', pointerEvents: 'none' }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, letterSpacing: '.3em', color: 'rgba(50,220,160,.65)', fontFamily: 'Cinzel,serif', textTransform: 'uppercase' }}>Player</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,.7))', pointerEvents: 'none' }} />
    </div>
  )
}

function TowerArt() {
  const floors = [
    { floor: 8, mult: '300×', col: '#ffd700', dim: false },
    { floor: 7, mult: '100×', col: '#f0c030', dim: false },
    { floor: 6, mult: '40×',  col: '#d4a820', dim: false },
    { floor: 5, mult: '15×',  col: '#b89018', dim: true },
  ]
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, #1e1400 0%, #0e0a00 60%, #040300 100%)' }} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        {floors.map((f, i) => (
          <div key={i} style={{
            width: 180 - i * 16, height: 36,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px',
            background: f.dim ? 'rgba(255,200,0,.06)' : 'rgba(255,200,0,.12)',
            border: `1px solid rgba(255,200,0,${f.dim ? '.15' : '.35'})`,
            boxShadow: f.dim ? 'none' : `0 0 20px rgba(255,200,0,.15)`,
            opacity: f.dim ? 0.6 : 1,
          }}>
            <span style={{ fontFamily: 'Cinzel,serif', fontSize: 9, letterSpacing: '.15em', color: f.col, opacity: .7 }}>FL {f.floor}</span>
            <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 16, color: f.col, textShadow: f.dim ? 'none' : `0 0 12px ${f.col}` }}>{f.mult}</span>
          </div>
        ))}
        {/* Face down cards at base */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {['A','B'].map((label, i) => (
            <div key={i} style={{ width: 56, height: 34, borderRadius: 6, background: 'repeating-linear-gradient(45deg,#7a1020 0 4px,#5e0c19 4px 8px)', boxShadow: '0 4px 12px rgba(0,0,0,.6),inset 0 0 0 1.5px rgba(217,182,90,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: 'rgba(243,221,150,.5)' }}>{label}</div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 20%, rgba(0,0,0,.7))', pointerEvents: 'none' }} />
    </div>
  )
}

function SportsArt() {
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 200 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #001233 0%, #00061a 70%, #000308 100%)' }} />
      {/* Stadium lights */}
      {['-30%','30%'].map((x, i) => (
        <div key={i} style={{ position: 'absolute', top: -40, left: x, width: 200, height: 200, background: `radial-gradient(circle, rgba(${i?'100,160,255':'80,120,220'},.12) 0%, transparent 70%)`, pointerEvents: 'none' }} />
      ))}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* Live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 999, background: 'rgba(255,50,50,.15)', border: '1px solid rgba(255,50,50,.4)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ff3232', boxShadow: '0 0 8px #ff3232', animation: 'pulseLive 1.5s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 11, letterSpacing: '.22em', color: '#ff7070' }}>LIVE EVENTS</span>
        </div>
        {/* Sport emoji grid */}
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { e: '🏀', g: 'rgba(255,120,40,.7)' },
            { e: '🏈', g: 'rgba(80,160,255,.7)' },
            { e: '⚽', g: 'rgba(80,200,80,.6)' },
            { e: '⛳', g: 'rgba(220,180,60,.6)' },
          ].map((s, i) => (
            <div key={i} style={{ fontSize: 40, filter: `drop-shadow(0 0 14px ${s.g})`, lineHeight: 1 }}>{s.e}</div>
          ))}
        </div>
        {/* Mock event line */}
        <div style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(100,150,255,.2)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' }}>LAKERS</span>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 13, color: '#6ab0ff' }}>2×</span>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'rgba(255,255,255,.2)', letterSpacing: '.05em' }}>vs</span>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 13, color: '#6ab0ff' }}>2×</span>
          <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' }}>CELTICS</span>
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,.7))', pointerEvents: 'none' }} />
    </div>
  )
}

// ─── Card shell ──────────────────────────────────────────────────────────────

interface TileProps {
  href: string
  name: string
  sub: string
  cta: string
  accentColor: string
  btnBg: string
  btnShadow: string
  badge?: string
  badgeColor?: string
  visual: React.ReactNode
  gridColumn?: string
  gridRow?: string
}

function Tile({ href, name, sub, cta, accentColor, btnBg, btnShadow, badge, badgeColor, visual, gridColumn, gridRow }: TileProps) {
  return (
    <Link href={href} className="vl-tile" style={{
      gridColumn, gridRow,
      display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit',
      borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${accentColor}44`,
      boxShadow: `0 4px 0 rgba(0,0,0,.5), 0 12px 40px rgba(0,0,0,.5)`,
      minHeight: 360,
      transition: 'transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s',
      position: 'relative',
    }}>
      {/* Visual section */}
      {visual}

      {/* Badge */}
      {badge && (
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 10,
          padding: '4px 11px', borderRadius: 999,
          background: badgeColor ? `${badgeColor}22` : 'rgba(255,255,255,.08)',
          border: `1px solid ${badgeColor ?? 'rgba(255,255,255,.2)'}55`,
          fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 9, letterSpacing: '.18em',
          color: badgeColor ?? 'rgba(255,255,255,.6)',
        }}>{badge}</div>
      )}

      {/* Info section */}
      <div style={{
        padding: '18px 20px 20px',
        background: 'linear-gradient(180deg, rgba(8,6,4,.85) 0%, rgba(4,3,2,.97) 100%)',
        borderTop: `1px solid ${accentColor}30`,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div>
          <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '.05em', lineHeight: 1.1 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 4, letterSpacing: '.03em', lineHeight: 1.4 }}>{sub}</div>
        </div>
        <div style={{
          padding: '12px 0', borderRadius: 10,
          background: btnBg, boxShadow: btnShadow,
          textAlign: 'center',
          fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 12, letterSpacing: '.2em',
          color: '#fff',
        }}>{cta}</div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VibrantLobby({ chips, refillEnabled, refillAmount, onRefill }: VibrantLobbyProps) {
  const isFlush = chips >= refillAmount

  return (
    <div style={{ position: 'relative', paddingBottom: 60 }}>

      {/* Balance bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 36, padding: '20px 28px',
        background: 'linear-gradient(135deg, rgba(26,20,8,.95), rgba(10,8,3,.98))',
        borderRadius: 16, border: '1px solid rgba(217,182,90,.2)',
        boxShadow: '0 4px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(243,221,150,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg,#f3dd96,#d9b65a 40%,#9c7b2e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 22, color: '#2a1f08',
            boxShadow: 'inset 0 2px 4px rgba(255,255,255,.5), 0 4px 16px rgba(0,0,0,.5)',
          }}>H</div>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(217,182,90,.5)', letterSpacing: '.25em', fontFamily: 'Cinzel,serif', textTransform: 'uppercase', marginBottom: 4 }}>Your Balance</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 36, background: 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
              {fmt(chips)}
            </div>
          </div>
        </div>
        {refillEnabled && !isFlush && (
          <button onClick={onRefill} className="vl-refill-btn" style={{
            padding: '13px 30px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(160deg,#f3dd96,#d9b65a 38%,#9c7b2e)',
            color: '#2a1f08', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 12, letterSpacing: '.18em',
            boxShadow: '0 4px 0 #6e521c, 0 8px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.5)',
          }}>TOP UP</button>
        )}
      </div>

      {/* Divider label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(217,182,90,.25))' }} />
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 10, letterSpacing: '.45em', color: 'rgba(217,182,90,.45)', textTransform: 'uppercase' }}>Choose Your Game</span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(217,182,90,.25),transparent)' }} />
      </div>

      {/* Game grid — 3 cols row 1, 3 cols row 2, full-width Sports */}
      <div className="vl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <Tile href="/blackjack" name="Blackjack" sub="Beat the dealer · 21 pays 3:2" cta="DEAL NOW" accentColor="#22c45e" btnBg="linear-gradient(135deg,#166534,#14532d)" btnShadow="0 4px 0 #052e16, 0 6px 20px rgba(22,101,52,.4)" badge="SOLO" badgeColor="#22c45e" visual={<BlackjackArt />} />
        <Tile href="/poker" name="Texas Hold'em" sub="Invite a friend · Head to head" cta="PLAY NOW" accentColor="#ef4444" btnBg="linear-gradient(135deg,#991b1b,#7f1d1d)" btnShadow="0 4px 0 #450a0a, 0 6px 20px rgba(153,27,27,.4)" badge="2 PLAYERS" badgeColor="#ef4444" visual={<PokerArt />} />
        <Tile href="/roulette" name="Roulette" sub="Single number pays 35× your bet" cta="SPIN NOW" accentColor="#a855f7" btnBg="linear-gradient(135deg,#7e22ce,#6b21a8)" btnShadow="0 4px 0 #3b0764, 0 6px 20px rgba(126,34,206,.4)" badge="35×" badgeColor="#a855f7" visual={<RouletteArt />} />
        <Tile href="/slots" name="Slots" sub="Classic three-reel · Jackpot 100×" cta="PULL LEVER" accentColor="#f97316" btnBg="linear-gradient(135deg,#c2410c,#9a3412)" btnShadow="0 4px 0 #431407, 0 6px 20px rgba(194,65,12,.4)" badge="100× JACKPOT" badgeColor="#f97316" visual={<SlotsArt />} />
        <Tile href="/baccarat" name="Baccarat" sub="Player, Banker, or Tie pays 8×" cta="JOIN TABLE" accentColor="#10b981" btnBg="linear-gradient(135deg,#065f46,#047857)" btnShadow="0 4px 0 #022c22, 0 6px 20px rgba(6,95,70,.4)" badge="TIE 8×" badgeColor="#10b981" visual={<BaccaratArt />} />
        <Tile href="/tower" name="Tower of Chance" sub="8 floors · Cash out anytime" cta="START CLIMB" accentColor="#eab308" btnBg="linear-gradient(135deg,#a16207,#854d0e)" btnShadow="0 4px 0 #3f2006, 0 6px 20px rgba(161,98,7,.4)" badge="300× MAX" badgeColor="#eab308" visual={<TowerArt />} />
        <Tile href="/sports" name="Sports Book" sub="Predict real events · Win up to 2× your chips" cta="PLACE BETS" accentColor="#3b82f6" btnBg="linear-gradient(135deg,#1d4ed8,#1e40af)" btnShadow="0 4px 0 #1e3a8a, 0 6px 20px rgba(29,78,216,.4)" badge="LIVE" badgeColor="#3b82f6" visual={<SportsArt />} gridColumn="span 3" />
      </div>

      <style>{`
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes pulseLive { 0%,100%{opacity:1;box-shadow:0 0 8px #ff3232;} 50%{opacity:.5;box-shadow:0 0 3px #ff3232;} }
        .vl-tile:hover { transform: translateY(-5px) !important; box-shadow: 0 16px 0 rgba(0,0,0,.4), 0 24px 60px rgba(0,0,0,.6) !important; }
        .vl-tile:active { transform: translateY(-1px) !important; }
        .vl-refill-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #6e521c, 0 12px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.5) !important; }
        @media (max-width: 900px) {
          .vl-grid { grid-template-columns: repeat(2,1fr) !important; }
          .vl-grid > [style*="span 3"] { grid-column: span 2 !important; }
        }
        @media (max-width: 540px) {
          .vl-grid { grid-template-columns: 1fr !important; }
          .vl-grid > [style*="span 3"], .vl-grid > [style*="span 2"] { grid-column: span 1 !important; }
        }
      `}</style>
    </div>
  )
}
