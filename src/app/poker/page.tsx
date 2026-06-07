'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PokerGame, BB, fmt, fmtShort, GameSnapshot, LegalActions } from '@/lib/poker-game'
import type { Card } from '@/lib/poker-engine'
import { playDeal, playChip, playWin, playLose, startTension, stopTension, isMuted, setMuted } from '@/lib/casino-sounds'

const SEATS = [
  { name:'You', avatar:'V' },
  { name:'Marcel', avatar:'M' },
  { name:'Bianca', avatar:'B' },
  { name:'Saxon', avatar:'S' },
  { name:'Odette', avatar:'O' },
  { name:'Dmitri', avatar:'D' },
]

const POS = [
  { x:50, y:91, bx:0,   by:-72 },
  { x:87, y:65, bx:-70, by:-2 },
  { x:83, y:19, bx:-62, by:18 },
  { x:50, y:7,  bx:0,   by:66 },
  { x:17, y:19, bx:62,  by:18 },
  { x:13, y:65, bx:70,  by:-2 },
]

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function CardComp({ card, faceDown, idx = 0, cls = '' }: { card: Card | null; faceDown?: boolean; idx?: number; cls?: string }) {
  const style = { animationDelay: (idx*0.07)+'s' } as React.CSSProperties
  if (faceDown || !card) return <div className={'card back '+cls} style={style} />
  return (
    <div className={'card '+(card.color==='red'?'red ':'')+cls} style={style}>
      <div className="pip-tl"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
      <div className="center-suit">{card.suit}</div>
      <div className="pip-br"><div className="rank">{card.rank}</div><div className="pip-suit">{card.suit}</div></div>
    </div>
  )
}

function SeatComp({ p, pos, snap, isButton }: {
  p: PokerGame['players'][0];
  pos: typeof POS[0];
  snap: GameSnapshot;
  isButton: boolean;
}) {
  const active = snap.toAct === p.id && (snap.street !== 'handover' && snap.street !== 'idle' && snap.street !== 'showdown')
  const isWinner = snap.lastResult && snap.lastResult.winners.indexOf(p.id) >= 0 && snap.street === 'handover'
  const showCards = snap.lastResult && snap.lastResult.showdown && !p.folded
  const reveal = p.isYou || !!showCards
  const handName = snap.lastResult && snap.lastResult.showdown && snap.lastResult.hands[p.id] && !p.folded
    ? snap.lastResult.hands[p.id].name : null
  const cls = 'seat'+(p.isYou?' you':'')+(p.isBot?' bot':'')+(p.folded?' folded':'')+(active?' active':'')+(isWinner?' winner':'')
  const hasHole = p.hole && p.hole.length === 2 && !p.sittingOut

  return (
    <div className={cls} style={{ left: pos.x+'%', top: pos.y+'%' }}>
      {hasHole && handName && <div className="rank-pill">{handName}</div>}
      {hasHole && (
        <div className="holes">
          <CardComp card={p.hole[0]} faceDown={!reveal} idx={0} />
          <CardComp card={p.hole[1]} faceDown={!reveal} idx={1} />
        </div>
      )}
      <div className="pod">
        {p.isYou ? null : <span className="tag">{p.isBot?'House':'Guest'}</span>}
        <div className="av">
          {p.avatar}
          {isButton && <div className="dealer-btn" style={{bottom:-6,right:-6}}>D</div>}
        </div>
        <div className="meta">
          <div className="nm">{p.name}</div>
          <div className="st tabnum">{p.sittingOut ? 'Sitting out' : fmt(p.stack)}</div>
        </div>
        {p.lastAct && <div className="lastact">{p.lastAct}</div>}
      </div>
      {p.bet > 0 && (
        <div className="betchip" style={{ left:`calc(50% + ${pos.bx}px)`, top:`calc(50% + ${pos.by}px)`, transform:'translate(-50%,-50%)' }}>
          <span className="dot" />{fmtShort(p.bet)}
        </div>
      )}
    </div>
  )
}

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  const bg = kind==='win'?'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)':kind==='lose'?'linear-gradient(160deg,#6a1325,#440b18)':'linear-gradient(180deg,#241f15,#0b0a07)'
  return <div style={{position:'fixed',left:'50%',bottom:38,transform:'translateX(-50%)',zIndex:9999,padding:'13px 26px',borderRadius:999,fontFamily:'Cinzel,serif',fontWeight:600,letterSpacing:'.05em',boxShadow:'0 14px 40px rgba(0,0,0,.5)',border:'1px solid rgba(217,182,90,.5)',background:bg,color:kind==='win'?'#2a1f08':'var(--cream)',animation:'floatUp .35s'}}>{msg}</div>
}

