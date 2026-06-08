'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { playChip, playWin, playLose, startTension, stopTension, setMuted } from '@/lib/casino-sounds'
import { generateCode, prettyCode } from '@/lib/invite-codes'

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
const SEG = 360/WHEEL.length
const CHIPS_DEF = [
  { v:1000, color:'#3a3a3a', label:'1K' },
  { v:5000, color:'#b3122a', label:'5K' },
  { v:25000, color:'#137a4a', label:'25K' },
  { v:100000, color:'#2a2a6e', label:'100K' },
]
const colOf = (n: number) => n===0?'green':(RED.has(n)?'red':'black')
const COLORHEX: Record<string,string> = { green:'#137a4a', red:'#c4152e', black:'#1a1a1a' }

function fmt(n: number) { return Number(n).toLocaleString('en-US') }
function fmtShort(n: number) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M'
  if (n >= 1e3) return (n/1e3).toFixed(n%1e3===0?0:1)+'K'
  return ''+n
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  const bg = kind==='win'?'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)':kind==='lose'?'linear-gradient(160deg,#6a1325,#440b18)':'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{position:'fixed',left:'50%',bottom:38,transform:'translateX(-50%)',zIndex:9999,padding:'13px 26px',borderRadius:999,fontFamily:'Cinzel,serif',fontWeight:600,letterSpacing:'.05em',boxShadow:'0 14px 40px rgba(0,0,0,.5)',border:'1px solid rgba(217,182,90,.5)',background:bg,color:kind==='win'?'#2a1f08':'var(--cream)',animation:'floatUp .35s'}}>{msg}</div>
}

