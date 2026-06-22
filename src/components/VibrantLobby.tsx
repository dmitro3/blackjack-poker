'use client'

import Link from 'next/link'

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

interface VibrantLobbyProps {
  chips: number
  refillEnabled: boolean
  refillAmount: number
  onRefill: () => void
}

export default function VibrantLobby({ chips, refillEnabled, refillAmount, onRefill }: VibrantLobbyProps) {
  const isFlush = chips >= refillAmount

  return (
    <div style={{ position: 'relative', paddingBottom: 60 }}>

      {/* ── Row 1: Two hero landscape cards ─────────────────────────────────── */}
      <div className="vl-hero-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* Blackjack Hero */}
        <Link href="/blackjack" className="vl-hero" style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          height: 360, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          textDecoration: 'none', color: 'inherit',
          boxShadow: '0 8px 40px rgba(0,0,0,.65)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 40% 30%, #1c5c35 0%, #0d3420 50%, #060f0a 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.015) 0 1px, transparent 1px 8px)' }} />
          <div style={{ position: 'absolute', right: -20, top: '50%', transform: 'translateY(-60%)', fontSize: 280, fontWeight: 900, fontFamily: 'Georgia,serif', color: 'rgba(255,255,255,.035)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>21</div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: 100, height: 140, borderRadius: 10, background: '#fff', boxShadow: '0 16px 60px rgba(0,0,0,.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 12px', transform: 'rotate(-14deg) translateY(10px)', position: 'relative' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#111', lineHeight: 1, fontFamily: 'Georgia,serif' }}>A</div>
              <div style={{ fontSize: 50, textAlign: 'center', color: '#111', lineHeight: 1 }}>♠</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#111', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', fontFamily: 'Georgia,serif' }}>A</div>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(135deg,rgba(255,255,255,.7) 0%,transparent 40%)', pointerEvents: 'none' }} />
            </div>
            <div style={{ width: 100, height: 140, borderRadius: 10, background: '#fff', boxShadow: '0 16px 60px rgba(0,0,0,.8)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '10px 12px', transform: 'rotate(10deg) translateY(10px)', marginLeft: -35, position: 'relative' }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#c00020', lineHeight: 1, fontFamily: 'Georgia,serif' }}>K</div>
              <div style={{ fontSize: 50, textAlign: 'center', color: '#c00020', lineHeight: 1 }}>♥</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#c00020', lineHeight: 1, transform: 'rotate(180deg)', alignSelf: 'flex-end', fontFamily: 'Georgia,serif' }}>K</div>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'linear-gradient(135deg,rgba(255,255,255,.7) 0%,transparent 40%)', pointerEvents: 'none' }} />
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 18, background: 'linear-gradient(180deg,#8b6914,#c9a227)', borderTop: '1px solid #e8c84a' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.4) 40%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 2, padding: '0 26px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.38em', color: 'rgba(34,196,94,.75)', fontFamily: 'Cinzel,serif', textTransform: 'uppercase', marginBottom: 7 }}>SOLO PLAY</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 40, color: '#fff', lineHeight: 1, letterSpacing: '.01em' }}>Blackjack</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', marginTop: 6, fontFamily: 'Cinzel,serif', letterSpacing: '.07em' }}>Beat the dealer · 21 pays 3:2</div>
            </div>
            <div style={{ padding: '14px 28px', borderRadius: 999, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 12, letterSpacing: '.2em', boxShadow: '0 4px 0 #052e16, 0 8px 24px rgba(22,163,74,.45)', flexShrink: 0 }}>DEAL</div>
          </div>
        </Link>

        {/* Poker Hero */}
        <Link href="/poker" className="vl-hero" style={{
          position: 'relative', borderRadius: 20, overflow: 'hidden',
          height: 360, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          textDecoration: 'none', color: 'inherit',
          boxShadow: '0 8px 40px rgba(0,0,0,.65)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 20%, #4a0a14 0%, #2a0508 50%, #0e0202 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.012) 0 1px, transparent 1px 8px)' }} />
          <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 6 }}>
            {[{r:'A',s:'♠',c:'#111'},{r:'K',s:'♠',c:'#111'},{r:'Q',s:'♥',c:'#c00020'},{r:'J',s:'♥',c:'#c00020'},{r:'10',s:'♠',c:'#111'}].map((card, i) => (
              <div key={i} style={{ width: 52, height: 72, borderRadius: 6, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px 6px', position: 'relative', transform: `rotate(${(i - 2) * 3}deg)` }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: card.c, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.r}</div>
                <div style={{ fontSize: 20, textAlign: 'center', color: card.c, lineHeight: 1 }}>{card.s}</div>
                <div style={{ position: 'absolute', inset: 0, borderRadius: 6, background: 'linear-gradient(135deg,rgba(255,255,255,.6) 0%,transparent 50%)', pointerEvents: 'none' }} />
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 8 }}>
            {['#e8c55a','#e87070','#5aabe8','#7ed88a','#c87ae8'].map((col, i) => (
              <div key={i} style={{ width: 36, height: 36, borderRadius: '50%', background: col, border: '2.5px dashed rgba(255,255,255,.55)', boxShadow: `0 4px 0 rgba(0,0,0,.6), 0 0 12px ${col}55` }} />
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.9) 0%, rgba(0,0,0,.3) 50%, transparent 75%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 18, left: 20, zIndex: 3, display: 'flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 999, background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.4)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulseLive 1.5s infinite' }} />
            <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 10, letterSpacing: '.22em', color: '#f87171' }}>INVITE FRIENDS</span>
          </div>
          <div style={{ position: 'relative', zIndex: 2, padding: '0 26px 28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.38em', color: 'rgba(239,68,68,.75)', fontFamily: 'Cinzel,serif', textTransform: 'uppercase', marginBottom: 7 }}>MULTIPLAYER</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 40, color: '#fff', lineHeight: 1, letterSpacing: '.01em' }}>Hold&apos;em</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.42)', marginTop: 6, fontFamily: 'Cinzel,serif', letterSpacing: '.07em' }}>Invite a friend · Head to head</div>
            </div>
            <div style={{ padding: '14px 28px', borderRadius: 999, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 12, letterSpacing: '.2em', boxShadow: '0 4px 0 #450a0a, 0 8px 24px rgba(220,38,38,.45)', flexShrink: 0 }}>PLAY</div>
          </div>
        </Link>

      </div>

      {/* ── Section divider ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '24px 0 16px' }}>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(217,182,90,.2))' }} />
        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 9, letterSpacing: '.5em', color: 'rgba(217,182,90,.38)', textTransform: 'uppercase' }}>Quick Play</span>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(217,182,90,.2), transparent)' }} />
      </div>

      {/* ── Row 2: Four compact square cards ─────────────────────────────────── */}
      <div className="vl-quad" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>

        {/* Roulette */}
        <Link href="/roulette" className="vl-sq" style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          aspectRatio: '1', display: 'flex', flexDirection: 'column',
          textDecoration: 'none', color: 'inherit',
          boxShadow: '0 6px 24px rgba(0,0,0,.6)',
          border: '1px solid rgba(168,85,247,.18)',
        }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #2e0a5a 0%, #160428 60%, #070112 100%)' }} />
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{
                width: 110, height: 110, borderRadius: '50%',
                background: `conic-gradient(from 0deg, #1a6b3a 0 9.73deg,#c0001a 9.73deg 19.46deg,#111 19.46deg 29.18deg,#c0001a 29.18deg 38.91deg,#111 38.91deg 48.64deg,#c0001a 48.64deg 58.37deg,#111 58.37deg 68.1deg,#c0001a 68.1deg 77.83deg,#111 77.83deg 87.56deg,#c0001a 87.56deg 97.29deg,#111 97.29deg 107.02deg,#c0001a 107.02deg 116.75deg,#111 116.75deg 126.47deg,#c0001a 126.47deg 136.2deg,#111 136.2deg 145.93deg,#c0001a 145.93deg 155.66deg,#111 155.66deg 165.39deg,#c0001a 165.39deg 175.12deg,#1a6b3a 175.12deg 184.85deg,#c0001a 184.85deg 194.58deg,#111 194.58deg 204.31deg,#c0001a 204.31deg 214.04deg,#111 214.04deg 223.77deg,#c0001a 223.77deg 233.5deg,#111 233.5deg 243.23deg,#c0001a 243.23deg 252.96deg,#111 252.96deg 262.69deg,#c0001a 262.69deg 272.42deg,#111 272.42deg 282.15deg,#c0001a 282.15deg 291.88deg,#111 291.88deg 301.61deg,#c0001a 301.61deg 311.34deg,#111 311.34deg 321.07deg,#c0001a 321.07deg 330.8deg,#111 330.8deg 340.53deg,#c0001a 340.53deg 360deg)`,
                boxShadow: '0 0 0 6px #c9a227, 0 0 0 9px #16042a, 0 0 40px rgba(140,60,255,.5)',
                animation: 'spinSlow 8s linear infinite',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{ position: 'absolute', inset: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#c9a227,#f0d060,#c9a227)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontWeight: 900, fontSize: 15, color: '#1a0a00' }}>0</div>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.88))', pointerEvents: 'none' }} />
          </div>
          <div style={{ padding: '10px 14px 14px', background: 'rgba(5,3,12,.97)' }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '.04em' }}>Roulette</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 19, color: '#a855f7', textShadow: '0 0 12px rgba(168,85,247,.6)' }}>35×</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.28)', letterSpacing: '.08em' }}>single number</span>
            </div>
          </div>
        </Link>

        {/* Slots */}
        <Link href="/slots" className="vl-sq" style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          aspectRatio: '1', display: 'flex', flexDirection: 'column',
          textDecoration: 'none', color: 'inherit',
          boxShadow: '0 6px 24px rgba(0,0,0,.6)',
          border: '1px solid rgba(249,115,22,.18)',
        }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 20%, #3a1100 0%, #1a0700 60%, #060200 100%)' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 10, letterSpacing: '.4em', color: '#f97316', textShadow: '0 0 15px rgba(249,115,22,.8)', textTransform: 'uppercase' }}>JACKPOT</div>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,.5)', padding: '6px 8px', borderRadius: 8, border: '1.5px solid rgba(249,115,22,.3)', boxShadow: '0 0 14px rgba(249,115,22,.2)' }}>
                {['7','7','7'].map((s, i) => (
                  <div key={i} style={{ width: 36, height: 46, borderRadius: 5, background: 'linear-gradient(180deg,#1a0800,#0a0300)', border: '1px solid rgba(249,115,22,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 24, color: '#fb923c', textShadow: '0 0 12px rgba(249,115,22,.9)' }}>{s}</div>
                ))}
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.88))', pointerEvents: 'none' }} />
          </div>
          <div style={{ padding: '10px 14px 14px', background: 'rgba(8,3,0,.97)' }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '.04em' }}>Slots</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 19, color: '#f97316', textShadow: '0 0 12px rgba(249,115,22,.6)' }}>100×</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.28)', letterSpacing: '.08em' }}>jackpot</span>
            </div>
          </div>
        </Link>

        {/* Baccarat */}
        <Link href="/baccarat" className="vl-sq" style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          aspectRatio: '1', display: 'flex', flexDirection: 'column',
          textDecoration: 'none', color: 'inherit',
          boxShadow: '0 6px 24px rgba(0,0,0,.6)',
          border: '1px solid rgba(16,185,129,.18)',
        }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 30%, #00302a 0%, #001612 60%, #000805 100%)' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex' }}>
                  {[{r:'K',s:'♠',c:'#111'},{r:'9',s:'♦',c:'#c00020'}].map((card,i) => (
                    <div key={i} style={{ width: 40, height: 56, borderRadius: 5, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 5px', marginLeft: i ? -14 : 0, transform: `rotate(${i ? 3 : -3}deg)`, position: 'relative', zIndex: 2 - i }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: card.c, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.r}</div>
                      <div style={{ fontSize: 14, textAlign: 'center', color: card.c, lineHeight: 1 }}>{card.s}</div>
                      <div style={{ position: 'absolute', inset: 0, borderRadius: 5, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 60%)', pointerEvents: 'none' }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: 'Cinzel,serif', fontSize: 9, letterSpacing: '.2em', color: 'rgba(16,185,129,.5)' }}>VS</div>
                <div style={{ display: 'flex' }}>
                  {[{r:'A',s:'♥',c:'#c00020'},{r:'8',s:'♣',c:'#111'}].map((card,i) => (
                    <div key={i} style={{ width: 40, height: 56, borderRadius: 5, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '4px 5px', marginLeft: i ? -14 : 0, transform: `rotate(${i ? 3 : -3}deg)`, position: 'relative', zIndex: 2 - i }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: card.c, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.r}</div>
                      <div style={{ fontSize: 14, textAlign: 'center', color: card.c, lineHeight: 1 }}>{card.s}</div>
                      <div style={{ position: 'absolute', inset: 0, borderRadius: 5, background: 'linear-gradient(135deg,rgba(255,255,255,.5) 0%,transparent 60%)', pointerEvents: 'none' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '3px 12px', borderRadius: 999, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)' }}>
                <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: '#34d399' }}>9</span>
                <span style={{ fontSize: 8, color: 'rgba(16,185,129,.4)', alignSelf: 'center', fontFamily: 'Cinzel,serif', letterSpacing: '.2em' }}>vs</span>
                <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: '#34d399' }}>9</span>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.88))', pointerEvents: 'none' }} />
          </div>
          <div style={{ padding: '10px 14px 14px', background: 'rgba(0,5,3,.97)' }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '.04em' }}>Baccarat</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 19, color: '#10b981', textShadow: '0 0 12px rgba(16,185,129,.6)' }}>8×</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.28)', letterSpacing: '.08em' }}>tie payout</span>
            </div>
          </div>
        </Link>

        {/* Tower of Chance */}
        <Link href="/tower" className="vl-sq" style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          aspectRatio: '1', display: 'flex', flexDirection: 'column',
          textDecoration: 'none', color: 'inherit',
          boxShadow: '0 6px 24px rgba(0,0,0,.6)',
          border: '1px solid rgba(234,179,8,.18)',
        }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, #1e1400 0%, #0e0a00 60%, #040300 100%)' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {[
                { f: 8, m: '300×', w: 126, o: 1 },
                { f: 7, m: '100×', w: 108, o: .8 },
                { f: 6, m: '40×',  w: 90,  o: .6 },
                { f: 5, m: '15×',  w: 74,  o: .4 },
              ].map((fl, i) => (
                <div key={i} style={{ width: fl.w, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 9px', background: `rgba(255,200,0,${fl.o * 0.1})`, border: `1px solid rgba(234,179,8,${fl.o * 0.35})`, opacity: fl.o }}>
                  <span style={{ fontFamily: 'Cinzel,serif', fontSize: 8, color: '#eab308', opacity: .7 }}>F{fl.f}</span>
                  <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 13, color: '#fbbf24', textShadow: fl.o > .6 ? '0 0 10px rgba(234,179,8,.6)' : 'none' }}>{fl.m}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.88))', pointerEvents: 'none' }} />
          </div>
          <div style={{ padding: '10px 14px 14px', background: 'rgba(5,4,0,.97)' }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '.04em' }}>Tower</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 19, color: '#eab308', textShadow: '0 0 12px rgba(234,179,8,.6)' }}>300×</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.28)', letterSpacing: '.08em' }}>max payout</span>
            </div>
          </div>
        </Link>

      </div>

      {/* ── Sports Banner — completely different aesthetic ─────────────────── */}
      <Link href="/sports" className="vl-sports" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', borderRadius: 20, textDecoration: 'none', color: 'inherit',
        height: 140, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #020b1e 0%, #050f2a 40%, #020712 100%)',
        border: '1px solid rgba(59,130,246,.2)',
        boxShadow: '0 6px 30px rgba(0,0,0,.6), inset 0 1px 0 rgba(59,130,246,.1)',
      }}>
        <div style={{ position: 'absolute', left: -60, top: -40, width: 300, height: 220, background: 'radial-gradient(circle, rgba(59,130,246,.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 120, top: -30, width: 240, height: 200, background: 'radial-gradient(circle, rgba(99,102,241,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.35)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulseLive 1.5s infinite' }} />
              <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 9, letterSpacing: '.28em', color: '#f87171' }}>LIVE</span>
            </div>
          </div>
          <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 30, color: '#fff', letterSpacing: '.04em', lineHeight: 1 }}>Sports Book</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.32)', marginTop: 7, letterSpacing: '.07em', fontFamily: 'Cinzel,serif' }}>Predict real events · Win 2× your chips</div>
        </div>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 20, fontSize: 36 }}>
          <span style={{ filter: 'drop-shadow(0 0 14px rgba(255,120,40,.7))' }}>🏀</span>
          <span style={{ filter: 'drop-shadow(0 0 14px rgba(80,160,255,.7))' }}>🏈</span>
          <span style={{ filter: 'drop-shadow(0 0 14px rgba(80,200,80,.6))' }}>⚽</span>
          <span style={{ filter: 'drop-shadow(0 0 14px rgba(217,182,90,.5))' }}>⛳</span>
        </div>
        <div style={{ position: 'relative', zIndex: 2, padding: '15px 30px', borderRadius: 999, background: 'linear-gradient(135deg,#1d4ed8,#1e40af)', color: '#fff', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 12, letterSpacing: '.18em', boxShadow: '0 4px 0 #1e3a8a, 0 8px 30px rgba(29,78,216,.5)', flexShrink: 0 }}>PLACE BETS</div>
      </Link>

      {/* Balance / top-up strip */}
      {refillEnabled && !isFlush && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'rgba(217,182,90,.05)', borderRadius: 14, border: '1px solid rgba(217,182,90,.14)' }}>
          <div>
            <div style={{ fontSize: 9, color: 'rgba(217,182,90,.45)', letterSpacing: '.28em', fontFamily: 'Cinzel,serif', marginBottom: 3, textTransform: 'uppercase' }}>Your Balance</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 28, background: 'linear-gradient(160deg,#f3dd96,#d9b65a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fmt(chips)}</div>
          </div>
          <button onClick={onRefill} style={{ padding: '12px 24px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'linear-gradient(160deg,#f3dd96,#d9b65a 38%,#9c7b2e)', color: '#2a1f08', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 11, letterSpacing: '.2em', boxShadow: '0 4px 0 #6e521c, 0 6px 20px rgba(0,0,0,.3)' }}>TOP UP</button>
        </div>
      )}

      <style>{`
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes pulseLive { 0%,100%{opacity:1;} 50%{opacity:.35;} }
        .vl-hero { transition: transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s; }
        .vl-hero:hover { transform: scale(1.018) !important; box-shadow: 0 20px 70px rgba(0,0,0,.75) !important; }
        .vl-sq { transition: transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s; }
        .vl-sq:hover { transform: translateY(-7px) !important; box-shadow: 0 16px 44px rgba(0,0,0,.7) !important; }
        .vl-sports { transition: transform .2s, box-shadow .2s; }
        .vl-sports:hover { transform: translateY(-3px) !important; box-shadow: 0 14px 44px rgba(29,78,216,.18), 0 8px 30px rgba(0,0,0,.6) !important; }
        @media (max-width: 900px) {
          .vl-quad { grid-template-columns: repeat(2,1fr) !important; }
          .vl-sports { flex-direction: column !important; height: auto !important; padding: 24px 24px !important; gap: 18px !important; align-items: flex-start !important; }
        }
        @media (max-width: 640px) {
          .vl-hero-row { grid-template-columns: 1fr !important; }
          .vl-quad { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>
    </div>
  )
}
