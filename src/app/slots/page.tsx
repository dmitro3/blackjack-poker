'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STRIP = ['🍋','🍒','🍋','BAR','🍒','🍋','🔔','🍒','BAR','🍋','🍒','🍋','🔔','🍒','🍋','BAR','🍒','🍋','🔔','🍋','🍒','BAR','🍋','🍒','♦','🍋','🍒','🔔','BAR','🍒','🍋','🍒','🔔','🍋','🍒','7','🍋','🍒','BAR','🔔','🍋','🍒','BAR','🍒','🍋','🔔','🍒','♦']
const SYM_COLOR: Record<string,string> = { '7':'#d9b65a','♦':'#4fc8f0','BAR':'#aab8c8','🔔':'#f5c842','🍒':'#e73d5c','🍋':'#d4d44a' }
const PAYS: [string[], number, string][] = [
  [['7','7','7'],    100, '100×'],
  [['♦','♦','♦'],    50, '50×'],
  [['BAR','BAR','BAR'], 20,'20×'],
  [['🔔','🔔','🔔'],   10, '10×'],
  [['🍒','🍒','🍒'],    8, '8×'],
  [['🍋','🍋','🍋'],    5, '5×'],
]

const BETS = [500, 1000, 5000, 25000]

function fmt(n: number) { return Number(n).toLocaleString('en-US') }
function fmtShort(n: number) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M'
  if (n >= 1e3) return (n/1e3).toFixed(n%1e3===0?0:1)+'K'
  return ''+n
}

function randomSym(): string { return STRIP[Math.floor(Math.random() * STRIP.length)] }
function payout(syms: string[], bet: number): number {
  const match = PAYS.find(([s]) => s[0]===syms[0] && s[1]===syms[1] && s[2]===syms[2])
  if (match) return bet * match[1]
  // Two cherries
  const cherries = syms.filter(s => s === '🍒').length
  if (cherries === 2) return bet * 3
  if (cherries === 1) return bet
  return 0
}

function Reel({ sym, spinning, delay }: { sym: string; spinning: boolean; delay: number }) {
  const [displaySym, setDisplaySym] = useState(sym)
  const [blur, setBlur] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (spinning) {
      setBlur(true)
      intervalRef.current = setInterval(() => setDisplaySym(randomSym()), 60)
    } else {
      const t = setTimeout(() => {
        clearInterval(intervalRef.current!)
        setBlur(false)
        setDisplaySym(sym)
      }, delay)
      return () => clearTimeout(t)
    }
    return () => clearInterval(intervalRef.current!)
  }, [spinning, sym, delay])

  return (
    <div style={{
      width: 150, height: 180, display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(180deg,#1a1306,#0d0a04)',
      borderRadius:18,
      border: blur ? '2px solid rgba(217,182,90,.2)' : '2px solid rgba(217,182,90,.55)',
      boxShadow: blur ? 'none' : `0 0 18px rgba(${SYM_COLOR[displaySym] === '#d9b65a' ? '217,182,90' : SYM_COLOR[displaySym] === '#4fc8f0' ? '79,200,240' : '255,255,255'},.25), inset 0 0 20px rgba(0,0,0,.6)`,
      userSelect:'none',
      filter: blur ? 'blur(4px)' : 'none',
      transition: blur ? 'none' : 'filter .15s, box-shadow .2s',
      color: SYM_COLOR[displaySym] || '#fff',
      fontFamily: displaySym === 'BAR' || displaySym === '7' ? 'Cinzel, serif' : 'inherit',
      fontWeight: displaySym === 'BAR' || displaySym === '7' ? 900 : 400,
      fontSize: displaySym === 'BAR' ? 36 : 68,
      textShadow: blur ? 'none' : `0 0 20px ${SYM_COLOR[displaySym] || '#fff'}88`,
    }}>
      {displaySym}
    </div>
  )
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  const bg = kind==='win'?'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)':kind==='lose'?'linear-gradient(160deg,#6a1325,#440b18)':'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{position:'fixed',left:'50%',bottom:38,transform:'translateX(-50%)',zIndex:9999,padding:'13px 26px',borderRadius:999,fontFamily:'Cinzel,serif',fontWeight:600,letterSpacing:'.05em',boxShadow:'0 14px 40px rgba(0,0,0,.5)',border:'1px solid rgba(217,182,90,.5)',background:bg,color:kind==='win'?'#2a1f08':'var(--cream)',animation:'floatUp .35s'}}>{msg}</div>
}