export default function RoulettePage() {
  const [bets, setBets] = useState<Record<string, number>>({})
  const [chip, setChip] = useState(5000)
  const [spinning, setSpinning] = useState(false)
  const [win, setWin] = useState<{num:number,net:number}|null>(null)
  const [bal, setBal] = useState(100000)
  const [toast, setToast] = useState<{msg:string,kind:string}|null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [muted, setMutedUI] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const rotRef = useRef(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    try { setMutedUI(localStorage.getItem('casinoMuted') === '1') } catch {}
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('chips').eq('id', user.id).single()
      if (profile) {
        setBal(profile.chips)
      }
      setLoading(false)
    }
    init()
  }, [router])

  function showToast(msg: string, kind = '') { setToast({ msg, kind }) }

  const total = Object.values(bets).reduce((a, b) => a+b, 0)

  function place(key: string) {
    if (spinning) return
    if (bal < chip) { showToast('Not enough chips'); return }
    playChip()
    setBal(b => b - chip)
    setBets(b => ({ ...b, [key]: (b[key]||0)+chip }))
    setWin(null)
  }

  function clearAll() {
    if (spinning || total === 0) return
    setBal(b => b + total)
    setBets({})
    setWin(null)
  }

  function betWins(key: string, w: number): boolean {
    if (key.startsWith('n-')) return parseInt(key.slice(2), 10) === w
    switch (key) {
      case 'red': return RED.has(w)
      case 'black': return w !== 0 && !RED.has(w)
      case 'odd': return w !== 0 && w%2 === 1
      case 'even': return w !== 0 && w%2 === 0
      case 'low': return w >= 1 && w <= 18
      case 'high': return w >= 19 && w <= 36
      case 'dozen-1': return w >= 1 && w <= 12
      case 'dozen-2': return w >= 13 && w <= 24
      case 'dozen-3': return w >= 25 && w <= 36
      case 'col-1': return w !== 0 && w%3 === 1
      case 'col-2': return w !== 0 && w%3 === 2
      case 'col-3': return w !== 0 && w%3 === 0
      default: return false
    }
  }

  function mult(key: string): number {
    if (key.startsWith('n-')) return 36
    if (key.startsWith('dozen') || key.startsWith('col')) return 3
    return 2
  }

  async function spin() {
    if (spinning || total === 0) return
    setSpinning(true); setWin(null)
    startTension()
    const idx = Math.floor(Math.random() * WHEEL.length)
    const w = WHEEL[idx]
    const target = 360*6 - idx*SEG - rotRef.current%360
    rotRef.current += target
    if (wheelRef.current) wheelRef.current.style.transform = `rotate(${rotRef.current}deg)`
    const ballR = Math.round((wheelRef.current?.offsetWidth ?? 304) * 0.434)
    if (ballRef.current) ballRef.current.style.transform =
      `rotate(${-360*9 - rotRef.current}deg) translate(0, -${ballR}px) rotate(${360*9 + rotRef.current}deg)`

    setTimeout(async () => {
      let winnings = 0
      const wagered = total
      Object.keys(bets).forEach(k => { if (betWins(k, w)) winnings += bets[k]*mult(k) })

      stopTension()
      setBal(b => b + winnings)
      const net = winnings - wagered
      setWin({ num: w, net })
      setSpinning(false)
      if (net > 0) playWin(); else if (net < 0) playLose()
      const label = w===0?'Zero':(colOf(w)==='red'?'Red ':'Black ')+w
      showToast(label+(net>0?'  +'+fmt(net):net<0?'  −'+fmt(wagered):''), net>0?'win':(net<0?'lose':''))
      setBets({})

      // Log to Supabase
      try {
        await fetch('/api/game/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: 'roulette', chips_wagered: wagered, chips_won: winnings }),
        })
      } catch { /* best effort */ }
    }, 5500)
  }

  const pockets = WHEEL.map((n, i) => (
    <div key={i} className="pocket" style={{transform:`rotate(${i*SEG}deg)`}}>
      <div className="num">{n}</div>
    </div>
  ))

  const numCells: React.ReactNode[] = []
  for (let n = 1; n <= 36; n++) {
    const col = Math.ceil(n/3)
    const row = n%3===0?1:(n%3===2?2:3)
    numCells.push(
      <div key={n} className={'cell '+colOf(n)} style={{gridColumn:col,gridRow:row}} onClick={() => place('n-'+n)}>
        {n}{bets['n-'+n] ? <span className="placed" style={{background:'#2a2a6e'}}>{fmtShort(bets['n-'+n])}</span> : null}
      </div>
    )
  }

  const Chip = ({ k, bg }: { k: string; bg?: string }) =>
    bets[k] ? <span className="placed" style={{background:bg||'#2a2a6e'}}>{fmtShort(bets[k])}</span> : null

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>Loading…</div>
    </div>
  )

  return (
    <div className="table-wrap">
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      <header className="topbar">
        <Link className="back" href="/">← Lobby</Link>
        <div className="title-c">
          <div className="t gold-text">ROULETTE</div>
          <div className="s">EUROPEAN · SINGLE ZERO</div>
        </div>
        <div className="right">
          <button className="btn btn-sm btn-ghost rlt-desk" onClick={() => setShowHelp(true)}>How to Play</button>
          <button className="btn btn-sm btn-ghost rlt-desk" onClick={() => { setInviteCode(generateCode('roulette')); setShowInvite(true) }}>Invite</button>
          <button
            className="btn btn-sm btn-ghost"
            style={{fontSize:18, padding:'8px 13px', lineHeight:1, minWidth:0}}
            onClick={() => { const next = !muted; setMutedUI(next); setMuted(next) }}
            title={muted ? 'Unmute' : 'Mute'}
          >{muted ? '🔇' : '🔊'}</button>
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(bal)}</span>
          </div>
        </div>
      </header>

      <div className="stage">
        <div className="wheel-side">
          <div className="wheel-housing" onClick={() => {
            if (spinning) return
            if (total === 0) { showToast('Place a bet first', ''); return }
            spin()
          }}>
            <div className="pointer" />
            <div className="wheel-rim" />
            <div className="wheel" ref={wheelRef}>
              <svg viewBox="0 0 304 304" style={{position:'absolute',inset:0,width:'100%',height:'100%'}} aria-hidden="true">
                {WHEEL.map((n, i) => {
                  const a1 = (i*SEG - SEG/2 - 90) * Math.PI/180
                  const a2 = ((i+1)*SEG - SEG/2 - 90) * Math.PI/180
                  const r = 151, cx = 152, cy = 152
                  const x1 = (cx + r*Math.cos(a1)).toFixed(2), y1 = (cy + r*Math.sin(a1)).toFixed(2)
                  const x2 = (cx + r*Math.cos(a2)).toFixed(2), y2 = (cy + r*Math.sin(a2)).toFixed(2)
                  return <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`} fill={COLORHEX[colOf(n)]} stroke="rgba(0,0,0,.35)" strokeWidth="2"/>
                })}
              </svg>
              {pockets}
            </div>
            <div className="hub" />
            <div className="ball" ref={ballRef} />
            {!spinning && <div className="tap-spin-hint" aria-hidden="true">{total > 0 ? 'TAP' : 'BET'}</div>}
          </div>
          <div className="result-disp">
            {win ? (
              <>
                <div className="result-num" style={{background: colOf(win.num)==='red'?'linear-gradient(160deg,#c4152e,#8f0f22)':colOf(win.num)==='green'?'linear-gradient(160deg,#137a4a,#0c5230)':'linear-gradient(160deg,#262626,#111)'}}>
                  {win.num}
                </div>
                <div className="result-net" style={{color: win.net>0?'#5fd99a':win.net<0?'#e7708a':'var(--cream-dim)'}}>
                  {win.net>0?'You win +'+fmt(win.net):win.net<0?'No luck':'Even money'}
                </div>
              </>
            ) : (
              <div className="result-net muted">{spinning ? 'No more bets…' : 'Place your bets'}</div>
            )}
          </div>
        </div>

        <div className="board-side">
          <div className="board-scroll">
            <div className="board">
              <div className="cell zero green" onClick={() => place('n-0')} style={{position:'relative'}}>
                0<Chip k="n-0" bg="#137a4a" />
              </div>
              <div style={{flex:1,display:'flex',flexDirection:'column'}}>
                <div style={{display:'flex'}}>
                  <div className="numbers" style={{flex:1}}>{numCells}</div>
                  <div className="colbets">
                    {[1,2,3].map(c => (
                      <div key={c} className="cell" onClick={() => place('col-'+c)}>2:1<Chip k={'col-'+c}/></div>
                    ))}
                  </div>
                </div>
                <div className="lower">
                  <div className="dozens">
                    <div className="cell" onClick={() => place('dozen-1')}>1st 12<Chip k="dozen-1"/></div>
                    <div className="cell" onClick={() => place('dozen-2')}>2nd 12<Chip k="dozen-2"/></div>
                    <div className="cell" onClick={() => place('dozen-3')}>3rd 12<Chip k="dozen-3"/></div>
                  </div>
                  <div className="outside">
                    <div className="cell" onClick={() => place('low')}>1–18<Chip k="low"/></div>
                    <div className="cell" onClick={() => place('even')}>EVEN<Chip k="even"/></div>
                    <div className="cell red" onClick={() => place('red')}>RED<Chip k="red" bg="#8f0f22"/></div>
                    <div className="cell black" onClick={() => place('black')}>BLACK<Chip k="black" bg="#000"/></div>
                    <div className="cell" onClick={() => place('odd')}>ODD<Chip k="odd"/></div>
                    <div className="cell" onClick={() => place('high')}>19–36<Chip k="high"/></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="ctrl">
            <div className="chip-sel">
              {CHIPS_DEF.map(c => (
                <div key={c.v} className={'chip'+(chip===c.v?' sel':'')} style={{background:c.color}} onClick={() => setChip(c.v)}>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
            <div className="ctrl-right">
              <span className="total-bet">In play <b className="tabnum">{fmt(total)}</b></span>
              <button className="btn btn-ghost btn-sm" onClick={clearAll} disabled={spinning||total===0}>Clear</button>
              <button className="btn" onClick={spin} disabled={spinning||total===0}>Spin</button>
            </div>
          </div>
        </div>
      </div>

      {showInvite && (
        <div className="modal-bg" onClick={() => setShowInvite(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()}>
            <button className="x" onClick={() => setShowInvite(false)}>×</button>
            <h2 className="gold-text">Invite to the wheel</h2>
            <p>Share this code with a friend and they&apos;ll join your Roulette table.</p>
            <div style={{textAlign:'center',margin:'18px 0'}}>
              <div style={{fontFamily:'var(--fs-head)',fontSize:36,fontWeight:800,letterSpacing:'.15em',color:'var(--gold-l)',background:'rgba(0,0,0,.4)',border:'1px solid rgba(217,182,90,.3)',borderRadius:14,padding:'18px 28px',display:'inline-block'}}>{prettyCode(inviteCode)}</div>
            </div>
            <div className="invite-field">
              <button className="btn" style={{flex:1}} onClick={() => { navigator.clipboard.writeText(prettyCode(inviteCode)).then(() => showToast('Code copied!','win')) }}>Copy Code</button>
            </div>
            <div className="seatnote">European single-zero · Your chips carry across every HouseTables table.</div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-bg" onClick={() => setShowHelp(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()} style={{maxHeight:'85vh',overflowY:'auto',width:500}}>
            <button className="x" onClick={() => setShowHelp(false)}>×</button>
            <h2 className="gold-text">How to Play Roulette</h2>
            <div style={{display:'flex',flexDirection:'column',gap:12,color:'var(--cream-dim)',fontSize:14,lineHeight:1.65}}>
              <p><strong style={{color:'var(--cream)'}}>Objective:</strong> Place bets on where the ball will land on the wheel, then spin.</p>
              <p><strong style={{color:'var(--cream)'}}>Wheel:</strong> European single-zero wheel with 37 pockets (0–36). The 0 is green; 18 pockets are red, 18 are black.</p>
              <div>
                <strong style={{color:'var(--cream)'}}>Bet Types &amp; Payouts:</strong>
                <div style={{display:'flex',flexDirection:'column',gap:6,margin:'10px 0 0 0'}}>
                  {[['Straight Up (single number)','35:1'],['Red / Black','1:1'],['Odd / Even','1:1'],['Low (1–18) / High (19–36)','1:1'],['Dozens (1–12, 13–24, 25–36)','2:1'],['Columns','2:1']].map(([name,odds]) => (
                    <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid rgba(217,182,90,.1)'}}>
                      <span>{name}</span>
                      <span style={{fontFamily:'var(--fs-head)',fontWeight:700,color:'var(--gold-l)',marginLeft:16}}>{odds}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p><strong style={{color:'var(--cream)'}}>How to Bet:</strong> Select a chip size on the left, then click any spot on the board to place that chip. You can stack multiple chips on different spots before spinning.</p>
              <p><strong style={{color:'var(--cream)'}}>Note:</strong> If the ball lands on 0, only straight-up bets on 0 win. All other bets lose.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        html, body { height: 100%; overflow: hidden; }
        .table-wrap { height: 100vh; height: 100svh; display: flex; flex-direction: column; }
        .tap-spin-hint { display: none; }
        .topbar { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;z-index:30;background:linear-gradient(180deg, rgba(11,10,7,.95), rgba(11,10,7,.2)); }
        .back { display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--cream-dim);font-family:var(--fs-head);font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;border-radius:999px;border:1px solid rgba(217,182,90,.25);transition:.2s; }
        .back:hover { color:var(--gold-l);border-color:var(--gold); }
        .title-c { text-align:center; }
        .title-c .t { font-family:var(--fs-display);font-weight:900;font-size:20px;letter-spacing:.14em; }
        .title-c .s { font-family:var(--fs-head);font-size:9px;letter-spacing:.4em;color:var(--cream-faint); }
        .topbar .right { display:flex;align-items:center;gap:12px; }
        .stage { flex:1;display:grid;grid-template-columns:320px 1fr;gap:22px;padding:22px 22px 0;min-height:0;margin:0 18px 18px;border-radius:30px;border:1px solid rgba(217,182,90,.3);background:radial-gradient(120% 100% at 50% 0%,#137a4a 0%,#0c5a37 38%,#073b25 100%);box-shadow:inset 0 0 140px rgba(0,0,0,.45),inset 0 2px 0 rgba(255,255,255,.05); }
        .wheel-side { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px; }
        .wheel-housing { position:relative;width:330px;height:330px;cursor:pointer; }
        .wheel-housing > * { pointer-events:none; }
        .pointer { position:absolute;top:-6px;left:50%;transform:translateX(-50%);z-index:8;width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:22px solid var(--gold-l);filter:drop-shadow(0 3px 4px rgba(0,0,0,.6)); }
        .wheel-rim { position:absolute;inset:0;border-radius:50%;background:transparent;z-index:5;box-shadow:0 20px 50px rgba(0,0,0,.6), inset 0 0 0 8px var(--gold-d), inset 0 0 0 16px #1a130a; }
        .wheel { position:absolute;inset:13px;border-radius:50%;overflow:hidden;transition:transform 5.4s cubic-bezier(.16,.84,.28,1);will-change:transform; }
        .pocket { position:absolute;top:0;left:50%;width:28px;height:50%;transform-origin:bottom center;margin-left:-14px;display:flex;justify-content:center;pointer-events:none; }
        .pocket .num { color:#fff;font-family:var(--fs-head);font-weight:800;font-size:11px;width:100%;text-align:center;padding-top:7px;line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 6px rgba(0,0,0,.8); }
        .hub { position:absolute;inset:33%;border-radius:50%;background:var(--gold-grad);z-index:6;box-shadow:inset 0 2px 6px rgba(255,255,255,.5), inset 0 -4px 10px var(--gold-deep), 0 4px 12px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center; }
        .hub::after { content:"";width:42%;height:42%;border-radius:50%;background:#1a130a;box-shadow:inset 0 2px 4px rgba(0,0,0,.8); }
        .ball { position:absolute;top:50%;left:50%;width:13px;height:13px;border-radius:50%;z-index:7;background:radial-gradient(circle at 35% 30%, #fff, #c9c2ad 70%);box-shadow:0 2px 5px rgba(0,0,0,.6);transform-origin:0 0;transition:transform 5.4s cubic-bezier(.16,.84,.28,1); }
        .result-disp { display:flex;flex-direction:column;align-items:center;gap:6px;min-height:84px;justify-content:center; }
        .result-num { width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--fs-display);font-weight:900;font-size:28px;color:#fff;box-shadow:var(--shadow-pop);border:2px solid rgba(217,182,90,.5);animation:floatUp .4s; }
        .result-net { font-family:var(--fs-head);font-weight:700;letter-spacing:.05em;font-size:16px; }
        .board-side { display:flex;flex-direction:column;justify-content:center;gap:11px;min-width:0;background:rgba(11,10,7,.65);border-radius:18px;padding:16px;border:1px solid rgba(217,182,90,.25);backdrop-filter:blur(2px); }
        .board-scroll { overflow-x:auto;padding-bottom:6px; }
        .board { display:flex;font-family:var(--fs-head);font-weight:700;min-width:500px; }
        .cell { border:1px solid rgba(217,182,90,.28);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:.12s;user-select:none;color:#fff; }
        .cell:hover { box-shadow:inset 0 0 0 2px var(--gold-l);z-index:3; }
        .cell.red { background:linear-gradient(160deg,#c4152e,#8f0f22); }
        .cell.black { background:linear-gradient(160deg,#262626,#111); }
        .cell.green { background:linear-gradient(160deg,#137a4a,#0c5230); }
        .zero { width:42px;font-size:20px;border-radius:8px 0 0 8px; }
        .numbers { display:grid;grid-template-columns:repeat(12,1fr);grid-template-rows:repeat(3,41px);flex:1; }
        .numbers .cell { font-size:14px; }
        .colbets { display:grid;grid-template-rows:repeat(3,41px);width:46px; }
        .colbets .cell { font-size:12px;background:linear-gradient(160deg,#1b1810,#0b0a07);border-radius:0 8px 8px 0; }
        .lower { margin-left:42px; margin-right:46px; }
        .dozens { display:grid;grid-template-columns:repeat(3,1fr); }
        .outside { display:grid;grid-template-columns:repeat(6,1fr);margin-top:0; }
        .lower .cell { height:38px;font-size:12px;letter-spacing:.06em;background:linear-gradient(160deg,#1b1810,#0b0a07); }
        .lower .cell.red { background:linear-gradient(160deg,#c4152e,#8f0f22); }
        .lower .cell.black { background:linear-gradient(160deg,#262626,#111); }
        .placed { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:4;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:800;border:2px dashed rgba(255,255,255,.7);box-shadow:0 3px 8px rgba(0,0,0,.5);pointer-events:none;animation:floatUp .25s; }
        .ctrl { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:14px 24px 18px;border-top:1px solid rgba(217,182,90,.18); }
        .chip-sel { display:flex;gap:10px;align-items:center; }
        .chip-sel .chip { width:54px;height:54px;font-size:13px; }
        .chip-sel .chip.sel { outline:3px solid var(--gold-l);outline-offset:2px;transform:translateY(-4px); }
        .ctrl-right { display:flex;gap:10px;align-items:center; }
        .total-bet { font-family:var(--fs-head);font-size:14px;color:var(--cream-dim);margin-right:6px; }
        .total-bet b { color:var(--gold-l);font-size:18px; }
        .modal-bg { position:fixed;inset:0;background:rgba(5,4,2,.72);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:center;justify-content:center;animation:floatUp .2s; }
        .modal { width:460px;max-width:92vw;padding:32px;border-radius:var(--radius-lg);position:relative; }
        .modal h2 { font-family:var(--fs-head);font-weight:700;font-size:24px;margin:0 0 6px; }
        .modal p { color:var(--cream-dim);font-size:14px;line-height:1.55;margin:0 0 20px; }
        .invite-field { display:flex;gap:10px; }
        .invite-field input { flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(217,182,90,.3);border-radius:10px;padding:0 14px;color:var(--gold-l);font-size:13px;height:46px; }
        .modal .x { position:absolute;top:16px;right:18px;background:none;border:none;color:var(--cream-faint);font-size:24px;cursor:pointer;line-height:1; }
        .seatnote { margin-top:18px;font-size:12px;color:var(--cream-faint);line-height:1.5;border-top:1px solid rgba(217,182,90,.15);padding-top:14px; }
        @keyframes tapPulse {
          0%,100% { transform:translate(-50%,-50%) scale(1); opacity:.7; }
          50% { transform:translate(-50%,-50%) scale(1.22); opacity:1; }
        }
        @media (max-width:640px) {
          html,body { overflow:hidden !important; }
          .table-wrap { height:100svh !important; overflow:hidden !important; display:flex !important; flex-direction:column !important; }
          .rlt-desk { display:none !important; }
          .topbar { padding:8px 12px !important; flex-shrink:0; }
          .topbar .title-c .t { font-size:15px !important; }
          .topbar .title-c .s { display:none !important; }
          .topbar .right { gap:8px !important; }

          /* Stage: vertical flex, fills remaining height */
          .stage {
            flex:1 !important;
            display:flex !important;
            flex-direction:column !important;
            gap:0 !important;
            padding:0 !important;
            margin:0 !important;
            border-radius:0 !important;
            border-left:none !important;
            border-right:none !important;
            border-bottom:none !important;
            min-height:0 !important;
            overflow:hidden !important;
          }

          /* Wheel row: compact, horizontal */
          .wheel-side {
            flex-shrink:0 !important;
            flex-direction:row !important;
            align-items:center !important;
            justify-content:flex-start !important;
            gap:14px !important;
            padding:10px 14px !important;
            border-bottom:1px solid rgba(217,182,90,.18) !important;
          }
          .wheel-housing { width:150px !important; height:150px !important; flex-shrink:0 !important; }
          .wheel { inset:8px !important; }
          .pointer { border-left-width:8px !important; border-right-width:8px !important; border-top-width:14px !important; top:-4px !important; }
          .wheel-rim { box-shadow:0 8px 20px rgba(0,0,0,.6),inset 0 0 0 5px var(--gold-d),inset 0 0 0 10px #1a130a !important; }
          .pocket { width:10px !important; margin-left:-5px !important; }
          .pocket .num { font-size:5px !important; padding-top:3px !important; }
          .tap-spin-hint {
            display:flex !important; position:absolute !important;
            top:50% !important; left:50% !important;
            transform:translate(-50%,-50%) !important;
            width:32% !important; aspect-ratio:1 !important;
            border-radius:50% !important; z-index:10 !important;
            background:rgba(217,182,90,.38) !important;
            align-items:center !important; justify-content:center !important;
            font-family:var(--fs-head) !important; font-size:9px !important;
            font-weight:800 !important; letter-spacing:.1em !important;
            color:#fff !important; pointer-events:none !important;
            animation:tapPulse 1.5s ease-in-out infinite !important;
          }
          .result-disp { flex:1 !important; min-height:unset !important; align-items:flex-start !important; justify-content:center !important; gap:6px !important; }
          .result-num { width:50px !important; height:50px !important; font-size:22px !important; }
          .result-net { font-size:13px !important; }

          /* Board: fills remaining space, scrollable */
          .board-side { flex:1 !important; min-height:0 !important; overflow-y:auto !important; padding:6px 8px 0 !important; border-radius:0 !important; border:none !important; background:transparent !important; backdrop-filter:none !important; gap:0 !important; }
          .board-scroll { overflow-x:hidden !important; }
          .board { min-width:unset !important; width:100% !important; }
          .zero { width:22px !important; font-size:10px !important; }
          .numbers { grid-template-columns:repeat(12,1fr) !important; grid-template-rows:repeat(3,32px) !important; }
          .numbers .cell { font-size:9px !important; }
          .colbets { width:26px !important; }
          .colbets .cell { font-size:7px !important; }
          .lower { margin-left:22px !important; margin-right:26px !important; }
          .lower .cell { height:26px !important; font-size:8px !important; letter-spacing:0 !important; }
          .placed { width:22px !important; height:22px !important; font-size:8px !important; }

          /* Controls: pinned at bottom */
          .ctrl { flex-shrink:0 !important; flex-direction:column !important; gap:8px !important; padding:8px 12px 20px !important; border-top:1px solid rgba(217,182,90,.2) !important; background:linear-gradient(0deg,rgba(7,5,2,.97),rgba(7,5,2,.5)) !important; }
          .chip-sel { gap:8px !important; justify-content:center !important; }
          .chip-sel .chip { width:46px !important; height:46px !important; font-size:11px !important; }
          .chip-sel .chip.sel { transform:translateY(-3px) !important; outline-width:2px !important; }
          .ctrl-right { width:100% !important; justify-content:space-between !important; gap:8px !important; }
          .ctrl-right .btn { flex:1 !important; min-width:0 !important; font-size:14px !important; padding:12px 0 !important; }
          .total-bet { font-size:12px !important; white-space:nowrap !important; }
          .total-bet b { font-size:14px !important; }
        }
      `}</style>
    </div>
  )
}
