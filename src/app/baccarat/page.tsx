'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { playDeal, playWin, playLose, startTension, stopTension, setMuted } from '@/lib/casino-sounds'
import { generateCode, prettyCode } from '@/lib/invite-codes'

const SUITS = ['♠','♥','♦','♣']
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const RED_SUITS = new Set(['♥','♦'])

interface Card { rank: string; suit: string; value: number }
type BetSide = 'player' | 'banker' | 'tie' | null
type Phase = 'bet' | 'deal' | 'done'

function freshDeck(): Card[] {
  const d: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS) {
      const num = ['10','J','Q','K'].includes(rank) ? 0 : rank === 'A' ? 1 : parseInt(rank,10)
      d.push({ rank, suit, value: num })
    }
  return d
}
function shuffle(d: Card[]): Card[] {
  for (let i = d.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [d[i],d[j]] = [d[j],d[i]]
  }
  return d
}
function handTotal(cards: Card[]): number {
  return cards.reduce((s,c) => s + c.value, 0) % 10
}
function fmt(n: number) { return Number(n).toLocaleString('en-US') }
function fmtShort(n: number) {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M'
  if (n >= 1e3) return (n/1e3).toFixed(n%1e3===0?0:1)+'K'
  return ''+n
}
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const CHIPS_DEF = [
  { v: 1000, color: '#3a3a3a', label: '1K' },
  { v: 5000, color: '#b3122a', label: '5K' },
  { v: 25000, color: '#137a4a', label: '25K' },
  { v: 100000, color: '#2a2a6e', label: '100K' },
]

function CardComp({ card, faceDown }: { card: Card | null; faceDown?: boolean }) {
  if (!card || faceDown) return (
    <div className="card back" style={{'--w':'72px'} as React.CSSProperties} />
  )
  const red = RED_SUITS.has(card.suit)
  return (
    <div className={'card '+(red?'red':'')} style={{'--w':'72px'} as React.CSSProperties}>
      <div className="pip-tl"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
      <div className="center-suit">{card.suit}</div>
      <div className="pip-br"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
    </div>
  )
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  const bg = kind==='win'?'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)':kind==='lose'?'linear-gradient(160deg,#6a1325,#440b18)':'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{position:'fixed',left:'50%',bottom:38,transform:'translateX(-50%)',zIndex:9999,padding:'13px 26px',borderRadius:999,fontFamily:'Cinzel,serif',fontWeight:600,letterSpacing:'.05em',boxShadow:'0 14px 40px rgba(0,0,0,.5)',border:'1px solid rgba(217,182,90,.5)',background:bg,color:kind==='win'?'#2a1f08':'var(--cream)',animation:'floatUp .35s'}}>{msg}</div>
}

