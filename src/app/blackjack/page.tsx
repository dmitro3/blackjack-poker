'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Deck helpers
const SUITS = [
  { s: '♠', c: 'black' }, { s: '♥', c: 'red' },
  { s: '♦', c: 'red' }, { s: '♣', c: 'black' }
]
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

interface Card { rank: string; suit: string; color: string }
type Phase = 'bet' | 'deal' | 'player' | 'dealer' | 'done'

function freshDeck(): Card[] {
  const d: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ rank, suit: suit.s, color: suit.c })
  return d
}
function shuffle(d: Card[]) {
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}
function handValue(cards: Card[]) {
  let total = 0, aces = 0
  for (const c of cards) {
    if (c.rank === 'A') { aces++; total += 11 }
    else if (['K','Q','J','10'].includes(c.rank)) total += 10
    else total += parseInt(c.rank, 10)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return { total, soft: aces > 0 }
}
function fmt(n: number) { return Number(n).toLocaleString('en-US') }
function fmtShort(n: number) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M'
  if (n >= 1e3) return (n/1e3).toFixed(n%1e3===0?0:1)+'K'
  return ''+n
}
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const CHIPS = [
  { v: 1000,  color:'#3a3a3a', label:'1K' },
  { v: 5000,  color:'#b3122a', label:'5K' },
  { v: 25000, color:'#137a4a', label:'25K' },
  { v: 100000,color:'#2a2a6e', label:'100K' },
]

function PlayingCard({ card, faceDown, idx }: { card: Card | null; faceDown?: boolean; idx: number }) {
  const fromX = -360 - idx*4, fromY = -260
  const style = { '--fromX': fromX+'px', '--fromY': fromY+'px', animationDelay: (idx*0.13)+'s' } as React.CSSProperties
  if (faceDown || !card) return (
    <div style={style} className="card-slot"><div className="card back" /></div>
  )
  return (
    <div className="card-slot" style={style}>
      <div className={'card '+(card.color==='red'?'red':'')}>
        <div className="pip-tl"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
        <div className="center-suit">{card.suit}</div>
        <div className="pip-br"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
      </div>
    </div>
  )
}

function ValBadge({ cards, hideHole }: { cards: Card[]; hideHole: boolean }) {
  if (!cards.length) return null
  const shown = hideHole ? cards.slice(0, 1) : cards
  const { total, soft } = handValue(shown)
  const bust = total > 21
  const bj = !hideHole && cards.length === 2 && total === 21
  const cls = 'val-badge' + (bust ? ' bust' : '') + (bj ? ' bj' : '')
  let text: string
  if (bj) text = '★ Blackjack'
  else if (hideHole) text = soft ? (total-10)+' / '+total : ''+total
  else text = total + (bust ? ' · Bust' : '')
  return <div className={cls}>{text}</div>
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  const bg = kind==='win' ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)' : kind==='lose' ? 'linear-gradient(160deg,#6a1325,#440b18)' : 'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{position:'fixed',left:'50%',bottom:38,transform:'translateX(-50%)',zIndex:9999,padding:'13px 26px',borderRadius:999,fontFamily:'Cinzel,serif',fontWeight:600,letterSpacing:'.05em',boxShadow:'0 14px 40px rgba(0,0,0,.5)',border:'1px solid rgba(217,182,90,.5)',background:bg,color:kind==='win'?'#2a1f08':'var(--cream)',animation:'floatUp .35s'}}>{msg}</div>
}