export default function PokerPage() {
  const gameRef = useRef<PokerGame | null>(null)
  const [snap, setSnap] = useState<GameSnapshot | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [raiseTo, setRaiseTo] = useState(0)
  const [dealing, setDealing] = useState(false)
  const [bal, setBal] = useState(100000)
  const [toast, setToast] = useState<{msg:string,kind:string}|null>(null)
  const [muted, setMutedUI] = useState(false)

  useEffect(() => {
    try { setMutedUI(isMuted()) } catch { /* ignore */ }
  }, [])
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const autoNext = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Track session chips for logging
  const sessionStartRef = useRef(100000)

  function showToast(msg: string, kind = '') { setToast({ msg, kind }) }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('chips, invite_code').eq('id', user.id).single()
      if (profile) {
        setBal(profile.chips)
        sessionStartRef.current = profile.chips
        setInviteUrl(`${window.location.origin}/?invite=${profile.invite_code}`)
        const game = new PokerGame(SEATS, profile.chips)
        game.onBankChange = (chips: number) => setBal(chips)
        gameRef.current = game
        setSnap(game.snapshot())
      }
      setLoading(false)
    }
    init()
  }, [router])

  const sync = useCallback(() => {
    if (gameRef.current) setSnap({...gameRef.current.snapshot()})
  }, [])

  const endHand = useCallback(() => {
    sync()
    stopTension()
    if (autoNext.current) clearTimeout(autoNext.current)
    autoNext.current = setTimeout(() => startHand(), 4200)
  }, [sync])

  const drive = useCallback(() => {
    const g = gameRef.current
    if (!g) return
    if (g.street === 'handover' || g.street === 'idle' || g.street === 'showdown') { sync(); return }
    const p = g.players[g.toAct]
    if (!p) { sync(); return }
    sync()
    if (p.isYou) return
    setTimeout(() => {
      const g2 = gameRef.current
      if (!g2) return
      if (g2.players[g2.toAct] && !g2.players[g2.toAct].isYou && g2.street !== 'handover') {
        const d = g2.botDecision()
        const ev = g2.apply(d.type, d.amount)
        sync()
        if (ev === 'showdown' || ev === 'win') { endHand() }
        else { drive() }
      }
    }, 850 + Math.random()*500)
  }, [sync, endHand])

  const startHand = useCallback(async () => {
    if (autoNext.current) clearTimeout(autoNext.current)
    const g = gameRef.current
    if (!g) return
    setDealing(true)
    g.startHand()
    sync()
    // Play deal sounds as cards are "distributed"
    for (let i = 0; i < 2; i++) { playDeal(); await sleep(200) }
    await sleep(300)
    setDealing(false)
    if (g.street === 'idle') { sync(); return }
    drive()
  }, [sync, drive])

  const act = useCallback((type: string, amount?: number) => {
    const g = gameRef.current
    if (!g) return
    if (g.players[g.toAct] && !g.players[g.toAct].isYou) return
    if (type === 'call' || type === 'raise' || type === 'allin') playChip()
    const ev = g.apply(type, amount)
    sync()
    if (ev === 'showdown' || ev === 'win') { endHand() }
    else { drive() }
  }, [sync, drive, endHand])

  // Start first hand
  useEffect(() => {
    if (!loading && gameRef.current) {
      const t = setTimeout(() => startHand(), 500)
      return () => { clearTimeout(t); if (autoNext.current) clearTimeout(autoNext.current) }
    }
  }, [loading, startHand])

  // Raise slider default
  useEffect(() => {
    if (!snap || !gameRef.current) return
    const youToAct = snap.toAct === 0 && !gameRef.current.players[0].folded
    if (youToAct) {
      const legal = gameRef.current.legal()
      if (legal && legal.canRaise) setRaiseTo(legal.minRaiseTo)
    }
  }, [snap?.toAct, snap?.street])

  // Play win/lose sounds and start tension on showdown
  useEffect(() => {
    if (!snap) return
    if (snap.street === 'showdown') startTension()
    if (snap.street === 'handover' && snap.lastResult) {
      stopTension()
      const youWon = snap.lastResult.winners.includes(0)
      if (youWon) playWin(); else playLose()
    }
  }, [snap?.street, snap?.handNo])

  // Log session when chips change significantly (on hand end)
  useEffect(() => {
    if (!snap || snap.street !== 'handover') return
    const currentChips = bal
    const diff = currentChips - sessionStartRef.current
    if (diff !== 0) {
      const wagered = diff < 0 ? -diff : 0
      const won = diff > 0 ? diff : 0
      fetch('/api/game/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'poker', chips_wagered: wagered, chips_won: won }),
      }).catch(() => {})
      sessionStartRef.current = currentChips
    }
  }, [snap?.handNo, snap?.street])

  if (loading || !snap || !gameRef.current) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em'}}>Loading…</div>
    </div>
  )

  const game = gameRef.current
  const youToAct = snap.toAct === 0 && !game.players[0].folded &&
    (snap.street === 'preflop' || snap.street === 'flop' || snap.street === 'turn' || snap.street === 'river')
  const legal: LegalActions | null = youToAct ? game.legal() : null
  const buttonSeat = snap.button
  const showResult = snap.street === 'handover' && snap.lastResult

  const safeRaise = legal ? Math.min(Math.max(raiseTo, legal.minRaiseTo), legal.maxRaiseTo) : 0

  return (
    <div className="table-wrap">
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      <header className="topbar">
        <Link className="back" href="/">← Lobby</Link>
        <div className="title-c">
          <div className="t gold-text">TEXAS HOLD&apos;EM</div>
          <div className="s">NO-LIMIT · BLINDS 500 / 1,000</div>
        </div>
        <div className="right">
          <button className="btn btn-sm btn-ghost" onClick={() => setShowHelp(true)}>How to Play</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowInvite(true)}>Invite</button>
          <button
            className="btn btn-sm btn-ghost"
            style={{padding:'9px 13px',fontSize:16}}
            onClick={() => { const next = !muted; setMutedUI(next); setMuted(next) }}
            title={muted ? 'Unmute' : 'Mute'}
          >{muted ? '🔇' : '🔊'}</button>
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(bal)}</span>
          </div>
        </div>
      </header>

      <div className="felt-stage">
        <div className="table-oval felt felt-red" />

        <div className={'dealer-plaque'+(dealing?' dealing':'')}>
          <div className="croupier">
            🤵
            <span className="bowtie">🎀</span>
          </div>
          Dealer
        </div>

        <div className="center-area">
          {snap.pot > 0 && (
            <div className="pot">
              <span className="coin" />
              <span className="lbl">Pot</span>
              <span className="v tabnum">{fmt(snap.pot)}</span>
            </div>
          )}
          <div className="board">
            {[0,1,2,3,4].map(i => (
              snap.community[i]
                ? <CardComp key={i} card={snap.community[i]} idx={i} />
                : <div key={i} className="slot" />
            ))}
          </div>
        </div>

        {showResult && <div className="result-banner">{snap.message}</div>}

        {game.players.map((p, i) => (
          <SeatComp key={i} p={p} pos={POS[i]} snap={snap} isButton={i === buttonSeat} />
        ))}
      </div>

      <div className="control-bar">
        {snap.street === 'idle' && (
          <div className="actions" style={{flexDirection:'column'}}>
            <div className="waitmsg" style={{marginBottom:6}}>{snap.message || 'Table paused'}</div>
            <button className="btn" onClick={async () => {
              if (game.players[0].stack < BB) {
                const res = await fetch('/api/game/session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ game:'refill', chips_wagered:0, chips_won:100000 }) })
                if (res.ok) { const d = await res.json(); game.setPlayerStack(d.chips); showToast('Topped up!','win') }
              }
              startHand()
            }}>
              {game.players[0].stack < BB ? 'Refill & Deal' : 'Deal In'}
            </button>
          </div>
        )}

        {youToAct && legal && (
          <>
            <div className="actions">
              <button className="btn btn-danger" onClick={() => act('fold')}>Fold</button>
              {legal.canCheck
                ? <button className="btn btn-ghost" onClick={() => act('check')}>Check</button>
                : <button className="btn btn-ghost" onClick={() => act('call')}>Call {fmtShort(legal.toCall)}</button>
              }
            </div>
            {legal.canRaise && (
              <div className="raise-box">
                <div className="raise-top">
                  <input
                    type="number"
                    min={legal.minRaiseTo}
                    max={legal.maxRaiseTo}
                    step={BB}
                    value={raiseTo || ''}
                    placeholder={fmt(legal.minRaiseTo)}
                    onChange={e => setRaiseTo(parseInt(e.target.value, 10) || 0)}
                    onBlur={() => setRaiseTo(safeRaise)}
                    onKeyDown={e => { if (e.key === 'Enter') act(safeRaise >= legal.maxRaiseTo ? 'allin' : 'raise', safeRaise) }}
                  />
                </div>
                <div className="quick">
                  <button onClick={() => setRaiseTo(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round((legal.pot*0.5)/BB)*BB + legal.toCall)))}>½ Pot</button>
                  <button onClick={() => setRaiseTo(Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(legal.pot/BB)*BB + legal.toCall)))}>Pot</button>
                  <button onClick={() => setRaiseTo(legal.maxRaiseTo)}>All-in</button>
                </div>
              </div>
            )}
            {legal.canRaise && (
              <div className="actions">
                <button className="btn" onClick={() => act(safeRaise >= legal.maxRaiseTo ? 'allin' : 'raise', safeRaise)}>
                  {legal.canCheck && legal.toCall === 0 ? 'Bet' : 'Raise to'} {fmtShort(safeRaise)}
                </button>
              </div>
            )}
          </>
        )}

        {!youToAct && snap.street !== 'idle' && !showResult && (
          <div className="waitmsg">
            <span className="spin" />
            {dealing ? 'Dealing…' : (game.players[snap.toAct] ? game.players[snap.toAct].name+' is deciding…' : '…')}
          </div>
        )}

        {showResult && (
          <div className="actions" style={{flexDirection:'column'}}>
            <div className="waitmsg" style={{marginBottom:4}}>{snap.message}</div>
            <button className="btn" onClick={() => startHand()}>Next Hand →</button>
          </div>
        )}
      </div>

      {showInvite && (
        <div className="modal-bg" onClick={() => setShowInvite(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()}>
            <button className="x" onClick={() => setShowInvite(false)}>×</button>
            <h2 className="gold-text">Invite to your table</h2>
            <p>Share this link and friends drop into an open seat. They&apos;ll get 5,000 bonus chips.</p>
            <div className="invite-field">
              <input readOnly value={inviteUrl} />
              <button className="btn" onClick={() => { navigator.clipboard.writeText(inviteUrl).then(() => showToast('Invite link copied','win')) }}>Copy</button>
            </div>
            <div className="seatnote">Blinds 500 / 1,000 · No-limit · 6 seats. Your chips carry across every HouseTables table.</div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-bg" onClick={() => setShowHelp(false)}>
          <div className="modal gilt" onClick={e => e.stopPropagation()} style={{maxHeight:'85vh',overflowY:'auto',width:520}}>
            <button className="x" onClick={() => setShowHelp(false)}>×</button>
            <h2 className="gold-text">How to Play Texas Hold&apos;em</h2>
            <div style={{display:'flex',flexDirection:'column',gap:12,color:'var(--cream-dim)',fontSize:14,lineHeight:1.65}}>
              <p><strong style={{color:'var(--cream)'}}>Objective:</strong> Make the best 5-card hand using any combination of your 2 hole cards and 5 community cards.</p>
              <p><strong style={{color:'var(--cream)'}}>Blinds:</strong> Each hand starts with a Small Blind (500) and Big Blind (1,000) posted by two players. This seeds the pot.</p>
              <div>
                <strong style={{color:'var(--cream)'}}>The Streets:</strong>
                <ul style={{margin:'8px 0 0 16px',display:'flex',flexDirection:'column',gap:4}}>
                  <li><strong style={{color:'var(--cream)'}}>Preflop</strong> — you receive 2 hole cards; first round of betting.</li>
                  <li><strong style={{color:'var(--cream)'}}>Flop</strong> — 3 community cards revealed; second betting round.</li>
                  <li><strong style={{color:'var(--cream)'}}>Turn</strong> — 1 more community card; third betting round.</li>
                  <li><strong style={{color:'var(--cream)'}}>River</strong> — final community card; last betting round.</li>
                  <li><strong style={{color:'var(--cream)'}}>Showdown</strong> — remaining players reveal hands; best hand wins.</li>
                </ul>
              </div>
              <div>
                <strong style={{color:'var(--cream)'}}>Your Actions:</strong>
                <ul style={{margin:'8px 0 0 16px',display:'flex',flexDirection:'column',gap:4}}>
                  <li><strong style={{color:'var(--cream)'}}>Fold</strong> — give up your hand (lose any chips already in the pot).</li>
                  <li><strong style={{color:'var(--cream)'}}>Check</strong> — pass action (only when no bet is facing you).</li>
                  <li><strong style={{color:'var(--cream)'}}>Call</strong> — match the current bet.</li>
                  <li><strong style={{color:'var(--cream)'}}>Raise</strong> — increase the bet using the slider.</li>
                  <li><strong style={{color:'var(--cream)'}}>All-in</strong> — bet all your chips.</li>
                </ul>
              </div>
              <div>
                <strong style={{color:'var(--cream)'}}>Hand Rankings (best to worst):</strong>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 20px',margin:'8px 0 0 0',fontSize:13}}>
                  {[['Royal Flush','A K Q J 10 suited'],['Straight Flush','5 in sequence, suited'],['Four of a Kind','4 matching ranks'],['Full House','3 of a kind + pair'],['Flush','5 cards same suit'],['Straight','5 in sequence'],['Three of a Kind','3 matching ranks'],['Two Pair','two pairs'],['Pair','two matching cards'],['High Card','none of the above']].map(([name,desc]) => (
                    <div key={name}><span style={{color:'var(--gold-l)',fontWeight:600}}>{name}</span><span style={{color:'var(--cream-faint)',fontSize:11,display:'block'}}>{desc}</span></div>
                  ))}
                </div>
              </div>
            </div>
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
        .felt-stage { flex:1;position:relative;margin:44px 30px 22px;min-height:0; }
        .table-oval { position:absolute;inset:4% 3%;border-radius:46% / 50%;border:1px solid rgba(217,182,90,.3);box-shadow:var(--shadow-pop); }
        .table-oval::after { content:"";position:absolute;inset:20px;border-radius:46% / 50%;border:2px solid rgba(217,182,90,.16); }
        .dealer-plaque { position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% - 118px));text-align:center;font-family:var(--fs-head);letter-spacing:.28em;font-size:9px;color:var(--cream-faint);text-transform:uppercase;z-index:3; }
        .dealer-plaque .croupier { width:52px;height:52px;border-radius:50%;margin:0 auto 6px;background:linear-gradient(160deg,#2a1f12,#140e08);border:1px solid rgba(217,182,90,.45);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 16px rgba(0,0,0,.5), inset 0 1px 0 rgba(243,221,150,.2);position:relative; }
        .dealer-plaque .croupier .bowtie { position:absolute;bottom:7px;font-size:11px; }
        .dealer-plaque.dealing .croupier { animation:pulseGold 1s ease infinite; }
        .center-area { position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% + 22px));display:flex;flex-direction:column;align-items:center;gap:12px;z-index:4; }
        .pot { display:inline-flex;align-items:center;gap:9px;padding:7px 18px;border-radius:999px;background:rgba(0,0,0,.5);border:1px solid rgba(217,182,90,.4);font-family:var(--fs-head);font-weight:700; }
        .pot .coin { width:18px;height:18px;border-radius:50%;background:var(--gold-grad);box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .pot .v { color:var(--gold-l);font-size:16px; }
        .pot .lbl { font-size:9px;letter-spacing:.2em;color:var(--cream-faint);text-transform:uppercase; }
        .board { display:flex;gap:7px;min-height:96px;align-items:center; }
        .board .card { --w:66px;animation:dealIn .45s cubic-bezier(.2,.9,.25,1) backwards; }
        .board .slot { width:66px;height:94px;border-radius:8px;border:1px dashed rgba(217,182,90,.16); }
        .seat { position:absolute;width:178px;transform:translate(-50%,-50%);z-index:5; }
        .seat .pod { display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;background:linear-gradient(180deg, rgba(27,24,16,.96), rgba(11,10,7,.96));border:1px solid rgba(217,182,90,.28);box-shadow:0 8px 22px rgba(0,0,0,.5);position:relative;transition:.2s; }
        .seat.active .pod { border-color:var(--gold-l);box-shadow:0 0 0 2px rgba(217,182,90,.55), 0 10px 26px rgba(0,0,0,.5); }
        .seat.folded .pod { opacity:.4;filter:grayscale(.7); }
        .seat .av { width:42px;height:42px;border-radius:50%;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-family:var(--fs-head);font-weight:800;font-size:18px;color:#2a1f08;background:var(--gold-grad);box-shadow:inset 0 1px 0 rgba(255,255,255,.5);position:relative; }
        .seat.bot .av { background:linear-gradient(160deg,#3a3327,#221d12);color:var(--gold-l);border:1px solid rgba(217,182,90,.4); }
        .seat .meta { min-width:0;flex:1; }
        .seat .nm { font-family:var(--fs-head);font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--cream); }
        .seat .st { font-size:12px;color:var(--gold-l);font-variant-numeric:tabular-nums;font-weight:600; }
        .seat .tag { position:absolute;top:-9px;right:10px;font-size:8px;letter-spacing:.14em;text-transform:uppercase;background:rgba(217,182,90,.18);border:1px solid rgba(217,182,90,.4);color:var(--gold-l);padding:2px 6px;border-radius:6px; }
        .seat .lastact { position:absolute;bottom:-10px;left:50%;transform:translate(-50%,100%);font-size:10px;letter-spacing:.06em;color:var(--cream-dim);background:rgba(0,0,0,.55);padding:2px 9px;border-radius:6px;white-space:nowrap;border:1px solid rgba(217,182,90,.2);z-index:6; }
        .dealer-btn { position:absolute;width:25px;height:25px;border-radius:50%;background:var(--ivory);color:#1a130a;font-family:var(--fs-head);font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.5);z-index:7;border:1px solid var(--gold-d); }
        .holes { display:flex;gap:4px;justify-content:center;margin-bottom:8px; }
        .holes .card { --w:46px;animation:dealIn .4s cubic-bezier(.2,.9,.25,1) backwards; }
        .seat.you .holes .card { --w:60px; }
        .seat .betchip { position:absolute;display:flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;background:rgba(0,0,0,.62);border:1px solid rgba(217,182,90,.45);font-size:11px;font-weight:700;color:var(--gold-l);white-space:nowrap;z-index:6; }
        .seat .betchip .dot { width:11px;height:11px;border-radius:50%;background:var(--gold-grad);flex:0 0 auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.5); }
        .seat.winner .pod { border-color:var(--gold-l);box-shadow:0 0 0 2px var(--gold), 0 0 32px rgba(217,182,90,.65); }
        .rank-pill { position:absolute;left:50%;transform:translateX(-50%);top:-12px;font-size:9px;letter-spacing:.06em;background:var(--gold-grad);color:#2a1f08;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap;z-index:8;text-transform:uppercase; }
        .control-bar { padding:14px 24px 18px;min-height:116px;display:flex;align-items:center;justify-content:center;gap:20px;z-index:20;border-top:1px solid rgba(217,182,90,.16);background:linear-gradient(0deg, rgba(11,10,7,.7), transparent); }
        .actions { display:flex;gap:12px;align-items:center; }
        .actions .btn { min-width:122px; }
        .raise-box { display:flex;flex-direction:column;gap:9px;align-items:stretch;width:300px; }
        .raise-top { display:flex;align-items:center; }
        .raise-top input[type=number] { flex:1;background:rgba(0,0,0,.45);border:1.5px solid rgba(217,182,90,.4);border-radius:10px;padding:8px 14px;color:var(--gold-l);font-family:var(--fs-head);font-weight:800;font-size:18px;font-variant-numeric:tabular-nums;text-align:center;outline:none;width:100%; }
        .raise-top input[type=number]:focus { border-color:var(--gold);box-shadow:0 0 0 2px rgba(217,182,90,.2); }
        .raise-top input[type=number]::-webkit-inner-spin-button,.raise-top input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        .quick { display:flex;gap:7px; }
        .quick button { flex:1;font-family:var(--fs-head);font-size:11px;letter-spacing:.05em;text-transform:uppercase;padding:7px 0;border-radius:8px;background:rgba(217,182,90,.1);border:1px solid rgba(217,182,90,.3);color:var(--gold-l);cursor:pointer;transition:.15s; }
        .quick button:hover { background:rgba(217,182,90,.22); }
        .waitmsg { font-family:var(--fs-head);letter-spacing:.08em;color:var(--cream-dim);font-size:14px;display:flex;align-items:center;gap:10px; }
        .waitmsg .spin { width:14px;height:14px;border:2px solid rgba(217,182,90,.3);border-top-color:var(--gold);border-radius:50%;animation:spin360 .8s linear infinite; }
        @keyframes spin360 { to { transform: rotate(360deg); } }
        .result-banner { position:absolute;top:50%;left:50%;transform:translate(-50%,calc(-50% - 96px));z-index:9;text-align:center;font-family:var(--fs-display);font-weight:900;font-size:22px;padding:12px 30px;border-radius:14px;animation:floatUp .35s;background:var(--gold-grad);color:#2a1f08;box-shadow:0 18px 50px rgba(0,0,0,.6);max-width:76%; }
        .modal-bg { position:fixed;inset:0;background:rgba(5,4,2,.72);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:center;justify-content:center;animation:floatUp .2s; }
        .modal { width:460px;max-width:92vw;padding:32px;border-radius:var(--radius-lg);position:relative; }
        .modal h2 { font-family:var(--fs-head);font-weight:700;font-size:24px;margin:0 0 6px; }
        .modal p { color:var(--cream-dim);font-size:14px;line-height:1.55;margin:0 0 20px; }
        .invite-field { display:flex;gap:10px; }
        .invite-field input { flex:1;background:rgba(0,0,0,.4);border:1px solid rgba(217,182,90,.3);border-radius:10px;padding:0 14px;color:var(--gold-l);font-size:13px;height:46px; }
        .modal .x { position:absolute;top:16px;right:18px;background:none;border:none;color:var(--cream-faint);font-size:24px;cursor:pointer;line-height:1; }
        .seatnote { margin-top:18px;font-size:12px;color:var(--cream-faint);line-height:1.5;border-top:1px solid rgba(217,182,90,.15);padding-top:14px; }
        @media (max-width: 640px) {
          .topbar { padding: 10px 14px !important; }
          .topbar .title-c .t { font-size: 16px !important; }
          .topbar .title-c .s { display: none; }
          .topbar .right { gap: 6px !important; flex-wrap: wrap; justify-content: flex-end; max-width: 55vw; }
          .felt-stage { margin: 8px 8px 4px !important; }
          .seat { width: 130px !important; }
          .seat .pod { padding: 6px 8px !important; }
          .seat .nm { font-size: 10px !important; }
          .raise-box { width: 220px !important; }
          .actions .btn { min-width: 90px !important; font-size: 12px !important; padding: 10px 12px !important; }
          .dealer-plaque { font-size: 10px !important; }
          .board { gap: 6px !important; }
          .control-bar { flex-wrap: wrap; gap: 10px !important; padding: 10px 14px 14px !important; min-height: unset !important; }
        }
      `}</style>
    </div>
  )
}