export default function BaccaratPage() {
  const [bal, setBal] = useState(100000)
  const [bet, setBet] = useState(0)
  const [betSide, setBetSide] = useState<BetSide>(null)
  const [phase, setPhase] = useState<Phase>('bet')
  const [playerCards, setPlayerCards] = useState<Card[]>([])
  const [bankerCards, setBankerCards] = useState<Card[]>([])
  const [hideThird, setHideThird] = useState(false)
  const [winner, setWinner] = useState<'player'|'banker'|'tie'|null>(null)
  const [lastBet, setLastBet] = useState(0)
  const [lastSide, setLastSide] = useState<BetSide>(null)
  const [toast, setToast] = useState<{msg:string,kind:string}|null>(null)
  const [loading, setLoading] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [showCustomChip, setShowCustomChip] = useState(false)
  const [customChipVal, setCustomChipVal] = useState('')
  const [muted, setMutedUI] = useState(false)
  const deckRef = { current: shuffle(freshDeck()) }
  const [isSpectator, setIsSpectator] = useState(false)
  const roomCodeRef = useRef('')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  function draw(): Card {
    if (deckRef.current.length < 10) deckRef.current = shuffle(freshDeck())
    return deckRef.current.pop()!
  }

  useEffect(() => {
    try { setMutedUI(localStorage.getItem('casinoMuted') === '1') } catch {}
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const params = new URLSearchParams(window.location.search)
      const sc = params.get('spectate')

      if (sc) {
        setIsSpectator(true)
        const ch = supabase.channel(`ht-game-${sc.toUpperCase()}`)
        ch.on('broadcast', { event: 'STATE' }, ({ payload }) => {
          const { pc, bc, w } = payload as { pc: Card[]; bc: Card[]; w: string | null }
          setPlayerCards(pc); setBankerCards(bc); if (w) setWinner(w as 'player' | 'banker' | 'tie')
        }).subscribe(status => {
          if (status === 'SUBSCRIBED') ch.send({ type: 'broadcast', event: 'SPECTATOR_JOIN', payload: {} }).catch(() => {})
        })
        channelRef.current = ch
      } else {
        const { data: profile } = await supabase.from('profiles').select('chips').eq('id', user.id).single()
        if (profile) setBal(profile.chips)
        const code = generateCode('baccarat')
        roomCodeRef.current = code
        fetch('/api/game/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, game: 'baccarat', status: 'solo' }) }).catch(() => {})
        const ch = supabase.channel(`ht-game-${code}`, { config: { broadcast: { self: false } } })
        ch.on('broadcast', { event: 'SPECTATOR_JOIN' }, () => { }).subscribe()
        channelRef.current = ch
      }
      setLoading(false)
    }
    init()
    return () => { channelRef.current?.unsubscribe() }
  }, [router])

  function addChip(v: number) {
    if (phase !== 'bet' || !betSide) return
    if (v > bal - bet) return
    setBet(b => b + v)
  }

  function chooseSide(side: BetSide) {
    if (phase !== 'bet') return
    if (betSide === side) { setBetSide(null); setBet(0) } else { setBetSide(side); setBet(0) }
  }

  async function deal() {
    if (!betSide || bet <= 0 || phase !== 'bet') return
    setLastBet(bet); setLastSide(betSide)
    setBal(b => b - bet)
    setPhase('deal')
    setPlayerCards([]); setBankerCards([])
    setWinner(null); setHideThird(false)
    startTension()
    // Initial deal: P B P B
    const p1 = draw(); await sleep(300); playDeal(); setPlayerCards([p1])
    const b1 = draw(); await sleep(300); playDeal(); setBankerCards([b1])
    const p2 = draw(); await sleep(300); playDeal(); setPlayerCards([p1, p2])
    const b2 = draw(); await sleep(300); playDeal(); setBankerCards([b1, b2])
    await sleep(500)

    let pCards = [p1, p2], bCards = [b1, b2]
    const pt = handTotal(pCards), bt = handTotal(bCards)

    // Natural — no more cards
    if (pt >= 8 || bt >= 8) {
      await sleep(400)
      resolveGame(pCards, bCards, bet, betSide)
      return
    }

    // Player draws?
    let p3: Card | null = null
    if (pt <= 5) {
      p3 = draw(); pCards = [...pCards, p3]
      setHideThird(true); await sleep(200)
      playDeal(); setPlayerCards(pCards); setHideThird(false); await sleep(400)
    }

    // Banker draws based on standard rules
    const newBt = handTotal(bCards)
    let bankerDraws = false
    if (p3 === null) {
      bankerDraws = newBt <= 5
    } else {
      const p3v = p3.value
      if      (newBt <= 2) bankerDraws = true
      else if (newBt === 3) bankerDraws = p3v !== 8
      else if (newBt === 4) bankerDraws = p3v >= 2 && p3v <= 7
      else if (newBt === 5) bankerDraws = p3v >= 4 && p3v <= 7
      else if (newBt === 6) bankerDraws = p3v === 6 || p3v === 7
    }
    if (bankerDraws) {
      const b3 = draw(); bCards = [...bCards, b3]
      playDeal(); setBankerCards(bCards); await sleep(500)
    }

    await sleep(300)
    resolveGame(pCards, bCards, bet, betSide)
  }

  function resolveGame(pCards: Card[], bCards: Card[], wagered: number, side: BetSide) {
    const pt = handTotal(pCards), bt = handTotal(bCards)
    const w: 'player'|'banker'|'tie' = pt > bt ? 'player' : bt > pt ? 'banker' : 'tie'
    setWinner(w)
    setPlayerCards(pCards); setBankerCards(bCards)

    let payout = 0
    if (w === 'tie') {
      payout = side === 'tie' ? wagered * 9 : wagered // push on tie for p/b bets
    } else if (w === side) {
      payout = side === 'banker' ? Math.floor(wagered * 1.95) : wagered * 2
    }
    const net = payout - wagered
    setBal(b => b + payout)
    stopTension()
    if (net > 0) playWin(); else if (net < 0) playLose()
    setPhase('done')

    const msg = w === 'tie' ? `Tie — ${pt}:${bt}` : `${w.charAt(0).toUpperCase()+w.slice(1)} wins ${pt}:${bt}`
    const kind = net > 0 ? 'win' : net < 0 ? 'lose' : ''
    const suffix = net > 0 ? `  +${fmt(net)}` : net < 0 ? `  −${fmt(-net)}` : '  Push'
    setToast({ msg: msg + suffix, kind })

    try {
      fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'baccarat', chips_wagered: wagered, chips_won: payout }),
      })
    } catch { /* best effort */ }
  }

  function newHand() {
    setPhase('bet'); setPlayerCards([]); setBankerCards([])
    setWinner(null); setBet(lastBet && lastSide && lastBet <= bal ? lastBet : 0)
    setBetSide(lastSide || null)
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>Loading…</div>
    </div>
  )

  const pt = handTotal(playerCards), bt = handTotal(bankerCards)

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'radial-gradient(120% 80% at 50% -10%, #241f15 0%, #13110b 45%, #0b0a07 100%)'}}>
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}
      {isSpectator && (
        <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(217,182,90,.12)',borderBottom:'1px solid rgba(217,182,90,.3)',padding:'8px 24px',textAlign:'center',fontFamily:'var(--fs-head)',fontSize:12,letterSpacing:'.12em',color:'var(--gold-l)',textTransform:'uppercase'}}>
          👁 Spectating Live — Read Only
        </div>
      )}

      <header className="bac-topbar" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 24px',background:'linear-gradient(180deg,rgba(11,10,7,.95),rgba(11,10,7,.2))'}}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',color:'var(--cream-dim)',fontFamily:'var(--fs-head)',fontSize:13,letterSpacing:'.12em',textTransform:'uppercase',padding:'9px 16px',borderRadius:999,border:'1px solid rgba(217,182,90,.25)'}}>
          ← Lobby
        </Link>
        <div style={{textAlign:'center'}}>
          <div className="gold-text bac-title-t" style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:20,letterSpacing:'.14em'}}>BACCARAT</div>
          <div className="bac-title-s" style={{fontFamily:'var(--fs-head)',fontSize:9,letterSpacing:'.4em',color:'var(--cream-faint)'}}>PUNTO BANCO · MINI TABLE</div>
        </div>
        <div className="bac-right" style={{display:'flex',alignItems:'center',gap:12}}>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHelp(true)}>How to Play</button>
          <button className="btn btn-sm btn-ghost" onClick={() => { setInviteCode(generateCode('baccarat')); setShowInvite(true) }}>Invite</button>
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

      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'24px 24px 32px',gap:24}}>
        {/* Felt area */}
        <div className="bac-felt" style={{width:'100%',maxWidth:680,background:'radial-gradient(120% 100% at 50% 0%,#137a4a 0%,#0c5a37 38%,#073b25 100%)',borderRadius:28,padding:32,border:'1px solid rgba(217,182,90,.3)',boxShadow:'0 20px 60px rgba(0,0,0,.6),inset 0 0 80px rgba(0,0,0,.3)',display:'flex',flexDirection:'column',gap:28}}>

          {/* Banker hand */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontFamily:'var(--fs-head)',letterSpacing:'.3em',fontSize:12,textTransform:'uppercase',color:'var(--cream-faint)'}}>Banker</span>
              {bankerCards.length > 0 && (
                <div style={{padding:'4px 12px',borderRadius:999,background:'rgba(0,0,0,.5)',fontFamily:'var(--fs-head)',fontWeight:800,fontSize:16,color: bt === 8||bt===9 ? 'var(--gold-l)' : 'var(--cream)'}}>
                  {bt}{bt>=8?' Natural':''}
                </div>
              )}
              {winner === 'banker' && <div style={{padding:'4px 16px',borderRadius:999,background:'var(--gold-grad)',color:'#2a1f08',fontFamily:'var(--fs-head)',fontWeight:800,fontSize:13}}>WINS</div>}
            </div>
            <div style={{display:'flex',gap:10,minHeight:100,alignItems:'center'}}>
              {bankerCards.map((c,i) => <CardComp key={i} card={c} />)}
              {bankerCards.length === 0 && phase !== 'bet' && [0,1].map(i => <CardComp key={i} card={null} faceDown />)}
            </div>
          </div>

          {/* Center line */}
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{flex:1,height:1,background:'rgba(217,182,90,.25)'}}/>
            <div style={{width:10,height:10,borderRadius:'50%',background:'var(--gold-d)',transform:'rotate(45deg)'}}/>
            <div style={{flex:1,height:1,background:'rgba(217,182,90,.25)'}}/>
          </div>

          {/* Player hand */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontFamily:'var(--fs-head)',letterSpacing:'.3em',fontSize:12,textTransform:'uppercase',color:'var(--cream-faint)'}}>Player</span>
              {playerCards.length > 0 && (
                <div style={{padding:'4px 12px',borderRadius:999,background:'rgba(0,0,0,.5)',fontFamily:'var(--fs-head)',fontWeight:800,fontSize:16,color: pt === 8||pt===9 ? 'var(--gold-l)' : 'var(--cream)'}}>
                  {pt}{pt>=8?' Natural':''}
                </div>
              )}
              {winner === 'player' && <div style={{padding:'4px 16px',borderRadius:999,background:'var(--gold-grad)',color:'#2a1f08',fontFamily:'var(--fs-head)',fontWeight:800,fontSize:13}}>WINS</div>}
            </div>
            <div style={{display:'flex',gap:10,minHeight:100,alignItems:'center'}}>
              {playerCards.map((c,i) => <CardComp key={i} card={c} />)}
              {playerCards.length === 0 && phase !== 'bet' && [0,1].map(i => <CardComp key={i} card={null} faceDown />)}
            </div>
          </div>

          {winner === 'tie' && (
            <div style={{textAlign:'center',fontFamily:'var(--fs-display)',fontWeight:900,fontSize:22,color:'var(--gold-l)',animation:'floatUp .4s'}}>
              TIE — {pt} : {bt}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bac-controls" style={{width:'100%',maxWidth:680}}>
          {phase === 'bet' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {/* Bet side selector */}
              <div className="bac-bet-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {([['player','Player','1:1'],['tie','Tie','8:1'],['banker','Banker','0.95:1']] as [BetSide,string,string][]).map(([side,label,odds]) => (
                  <button key={side} onClick={() => chooseSide(side)} style={{
                    padding:'20px 12px',borderRadius:18,textAlign:'center',cursor:'pointer',
                    border:'2px solid '+(betSide===side?'var(--gold)':'rgba(217,182,90,.25)'),
                    background:betSide===side?'rgba(217,182,90,.14)':'rgba(0,0,0,.4)',
                    transition:'.2s',
                  }}>
                    <div style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:17,color:betSide===side?'var(--gold-l)':'var(--cream)',letterSpacing:'.05em'}}>{label}</div>
                    <div style={{fontFamily:'var(--fs-head)',fontSize:11,letterSpacing:'.2em',color:'var(--cream-faint)',marginTop:4}}>{odds}</div>
                    {bet > 0 && betSide===side && <div style={{marginTop:8,fontFamily:'var(--fs-head)',fontWeight:800,color:'var(--gold-l)',fontSize:16}}>{fmtShort(bet)}</div>}
                  </button>
                ))}
              </div>

              {betSide && (
                <div style={{display:'flex',alignItems:'center',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
                    {CHIPS_DEF.map(c => (
                      <div key={c.v} className={'chip'+((c.v > bal-bet)?'  dis':'')} style={{background:c.color,opacity:c.v>bal-bet?.4:1,cursor:c.v>bal-bet?'not-allowed':'pointer'}} onClick={() => addChip(c.v)}>
                        <span>{c.label}</span>
                      </div>
                    ))}
                    <div className="chip" style={{background:'linear-gradient(160deg,#5a3a8a,#3b1d6e)',border:'2px dashed rgba(167,139,250,.6)',fontSize:11}} onClick={() => { setCustomChipVal(''); setShowCustomChip(true) }}>
                      <span>CUST</span>
                    </div>
                    <div className={'chip'+(bal-bet<=0?'  dis':'')} style={{background:'linear-gradient(160deg,#8f0f22,#440b18)',fontSize:10,opacity:bal-bet<=0?.4:1,cursor:bal-bet<=0?'not-allowed':'pointer'}} onClick={() => { if (bal-bet>0) setBet(bal) }}>
                      <span>ALL IN</span>
                    </div>
                  </div>
                  {bet > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setBet(0)}>Clear</button>}
                  <button className="btn" disabled={bet <= 0} onClick={deal}>Deal</button>
                </div>
              )}
            </div>
          )}

          {phase === 'deal' && (
            <div style={{textAlign:'center',fontFamily:'var(--fs-head)',letterSpacing:'.3em',fontSize:14,color:'var(--cream-faint)'}}>
              Dealing…
            </div>
          )}

          {phase === 'done' && (
            <div style={{display:'flex',gap:12,justifyContent:'center'}}>
              <button className="btn" onClick={newHand}>Next Hand</button>
              {bal <= 0 && (
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  const res = await fetch('/api/game/session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ game:'refill', chips_wagered:0, chips_won:100000 }) })
                  if (res.ok) { const d = await res.json(); setBal(d.chips); setToast({msg:'Topped up!',kind:'win'}) }
                }}>
                  Refill chips
                </button>
              )}
            </div>
          )}
        </div>

        {/* Odds reference */}
        <div className="bac-odds" style={{display:'flex',gap:20,fontSize:12,color:'var(--cream-faint)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>
          <span>Player 1:1</span>
          <span style={{opacity:.4}}>·</span>
          <span>Banker 0.95:1 (5% commission)</span>
          <span style={{opacity:.4}}>·</span>
          <span>Tie 8:1</span>
        </div>
      </div>

      {showCustomChip && (
        <div style={{position:'fixed',inset:0,background:'rgba(5,4,2,.72)',backdropFilter:'blur(5px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',animation:'floatUp .2s'}} onClick={() => setShowCustomChip(false)}>
          <div className="gilt" style={{width:320,padding:28,borderRadius:'var(--radius-lg)',position:'relative'}} onClick={e => e.stopPropagation()}>
            <button style={{position:'absolute',top:12,right:14,background:'none',border:'none',color:'var(--cream-faint)',fontSize:22,cursor:'pointer'}} onClick={() => setShowCustomChip(false)}>×</button>
            <h2 className="gold-text" style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:20,margin:'0 0 8px'}}>Custom Bet</h2>
            <p style={{color:'var(--cream-dim)',fontSize:14,margin:'0 0 16px'}}>Type any amount to add to your bet.</p>
            <input
              type="number"
              value={customChipVal}
              onChange={e => setCustomChipVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const v = parseInt(customChipVal, 10)
                  if (v > 0) addChip(Math.min(v, bal - bet))
                  setShowCustomChip(false)
                }
              }}
              placeholder="e.g. 7500"
              style={{width:'100%',background:'rgba(0,0,0,.4)',border:'1px solid rgba(217,182,90,.35)',borderRadius:10,padding:'10px 14px',color:'var(--gold-l)',fontSize:20,fontFamily:'var(--fs-head)',letterSpacing:'.06em',outline:'none',boxSizing:'border-box' as const}}
              autoFocus
            />
            <button className="btn" style={{width:'100%',marginTop:14}} onClick={() => {
              const v = parseInt(customChipVal, 10)
              if (v > 0) addChip(Math.min(v, bal - bet))
              setShowCustomChip(false)
            }}>Add to Bet</button>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div style={{position:'fixed',inset:0,background:'rgba(5,4,2,.8)',backdropFilter:'blur(5px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',animation:'floatUp .2s'}} onClick={() => setShowInvite(false)}>
          <div className="gilt" style={{width:460,maxWidth:'92vw',padding:32,borderRadius:'var(--radius-lg)',position:'relative'}} onClick={e => e.stopPropagation()}>
            <button style={{position:'absolute',top:16,right:18,background:'none',border:'none',color:'var(--cream-faint)',fontSize:24,cursor:'pointer',lineHeight:1}} onClick={() => setShowInvite(false)}>×</button>
            <h2 className="gold-text" style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:24,margin:'0 0 6px'}}>Invite to the table</h2>
            <p style={{color:'var(--cream-dim)',fontSize:14,lineHeight:1.55,margin:'0 0 4px'}}>Share this code with a friend and they&apos;ll join your Baccarat table.</p>
            <div style={{textAlign:'center',margin:'18px 0'}}>
              <div style={{fontFamily:'var(--fs-head)',fontSize:36,fontWeight:800,letterSpacing:'.15em',color:'var(--gold-l)',background:'rgba(0,0,0,.4)',border:'1px solid rgba(217,182,90,.3)',borderRadius:14,padding:'18px 28px',display:'inline-block'}}>{prettyCode(inviteCode)}</div>
            </div>
            <button className="btn" style={{width:'100%'}} onClick={() => { navigator.clipboard.writeText(prettyCode(inviteCode)).then(() => setToast({msg:'Code copied!',kind:'win'})) }}>Copy Code</button>
            <div style={{marginTop:18,fontSize:12,color:'var(--cream-faint)',lineHeight:1.5,borderTop:'1px solid rgba(217,182,90,.15)',paddingTop:14}}>Punto Banco · Your chips carry across every HouseTables table.</div>
          </div>
        </div>
      )}

      {/* How to Play modal */}
      {showHelp && (
        <div style={{position:'fixed',inset:0,background:'rgba(5,4,2,.8)',backdropFilter:'blur(5px)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',animation:'floatUp .2s'}} onClick={() => setShowHelp(false)}>
          <div className="gilt" style={{width:520,maxWidth:'92vw',padding:36,borderRadius:'var(--radius-lg)',position:'relative',maxHeight:'85vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
            <button style={{position:'absolute',top:16,right:18,background:'none',border:'none',color:'var(--cream-faint)',fontSize:24,cursor:'pointer',lineHeight:1}} onClick={() => setShowHelp(false)}>×</button>
            <h2 className="gold-text" style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:24,margin:'0 0 20px'}}>How to Play Baccarat</h2>
            <div style={{display:'flex',flexDirection:'column',gap:14,color:'var(--cream-dim)',fontSize:14,lineHeight:1.65}}>
              <p><strong style={{color:'var(--cream)'}}>Objective:</strong> Bet on which hand — Player or Banker — will be closest to 9, or if they will tie.</p>
              <p><strong style={{color:'var(--cream)'}}>Card Values:</strong> Aces = 1, cards 2–9 = face value, 10/J/Q/K = 0. Only the last digit of the total counts (e.g. 15 = 5).</p>
              <p><strong style={{color:'var(--cream)'}}>Natural:</strong> If either hand totals 8 or 9 on the first two cards, no more cards are drawn and that hand wins (or ties).</p>
              <div>
                <strong style={{color:'var(--cream)'}}>Drawing Rules:</strong>
                <ul style={{margin:'8px 0 0 16px',display:'flex',flexDirection:'column',gap:4}}>
                  <li>Player draws a third card if their total is 0–5.</li>
                  <li>Banker draws based on their total and Player's third card (standard Punto Banco rules).</li>
                  <li>No decision to make — it's all automatic.</li>
                </ul>
              </div>
              <div>
                <strong style={{color:'var(--cream)'}}>Payouts:</strong>
                <ul style={{margin:'8px 0 0 16px',display:'flex',flexDirection:'column',gap:4}}>
                  <li>Player wins → 1:1 (even money)</li>
                  <li>Banker wins → 0.95:1 (5% commission to the house)</li>
                  <li>Tie → 8:1. Player and Banker bets push (returned) on a tie.</li>
                </ul>
              </div>
              <p><strong style={{color:'var(--cream)'}}>Strategy tip:</strong> The Banker bet has the lowest house edge (~1.06%). The Tie bet has a much higher house edge — it's a longshot.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .card { animation: dealIn .4s cubic-bezier(.2,.9,.25,1) both; }
        @media (max-width: 640px) {
          .bac-topbar { padding: 10px 14px !important; }
          .bac-topbar .bac-title-t { font-size: 16px !important; }
          .bac-topbar .bac-title-s { display: none; }
          .bac-topbar .bac-right { gap: 8px !important; }
          .bac-felt { padding: 18px 14px !important; }
          .bac-controls { padding: 0 14px 24px !important; }
          .bac-bet-grid { gap: 8px !important; }
          .bac-odds { flex-wrap: wrap !important; gap: 10px !important; }
        }
      `}</style>
    </div>
  )
}