export default function SlotsPage() {
  const [bal, setBal] = useState(100000)
  const [bet, setBet] = useState(1000)
  const [syms, setSyms] = useState<string[]>(['🍒', '🍒', '🍋'])
  const [spinning, setSpinning] = useState(false)
  const [lastNet, setLastNet] = useState<number | null>(null)
  const [toast, setToast] = useState<{msg:string,kind:string}|null>(null)
  const [loading, setLoading] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [autoSpin, setAutoSpin] = useState(false)
  const autoRef = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('chips').eq('id', user.id).single()
      if (profile) setBal(profile.chips)
      setLoading(false)
    }
    init()
  }, [router])

  const spin = useCallback(async () => {
    if (spinning || bal < bet) return
    setBal(b => b - bet)
    setSpinning(true)
    setLastNet(null)
    const result = [randomSym(), randomSym(), randomSym()]
    await new Promise<void>(r => setTimeout(r, 2200))
    setSyms(result)
    setSpinning(false)
    const win = payout(result, bet)
    const net = win - bet
    setBal(b => b + win)
    setLastNet(net)
    const label = result.join(' ')
    if (net > 0) {
      setToast({ msg: `${label}  +${fmt(net)}`, kind: 'win' })
    } else {
      setToast({ msg: label, kind: 'lose' })
    }
    try {
      await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'slots', chips_wagered: bet, chips_won: win }),
      })
    } catch { /* best effort */ }
  }, [spinning, bal, bet])

  // Auto-spin loop
  useEffect(() => {
    autoRef.current = autoSpin
  }, [autoSpin])

  useEffect(() => {
    if (!autoSpin || spinning) return
    const t = setTimeout(() => {
      if (autoRef.current) spin()
    }, 600)
    return () => clearTimeout(t)
  }, [autoSpin, spinning, spin])

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>Loading…</div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'radial-gradient(120% 80% at 50% -10%, #241f15 0%, #13110b 45%, #0b0a07 100%)'}}>
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 24px',background:'linear-gradient(180deg,rgba(11,10,7,.95),rgba(11,10,7,.2))'}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',color:'var(--cream-dim)',fontFamily:'var(--fs-head)',fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',padding:'9px 16px',borderRadius:999,border:'1px solid rgba(217,182,90,.25)'}}>
          ← Lobby
        </Link>
        <div style={{textAlign:'center'}}>
          <div className="gold-text" style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:20,letterSpacing:'.14em'}}>SLOTS</div>
          <div style={{fontFamily:'var(--fs-head)',fontSize:9,letterSpacing:'.4em',color:'var(--cream-faint)'}}>CLASSIC THREE REEL</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHelp(true)}>How to Play</button>
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(bal)}</span>
          </div>
        </div>
      </header>

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,gap:32}}>
        {/* Machine cabinet */}
        <div style={{
          background:'linear-gradient(180deg,#231b0f,#160f07)',
          border:'2px solid rgba(217,182,90,.5)',borderRadius:36,
          padding:'36px 48px 44px',
          boxShadow:'0 40px 100px rgba(0,0,0,.8), inset 0 2px 0 rgba(217,182,90,.4), inset 0 -2px 0 rgba(0,0,0,.6)',
          maxWidth:580,width:'100%',
          position:'relative',
        }}>
          {/* Corner accents */}
          {[{top:16,left:16},{top:16,right:16},{bottom:16,left:16},{bottom:16,right:16}].map((pos,i) => (
            <div key={i} style={{position:'absolute',...pos,width:12,height:12,borderRadius:3,background:'var(--gold-d)',opacity:.7}}/>
          ))}

          {/* Marquee */}
          <div style={{textAlign:'center',marginBottom:32,position:'relative'}}>
            <div style={{
              display:'inline-block',
              background:'linear-gradient(180deg,#0b0a07,#1a130a)',
              border:'1px solid rgba(217,182,90,.4)',
              borderRadius:12,padding:'10px 32px',
              boxShadow:'inset 0 0 20px rgba(0,0,0,.5), 0 0 30px rgba(217,182,90,.1)',
            }}>
              <div className="gold-text" style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:34,letterSpacing:'.35em'}}>
                HOUSE SLOTS
              </div>
            </div>
            <div style={{fontFamily:'var(--fs-head)',fontSize:10,letterSpacing:'.5em',color:'var(--cream-faint)',marginTop:10,textTransform:'uppercase'}}>
              Classic Three Reel · Pull &amp; Win
            </div>
          </div>

          {/* Reels frame */}
          <div style={{
            background:'#0a0806',border:'3px solid rgba(217,182,90,.4)',borderRadius:22,
            padding:'20px 24px 16px',marginBottom:20,
            boxShadow:'inset 0 8px 30px rgba(0,0,0,.8), inset 0 0 0 1px rgba(217,182,90,.1)',
            position:'relative',
          }}>
            {/* Win line indicator */}
            <div style={{position:'absolute',left:-28,top:'50%',transform:'translateY(-50%)',display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:spinning?'rgba(217,182,90,.2)':'var(--gold)',boxShadow:spinning?'none':'0 0 8px var(--gold)',transition:'.3s'}}/>
              <div style={{width:16,height:2,background:'rgba(217,182,90,.4)'}}/>
            </div>
            <div style={{position:'absolute',right:-28,top:'50%',transform:'translateY(-50%)',display:'flex',alignItems:'center',gap:4,flexDirection:'row-reverse'}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:spinning?'rgba(217,182,90,.2)':'var(--gold)',boxShadow:spinning?'none':'0 0 8px var(--gold)',transition:'.3s'}}/>
              <div style={{width:16,height:2,background:'rgba(217,182,90,.4)'}}/>
            </div>
            {/* Win line across reels */}
            <div style={{position:'absolute',top:'50%',left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,rgba(217,182,90,${lastNet !== null && lastNet > 0 && !spinning ? '.9' : '.25'}),transparent)`,transform:'translateY(-50%)',pointerEvents:'none',transition:'.3s'}}/>
            <div style={{display:'flex',gap:16,justifyContent:'center',alignItems:'center'}}>
              <Reel sym={syms[0]} spinning={spinning} delay={0} />
              <Reel sym={syms[1]} spinning={spinning} delay={350} />
              <Reel sym={syms[2]} spinning={spinning} delay={700} />
            </div>
          </div>

          {/* Result display */}
          <div style={{textAlign:'center',height:38,marginBottom:20}}>
            {lastNet !== null && !spinning ? (
              <div style={{
                fontFamily:'var(--fs-head)',fontWeight:700,fontSize:22,
                color: lastNet > 0 ? 'var(--gold-l)' : lastNet < 0 ? '#e7708a' : 'var(--cream-dim)',
                animation:'floatUp .35s',
                textShadow: lastNet > 0 ? '0 0 20px rgba(217,182,90,.6)' : 'none',
                letterSpacing:'.1em',
              }}>
                {lastNet > 0 ? `✦ WIN  +${fmt(lastNet)} ✦` : lastNet < 0 ? 'No match — try again' : 'Your bet returned'}
              </div>
            ) : spinning ? (
              <div style={{fontFamily:'var(--fs-head)',fontSize:13,letterSpacing:'.4em',color:'var(--cream-faint)',animation:'none',textTransform:'uppercase'}}>
                Good luck…
              </div>
            ) : null}
          </div>

          {/* Bet selector */}
          <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center',marginBottom:24}}>
            <span style={{fontFamily:'var(--fs-head)',fontSize:11,letterSpacing:'.25em',color:'var(--cream-faint)',textTransform:'uppercase',marginRight:4}}>Bet</span>
            {BETS.map(b => (
              <button key={b} onClick={() => { if (!spinning) setBet(b) }}
                style={{
                  padding:'10px 20px',borderRadius:999,
                  fontFamily:'var(--fs-head)',fontWeight:700,fontSize:13,letterSpacing:'.06em',
                  border:'1px solid rgba(217,182,90,'+(bet===b?'.9':'.25')+')',
                  background:bet===b?'rgba(217,182,90,.2)':'rgba(0,0,0,.4)',
                  color:bet===b?'var(--gold-l)':'var(--cream-dim)',
                  cursor:'pointer',transition:'.15s',
                  boxShadow:bet===b?'0 0 12px rgba(217,182,90,.2)':'none',
                }}>
                {fmtShort(b)}
              </button>
            ))}
          </div>

          {/* Spin button */}
          <div style={{display:'flex',gap:14,justifyContent:'center'}}>
            <button
              className="btn"
              style={{minWidth:220,fontSize:20,padding:'18px 48px',letterSpacing:'.15em',opacity: spinning || bal < bet ? .5 : 1}}
              disabled={spinning || bal < bet}
              onClick={spin}
            >
              {spinning ? 'Spinning…' : '▶  SPIN'}
            </button>
            <button
              className={'btn btn-sm' + (autoSpin ? '' : ' btn-ghost')}
              style={{fontSize:12,padding:'10px 20px',minWidth:90}}
              onClick={() => setAutoSpin(v => !v)}
              disabled={bal < bet && !autoSpin}
            >
              Auto {autoSpin ? 'ON' : 'OFF'}
            </button>
          </div>

          {bal < bet && !spinning && (
            <div style={{textAlign:'center',marginTop:16}}>
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                const res = await fetch('/api/game/session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ game:'refill', chips_wagered:0, chips_won:100000 }) })
                if (res.ok) { const d = await res.json(); setBal(d.chips); setToast({msg:'Topped up!',kind:'win'}) }
              }}>
                Out of chips — Refill
              </button>
            </div>
          )}
        </div>

        {/* Pay table */}
        <div style={{background:'rgba(0,0,0,.4)',border:'1px solid rgba(217,182,90,.2)',borderRadius:18,padding:'20px 28px',maxWidth:380,width:'100%'}}>
          <div style={{fontFamily:'var(--fs-head)',letterSpacing:'.3em',fontSize:11,color:'var(--gold)',textTransform:'uppercase',textAlign:'center',marginBottom:14}}>Pay Table</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {PAYS.map(([syms, , label]) => (
              <div key={syms.join('-')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid rgba(217,182,90,.08)'}}>
                <span style={{fontSize:22,letterSpacing:4}}>{syms.map((s,i) => <span key={i} style={{color:SYM_COLOR[s]||'#fff',fontFamily:s==='BAR'||s==='7'?'Cinzel,serif':'inherit',fontWeight:s==='BAR'||s==='7'?900:400,fontSize:s==='BAR'?16:22}}>{s}</span>)}</span>
                <span style={{fontFamily:'var(--fs-head)',fontWeight:700,color:'var(--gold-l)',fontSize:15}}>{label}</span>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid rgba(217,182,90,.08)'}}>
              <span style={{fontSize:22,letterSpacing:4}}><span style={{color:SYM_COLOR['🍒']}}>🍒</span><span style={{color:SYM_COLOR['🍒']}}>🍒</span> <span style={{color:'var(--cream-faint)',fontSize:16}}>any</span></span>
              <span style={{fontFamily:'var(--fs-head)',fontWeight:700,color:'var(--gold-l)',fontSize:15}}>3×</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0'}}>
              <span style={{fontSize:22,letterSpacing:4}}><span style={{color:SYM_COLOR['🍒']}}>🍒</span> <span style={{color:'var(--cream-faint)',fontSize:16}}>any any</span></span>
              <span style={{fontFamily:'var(--fs-head)',fontWeight:700,color:'var(--gold-l)',fontSize:15}}>1× (return)</span>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play modal */}
      {showHelp && (
        <div style={{position:'fixed',inset:0,background:'rgba(5,4,2,.8)',backdropFilter:'blur(5px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',animation:'floatUp .2s'}} onClick={() => setShowHelp(false)}>
          <div className="gilt" style={{width:480,maxWidth:'92vw',padding:36,borderRadius:'var(--radius-lg)',position:'relative',maxHeight:'85vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
            <button style={{position:'absolute',top:16,right:18,background:'none',border:'none',color:'var(--cream-faint)',fontSize:24,cursor:'pointer',lineHeight:1}} onClick={() => setShowHelp(false)}>×</button>
            <h2 className="gold-text" style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:24,margin:'0 0 20px'}}>How to Play Slots</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,color:'var(--cream-dim)',fontSize:14,lineHeight:1.65}}>
              <p><strong style={{color:'var(--cream)'}}>Objective:</strong> Match symbols across all three reels on the center payline to win.</p>
              <p><strong style={{color:'var(--cream)'}}>Betting:</strong> Choose your bet amount — 500, 1K, 5K, or 25K — then hit Spin. Each spin costs your chosen bet.</p>
              <div>
                <strong style={{color:'var(--cream)'}}>Payouts (on your bet):</strong>
                <ul style={{margin:'8px 0 0 16px',display:'flex',flexDirection:'column',gap:4}}>
                  <li><span style={{color:'#d9b65a'}}>7 7 7</span> — 100× your bet (jackpot!)</li>
                  <li><span style={{color:'#4fc8f0'}}>♦ ♦ ♦</span> — 50× your bet</li>
                  <li>BAR BAR BAR — 20×</li>
                  <li>🔔 🔔 🔔 — 10×</li>
                  <li>🍒 🍒 🍒 — 8×</li>
                  <li>🍋 🍋 🍋 — 5×</li>
                  <li>🍒 🍒 + any — 3×</li>
                  <li>🍒 + any + any — return your bet</li>
                </ul>
              </div>
              <p><strong style={{color:'var(--cream)'}}>Auto Spin:</strong> Toggle Auto to spin automatically after each result. Turn it off anytime.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