export default function BlackjackPage() {
  const [phase, setPhase] = useState<Phase>('bet')
  const [bet, setBet] = useState(0)
  const [lastBet, setLastBet] = useState(0)
  const [player, setPlayer] = useState<Card[]>([])
  const [dealer, setDealer] = useState<Card[]>([])
  const [hideHole, setHideHole] = useState(true)
  const [result, setResult] = useState<{kind:string,msg:string,net:number}|null>(null)
  const [doubled, setDoubled] = useState(false)
  const [bal, setBal] = useState(100000)
  const [toast, setToast] = useState<{msg:string,kind:string}|null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const deckRef = useRef<Card[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('chips, invite_code').eq('id', user.id).single()
      if (profile) {
        setBal(profile.chips)
        setInviteUrl(`${window.location.origin}/?invite=${profile.invite_code}`)
      }
      setLoading(false)
    }
    init()
  }, [router])

  function showToast(msg: string, kind = '') { setToast({ msg, kind }) }

  function draw(): Card {
    if (deckRef.current.length < 12) deckRef.current = shuffle(freshDeck())
    return deckRef.current.pop()!
  }

  function addChip(v: number) {
    if (phase !== 'bet') return
    if (v > bal - bet) { showToast('Not enough chips for that'); return }
    setBet(b => b + v)
  }

  async function deal() {
    if (bet <= 0 || phase !== 'bet') return
    const newBal = bal - bet
    setBal(newBal)
    setLastBet(bet)
    setDoubled(false)
    setResult(null)
    setHideHole(true)
    if (deckRef.current.length < 20) deckRef.current = shuffle(freshDeck())
    setPhase('deal')
    const p: Card[] = [], d: Card[] = []
    setPlayer([]); setDealer([])
    await sleep(60)
    p.push(draw()); setPlayer([...p]); await sleep(260)
    d.push(draw()); setDealer([...d]); await sleep(260)
    p.push(draw()); setPlayer([...p]); await sleep(260)
    d.push(draw()); setDealer([...d]); await sleep(360)
    const pv = handValue(p).total, dv = handValue(d).total
    if (pv === 21 || dv === 21) {
      setHideHole(false); await sleep(500)
      if (pv === 21 && dv === 21) finish('push', d, p, bet)
      else if (pv === 21) finish('blackjack', d, p, bet)
      else finish('lose', d, p, bet, 'Dealer Blackjack')
      return
    }
    setPhase('player')
  }

  async function hit() {
    if (phase !== 'player') return
    const p = [...player, draw()]
    setPlayer(p); await sleep(300)
    const v = handValue(p).total
    if (v > 21) finish('lose', dealer, p, lastBet, 'Bust')
    else if (v === 21) doStand(p)
  }

  async function doubleDown() {
    if (phase !== 'player' || player.length !== 2) return
    if (lastBet > bal) { showToast('Not enough to double'); return }
    setBal(b => b - lastBet)
    setDoubled(true)
    const stake = lastBet * 2
    const p = [...player, draw()]
    setPlayer(p); await sleep(380)
    const v = handValue(p).total
    if (v > 21) finish('lose', dealer, p, stake, 'Bust')
    else doStand(p, stake)
  }

  async function doStand(curPlayer?: Card[], stakeOverride?: number) {
    const p = curPlayer || player
    const stake = stakeOverride || (doubled ? lastBet*2 : lastBet)
    setPhase('dealer')
    setHideHole(true); await sleep(200)
    setHideHole(false); await sleep(620)
    let d = [...dealer]
    while (handValue(d).total < 17) {
      d.push(draw()); setDealer([...d]); await sleep(560)
    }
    const dv = handValue(d).total, pv = handValue(p).total
    if (dv > 21) finish('win', d, p, stake, 'Dealer busts')
    else if (dv > pv) finish('lose', d, p, stake, 'Dealer wins')
    else if (dv < pv) finish('win', d, p, stake, 'You win')
    else finish('push', d, p, stake)
  }

  async function finish(kind: string, d: Card[], p: Card[], stake: number, msgIn?: string) {
    setPhase('done')
    setHideHole(false)
    let payout = 0, kindUI = 'lose', msg = msgIn || ''
    if (kind === 'blackjack') { payout = Math.round(stake*2.5); kindUI = 'win'; msg = 'Blackjack! 3:2' }
    else if (kind === 'win') { payout = stake*2; kindUI = 'win'; msg = msgIn || 'You win' }
    else if (kind === 'push') { payout = stake; kindUI = 'push'; msg = 'Push' }
    else { payout = 0; kindUI = 'lose'; msg = msgIn || 'Dealer wins' }

    const net = payout - stake
    setBal(b => b + payout)
    setResult({ kind: kindUI, msg, net })
    showToast(msg + (net > 0 ? '  +'+fmt(net) : net < 0 ? '  −'+fmt(-net) : ''), kindUI === 'push' ? '' : kindUI)

    // Log to Supabase
    try {
      await fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'blackjack', chips_wagered: stake, chips_won: payout }),
      })
    } catch { /* best effort */ }
  }

  function newHand() {
    setPhase('bet'); setPlayer([]); setDealer([]); setResult(null); setHideHole(true); setDoubled(false)
    setBet(lastBet && lastBet <= bal ? lastBet : 0)
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>Loading…</div>
    </div>
  )

  const canDouble = phase === 'player' && player.length === 2 && bal >= lastBet

  return (
    <div className="table-wrap">
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      <header className="topbar">
        <Link className="back" href="/">← Lobby</Link>
        <div className="title-c">
          <div className="t gold-text">BLACKJACK</div>
          <div className="s">DEALER STANDS ON 17 · 3:2</div>
        </div>
        <div className="right">
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(bal)}</span>
          </div>
        </div>
      </header>

      <div className="felt-area felt">
        <div className="shoe" />
        <div className="arc-label">
          Blackjack pays 3 to 2
          <div className="pay">Insurance not offered</div>
        </div>

        <div className="zone dealer">
          <div className="seat-label">Dealer</div>
          <div className="hand">
            {dealer.map((c, i) => <PlayingCard key={i} card={c} idx={i} faceDown={hideHole && i === 1} />)}
          </div>
          {dealer.length > 0 && <ValBadge cards={dealer} hideHole={hideHole} />}
        </div>

        {result && (
          <div className="status">
            <div className={'msg '+result.kind}>{result.msg}</div>
          </div>
        )}

        <div className="zone player">
          <div className="seat-label">You {doubled && '· Doubled'}</div>
          <div className="hand">
            {player.map((c, i) => <PlayingCard key={i} card={c} idx={i} />)}
          </div>
          {player.length > 0 && <ValBadge cards={player} hideHole={false} />}
        </div>
      </div>

      <div className="deck-ctrl">
        {phase === 'bet' && (
          <>
            <div className="bet-disp">
              <div className="bet-circle">
                <span className="lbl">Bet</span>
                <span className="amt tabnum">{bet ? fmtShort(bet) : '—'}</span>
              </div>
              {bet > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setBet(0)}>Clear</button>}
            </div>
            <div className="vert" />
            <div className="chip-tray">
              {CHIPS.map(c => (
                <div key={c.v} className={'chip'+((c.v > bal-bet) ? ' dis' : '')}
                  style={{ background: c.color }} onClick={() => addChip(c.v)}>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
            <div className="vert" />
            <div className="actions">
              <button className="btn" disabled={bet <= 0} onClick={deal}>Deal</button>
            </div>
          </>
        )}

        {phase === 'player' && (
          <div className="actions">
            <button className="btn" onClick={hit}>Hit</button>
            <button className="btn btn-ghost" onClick={() => doStand()}>Stand</button>
            {canDouble && <button className="btn btn-ghost" onClick={doubleDown}>Double</button>}
          </div>
        )}

        {(phase === 'deal' || phase === 'dealer') && (
          <div className="seat-label" style={{margin:0,fontSize:14}}>
            {phase === 'deal' ? 'Dealing…' : 'Dealer plays…'}
          </div>
        )}

        {phase === 'done' && (
          <div className="actions" style={{flexDirection:'column',alignItems:'center'}}>
            <button className="btn" onClick={newHand}>Next Hand</button>
            {bal <= 0 && (
              <button className="btn btn-ghost btn-sm" style={{marginTop:8}} onClick={async () => {
                const res = await fetch('/api/game/session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ game:'refill', chips_wagered:0, chips_won:100000 }) })
                if (res.ok) { const d = await res.json(); setBal(d.chips); showToast('Topped up!','win') }
              }}>
                Out of chips — Refill
              </button>
            )}
          </div>
        )}
      </div>

      {showInvite && (
        <div className="modal-bg" onClick={() => setShowInvite(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()}>
            <button className="x" onClick={() => setShowInvite(false)}>×</button>
            <h2 className="gold-text">Invite to your table</h2>
            <p>Share this link and friends join your game. They&apos;ll get 5,000 bonus chips.</p>
            <div className="invite-field">
              <input readOnly value={inviteUrl} />
              <button className="btn" onClick={() => { navigator.clipboard.writeText(inviteUrl).then(() => showToast('Invite link copied','win')) }}>Copy</button>
            </div>
            <div className="seatnote">Dealer stands on 17 · Blackjack pays 3:2. Your chips carry across every HouseTables table.</div>
          </div>
        </div>
      )}

      <style>{`
        html, body { height: 100%; overflow: hidden; }
        .table-wrap { height: 100vh; display: flex; flex-direction: column; }
        .topbar { display:flex;align-items:center;justify-content:space-between;padding:14px 24px;z-index:30;background:linear-gradient(180deg, rgba(11,10,7,.95), rgba(11,10,7,.2)); }
        .back { display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--cream-dim);font-family:var(--fs-head);font-size:13px;letter-spacing:.12em;text-transform:uppercase;padding:9px 16px;border-radius:999px;border:1px solid rgba(217,182,90,.25);transition:.2s; }
        .back:hover { color:var(--gold-l);border-color:var(--gold); }
        .title-c { text-align:center; }
        .title-c .t { font-family:var(--fs-display);font-weight:900;font-size:20px;letter-spacing:.14em; }
        .title-c .s { font-family:var(--fs-head);font-size:9px;letter-spacing:.4em;color:var(--cream-faint); }
        .topbar .right { display:flex;align-items:center;gap:12px; }
        .felt-area { flex:1;position:relative;margin:0 18px 18px;border-radius:30px;overflow:hidden;border:1px solid rgba(217,182,90,.3);box-shadow:var(--shadow-pop);display:flex;flex-direction:column; }
        .felt-area::after { content:"";position:absolute;inset:14px;border:2px solid rgba(217,182,90,.16);border-radius:22px;pointer-events:none; }
        .arc-label { position:absolute;top:38%;left:50%;transform:translateX(-50%);text-align:center;font-family:var(--fs-head);color:rgba(244,236,216,.16);letter-spacing:.34em;font-size:15px;text-transform:uppercase;pointer-events:none; }
        .arc-label .pay { font-size:12px;letter-spacing:.2em;margin-top:5px;color:rgba(217,182,90,.28); }
        .shoe { position:absolute;top:20px;right:34px;width:78px;height:54px;border-radius:8px;background:linear-gradient(180deg,#2a1f12,#140e08);border:1px solid rgba(217,182,90,.35);box-shadow:0 8px 20px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center; }
        .shoe::before { content:"";width:46px;height:40px;border-radius:5px;background:repeating-linear-gradient(45deg,#7a1020 0 5px,#5e0c19 5px 10px);box-shadow:inset 0 0 0 2px var(--gold-d); }
        .zone { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:2; }
        .zone.dealer { justify-content:flex-start;padding-top:34px; }
        .zone.player { justify-content:flex-end;padding-bottom:14px; }
        .seat-label { font-family:var(--fs-head);letter-spacing:.3em;font-size:12px;text-transform:uppercase;color:var(--cream-faint);margin-bottom:12px; }
        .hand { display:flex;min-height:118px;align-items:flex-end;padding-left:30px; }
        .card-slot { margin-left:-30px;animation:dealIn .5s cubic-bezier(.2,.9,.25,1) backwards; }
        .card-slot:first-child { margin-left:0; }
        .hand .card { --w:80px; }
        .val-badge { display:inline-flex;align-items:center;gap:7px;margin-top:13px;padding:6px 15px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(217,182,90,.4);font-family:var(--fs-head);font-weight:700;font-size:16px;color:var(--gold-l);min-height:32px; }
        .val-badge.bust { border-color:#e7708a;color:#e7708a; }
        .val-badge.bj { background:var(--gold-grad);color:#2a1f08;border:none; }
        .status { position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:5;text-align:center;pointer-events:none; }
        .status .msg { font-family:var(--fs-display);font-weight:900;font-size:34px;letter-spacing:.04em;padding:14px 40px;border-radius:14px;animation:floatUp .4s; }
        .status .msg.win { background:var(--gold-grad);color:#2a1f08;box-shadow:0 14px 50px rgba(0,0,0,.6); }
        .status .msg.lose { background:linear-gradient(160deg,#6a1325,#440b18);color:var(--cream);border:1px solid rgba(217,182,90,.4); }
        .status .msg.push { background:linear-gradient(180deg,#241f15,#0b0a07);color:var(--gold-l);border:1px solid rgba(217,182,90,.4); }
        .deck-ctrl { padding:14px 24px 22px;display:flex;align-items:center;justify-content:center;gap:30px;z-index:20;min-height:118px; }
        .bet-disp { display:flex;flex-direction:column;align-items:center;gap:8px;min-width:120px; }
        .bet-circle { width:88px;height:88px;border-radius:50%;border:2px dashed rgba(217,182,90,.5);display:flex;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(circle,rgba(217,182,90,.08),transparent); }
        .bet-circle .lbl { font-size:9px;letter-spacing:.2em;color:var(--cream-faint);text-transform:uppercase; }
        .bet-circle .amt { font-family:var(--fs-head);font-weight:800;font-size:22px;color:var(--gold-l); }
        .chip-tray { display:flex;gap:12px; }
        .chip-tray .chip { width:64px;height:64px;font-size:15px; }
        .chip-tray .chip.dis { filter:grayscale(.6) brightness(.55);cursor:not-allowed;pointer-events:none; }
        .actions { display:flex;gap:12px;flex-wrap:wrap;justify-content:center;max-width:380px; }
        .actions .btn { min-width:104px; }
        .vert { width:1px;align-self:stretch;background:linear-gradient(180deg,transparent,rgba(217,182,90,.3),transparent); }
        .modal-bg { position:fixed;inset:0;background:rgba(5,4,2,.72);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:center;justify-content:center;animation:floatUp .2s; }
        .modal { width:460px;max-width:92vw;padding:32px;border-radius:var(--radius-lg);position:relative; }
        .modal h2 { font-family:var(--fs-head);font-weight:700;font-size:24px;margin:0 0 6px; }
        .modal p { color:var(--cream-dim);font-size:14px;line-height:1.55;margin:0 0 20px; }
        .invite-field { display:flex;gap:10px; }
        .invite-field input { flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(217,182,90,.3);border-radius:10px;padding:0 14px;color:var(--gold-l);font-size:13px;height:46px; }
        .modal .x { position:absolute;top:16px;right:18px;background:none;border:none;color:var(--cream-faint);font-size:24px;cursor:pointer;line-height:1; }
        .modal .x:hover { color:var(--gold-l); }
        .seatnote { margin-top:18px;font-size:12px;color:var(--cream-faint);line-height:1.5;border-top:1px solid rgba(217,182,90,.15);padding-top:14px; }
      `}</style>
    </div>
  )
}
