'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { setMuted } from '@/lib/casino-sounds'

interface Profile {
  id: string
  email: string
  display_name: string
  chips: number
  total_wagered: number
  total_won: number
  invite_code: string
}

function fmt(n: number) { return Number(n).toLocaleString('en-US') }

function Toast({ msg, kind, onDone }: { msg: string; kind: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, kind === 'win' || kind === 'lose' ? 2200 : 1700)
    return () => clearTimeout(t)
  }, [kind, onDone])

  const bg = kind === 'win'
    ? 'linear-gradient(160deg,#f3dd96,#d9b65a,#9c7b2e)'
    : kind === 'lose'
    ? 'linear-gradient(160deg,#6a1325,#440b18)'
    : 'linear-gradient(180deg,#241f15,#0b0a07)'
  const color = kind === 'win' ? '#2a1f08' : 'var(--cream)'

  return (
    <div style={{
      position:'fixed',left:'50%',bottom:38,transform:'translateX(-50%)',
      zIndex:9999,padding:'13px 26px',borderRadius:999,
      fontFamily:'Cinzel,serif',fontWeight:600,letterSpacing:'.05em',
      pointerEvents:'none',boxShadow:'0 14px 40px rgba(0,0,0,.5)',
      border:'1px solid rgba(217,182,90,.5)',background:bg,color,
      animation:'floatUp .35s',
    }}>
      {msg}
    </div>
  )
}

function LobbyContent() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [refillEnabled, setRefillEnabled] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{msg:string,kind:string}|null>(null)
  const [muted, setMutedUI] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const showToast = useCallback((msg: string, kind = '') => {
    setToast({ msg, kind })
  }, [])

  useEffect(() => {
    try { setMutedUI(localStorage.getItem('casinoMuted') === '1') } catch {}
  }, [])

  useEffect(() => {
    setSiteUrl(window.location.origin)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('admin_settings').select('value').eq('key', 'refill_enabled').single(),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (settingsRes.data) setRefillEnabled(settingsRes.data.value === 'true')
      setLoading(false)

      // Show invite bonus toast
      if (searchParams.get('bonus') === 'invite') {
        showToast('You got 5,000 bonus chips for joining via invite!', 'win')
      }
    }
    load()
  }, [router, searchParams, showToast])

  async function handleRefill() {
    if (!profile) return
    if (profile.chips >= 100000) { showToast('You\'re already flush!'); return }
    const res = await fetch('/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'refill', chips_wagered: 0, chips_won: 100000 - profile.chips }),
    })
    if (res.ok) {
      const data = await res.json()
      setProfile(p => p ? { ...p, chips: data.chips } : p)
      showToast('Topped up to 100,000', 'win')
    }
  }

  async function handleCopyInvite() {
    if (!profile) return
    const url = `${siteUrl}/?invite=${profile.invite_code}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    showToast('Invite link copied!', 'win')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em',fontSize:18}}>
          Loading…
        </div>
      </div>
    )
  }

  const net = profile ? profile.chips - 100000 : 0
  const inviteUrl = profile ? `${siteUrl}/?invite=${profile.invite_code}` : ''

  return (
    <div style={{position:'relative',minHeight:'100vh'}}>
      {toast && <Toast msg={toast.msg} kind={toast.kind} onDone={() => setToast(null)} />}

      {/* Ambient chips */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,overflow:'hidden'}}>
        {['#d9b65a','#b3122a','#137a4a','#d9b65a','#b3122a','#137a4a','#d9b65a','#b3122a'].map((color, i) => (
          <div key={i} style={{
            position:'absolute',borderRadius:'50%',opacity:.06,
            border:'6px dashed '+color,
            width:(60+Math.sin(i)*60+60)+'px',
            height:(60+Math.sin(i)*60+60)+'px',
            left:(i*13)+'%',top:(i*11+5)+'%',
          }}/>
        ))}
      </div>

      <header style={{
        position:'sticky',top:0,zIndex:40,display:'flex',alignItems:'center',
        justifyContent:'space-between',padding:'18px 28px',
        background:'linear-gradient(180deg, rgba(11,10,7,.92), rgba(11,10,7,.4) 70%, transparent)',
        backdropFilter:'blur(8px)',
      }}>
        <Link href="/" style={{display:'flex',alignItems:'center',gap:13,textDecoration:'none'}}>
          <div style={{
            width:42,height:42,borderRadius:'50%',background:'var(--gold-grad)',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#2a1f08',fontFamily:'var(--fs-display)',fontWeight:900,fontSize:22,
            boxShadow:'inset 0 1px 0 rgba(255,255,255,.6), inset 0 -3px 6px var(--gold-deep), 0 4px 12px rgba(0,0,0,.5)',
          }}>H</div>
          <div>
            <div className="gold-text" style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:23,letterSpacing:'.14em'}}>HOUSETABLES</div>
            <div style={{fontFamily:'var(--fs-head)',fontSize:9,letterSpacing:'.42em',color:'var(--cream-faint)',marginTop:2}}>PRIVATE CARD ROOM</div>
          </div>
        </Link>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="balance">
            <div className="coin">H</div>
            <span className="amt tabnum">{fmt(profile?.chips || 0)}</span>
          </div>
          {refillEnabled && (
            <button className="btn btn-sm btn-ghost" onClick={handleRefill}>Refill</button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={handleSignOut} style={{fontSize:11}}>Sign Out</button>
        </div>
      </header>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'0 28px 80px',position:'relative',zIndex:1}}>
        <section style={{textAlign:'center',padding:'54px 0 30px',position:'relative'}}>
          <div style={{fontFamily:'var(--fs-head)',letterSpacing:'.5em',fontSize:12,color:'var(--gold)',textTransform:'uppercase',marginBottom:22}}>
            Members Only · Est. MMXXVI
          </div>
          <h1 style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:'clamp(48px,8vw,98px)',lineHeight:.96,margin:0}}>
            <span className="gold-text">The House</span><br/>Always Welcomes You
          </h1>
          <p style={{maxWidth:540,margin:'22px auto 0',color:'var(--cream-dim)',fontSize:17,lineHeight:1.6}}>
            Five tables. Real stakes, no real money. Pull up a chair, stack your chips, and play.
          </p>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16,margin:'26px auto 0',maxWidth:340}}>
            <hr className="hr-gold" style={{flex:1,border:'none'}} />
            <div style={{width:7,height:7,borderRadius:'50%',background:'var(--gold)',transform:'rotate(45deg)'}}/>
            <hr className="hr-gold" style={{flex:1,border:'none'}} />
          </div>
        </section>

        {/* Game cards */}
        <section style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:24,marginTop:46}}>
          {/* Blackjack */}
          <Link href="/blackjack" style={{
            gridColumn:'span 2',position:'relative',borderRadius:'var(--radius-lg)',overflow:'hidden',cursor:'pointer',
            textDecoration:'none',color:'inherit',border:'1px solid rgba(217,182,90,.32)',
            boxShadow:'var(--shadow-pop)',transition:'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, border-color .25s',
            display:'flex',flexDirection:'column',minHeight:340,
          }} className="game felt">
            <div style={{flex:1,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              <div style={{display:'flex',position:'relative',zIndex:2}}>
                <div className="card" style={{'--w':'84px'} as React.CSSProperties}>
                  <div className="pip-tl"><div className="rank">A</div><div className="pip-suit">♠</div></div>
                  <div className="center-suit">♠</div>
                  <div className="pip-br"><div className="rank">A</div><div className="pip-suit">♠</div></div>
                </div>
                <div className="card red" style={{'--w':'84px',marginLeft:'-38px'} as React.CSSProperties}>
                  <div className="pip-tl"><div className="rank">K</div><div className="pip-suit">♥</div></div>
                  <div className="center-suit">♥</div>
                  <div className="pip-br"><div className="rank">K</div><div className="pip-suit">♥</div></div>
                </div>
              </div>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 120%, transparent 40%, rgba(0,0,0,.5))'}}/>
            </div>
            <div style={{padding:'20px 24px',background:'linear-gradient(180deg, rgba(19,17,11,.6), var(--ink-900))',borderTop:'1px solid rgba(217,182,90,.25)',position:'relative',zIndex:2}}>
              <h3 style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:23,margin:0,letterSpacing:'.04em'}}>Blackjack</h3>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Beat the dealer to 21</span>
                <span style={{fontFamily:'var(--fs-head)',fontSize:12,letterSpacing:'.14em',color:'var(--gold-l)',textTransform:'uppercase'}}>Take a seat →</span>
              </div>
            </div>
          </Link>

          {/* Poker */}
          <Link href="/poker" style={{
            gridColumn:'span 2',position:'relative',borderRadius:'var(--radius-lg)',overflow:'hidden',cursor:'pointer',
            textDecoration:'none',color:'inherit',border:'1px solid rgba(217,182,90,.32)',
            boxShadow:'var(--shadow-pop)',transition:'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, border-color .25s',
            display:'flex',flexDirection:'column',minHeight:340,
          }} className="game felt felt-red">
            <div style={{flex:1,position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,overflow:'hidden',padding:'20px 0 0'}}>
              {/* Community cards */}
              <div style={{display:'flex',gap:6,zIndex:2,position:'relative'}}>
                {[{r:'A',s:'♠',red:false},{r:'K',s:'♠',red:false},{r:'Q',s:'♠',red:false}].map((c,i) => (
                  <div key={i} className={'card '+(c.red?'red':'')} style={{'--w':'60px'} as React.CSSProperties}>
                    <div className="pip-tl"><div className="rank">{c.r}</div><div className="pip-suit">{c.s}</div></div>
                    <div className="center-suit">{c.s}</div>
                    <div className="pip-br"><div className="rank">{c.r}</div><div className="pip-suit">{c.s}</div></div>
                  </div>
                ))}
              </div>
              {/* Hole cards (face down) */}
              <div style={{display:'flex',gap:8,zIndex:2,position:'relative'}}>
                <div className="card back" style={{'--w':'60px'} as React.CSSProperties} />
                <div className="card back" style={{'--w':'60px'} as React.CSSProperties} />
              </div>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 120%, transparent 40%, rgba(0,0,0,.5))'}}/>
            </div>
            <div style={{padding:'20px 24px',background:'linear-gradient(180deg, rgba(19,17,11,.6), var(--ink-900))',borderTop:'1px solid rgba(217,182,90,.25)',position:'relative',zIndex:2}}>
              <h3 style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:23,margin:0,letterSpacing:'.04em'}}>Texas Hold&apos;em</h3>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,letterSpacing:'.1em',color:'var(--cream-dim)',textTransform:'uppercase',fontFamily:'var(--fs-head)'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'#3ad07a',boxShadow:'0 0 0 0 rgba(58,208,122,.6)',animation:'pulseLive 2s infinite',display:'inline-block'}}/>
                  Invite friends
                </span>
                <span style={{fontFamily:'var(--fs-head)',fontSize:12,letterSpacing:'.14em',color:'var(--gold-l)',textTransform:'uppercase'}}>Take a seat →</span>
              </div>
            </div>
          </Link>

          {/* Roulette */}
          <Link href="/roulette" style={{
            gridColumn:'span 2',position:'relative',borderRadius:'var(--radius-lg)',overflow:'hidden',cursor:'pointer',
            textDecoration:'none',color:'inherit',border:'1px solid rgba(217,182,90,.32)',
            boxShadow:'var(--shadow-pop)',transition:'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, border-color .25s',
            display:'flex',flexDirection:'column',minHeight:340,
          }} className="game felt">
            <div style={{flex:1,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              <div style={{zIndex:2,position:'relative'}}>
                <div style={{
                  width:150,height:150,borderRadius:'50%',
                  background:`conic-gradient(from 0deg,
                    #137a4a 0 10deg,#b3122a 10deg 20deg,#1a1a1a 20deg 30deg,#b3122a 30deg 40deg,
                    #1a1a1a 40deg 50deg,#b3122a 50deg 60deg,#1a1a1a 60deg 70deg,#b3122a 70deg 80deg,
                    #b3122a 80deg 90deg,#1a1a1a 90deg 100deg,#b3122a 100deg 110deg,#1a1a1a 110deg 120deg,
                    #b3122a 120deg 130deg,#1a1a1a 130deg 140deg,#b3122a 140deg 150deg,#1a1a1a 150deg 160deg,
                    #b3122a 160deg 170deg,#1a1a1a 170deg 180deg,#137a4a 180deg 190deg,#b3122a 190deg 200deg,
                    #1a1a1a 200deg 210deg,#b3122a 210deg 220deg,#1a1a1a 220deg 230deg,#b3122a 230deg 240deg,
                    #1a1a1a 240deg 250deg,#b3122a 250deg 260deg,#1a1a1a 260deg 270deg,#b3122a 270deg 280deg,
                    #1a1a1a 280deg 290deg,#b3122a 290deg 300deg,#1a1a1a 300deg 310deg,#b3122a 310deg 320deg,
                    #1a1a1a 320deg 330deg,#b3122a 330deg 340deg,#1a1a1a 340deg 350deg,#b3122a 350deg 360deg)`,
                  boxShadow:'inset 0 0 0 8px var(--gold-d), inset 0 0 0 11px #2a1f08, 0 12px 30px rgba(0,0,0,.6)',
                  animation:'spinSlow 14s linear infinite',
                  position:'relative',
                }}>
                  <div style={{
                    position:'absolute',inset:38,borderRadius:'50%',background:'var(--gold-grad)',
                    boxShadow:'inset 0 2px 6px rgba(255,255,255,.5), inset 0 -3px 8px var(--gold-deep)',
                  }}/>
                </div>
              </div>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 120%, transparent 40%, rgba(0,0,0,.5))'}}/>
            </div>
            <div style={{padding:'20px 24px',background:'linear-gradient(180deg, rgba(19,17,11,.6), var(--ink-900))',borderTop:'1px solid rgba(217,182,90,.25)',position:'relative',zIndex:2}}>
              <h3 style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:23,margin:0,letterSpacing:'.04em'}}>Roulette</h3>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Rouge, noir, or fortune</span>
                <span style={{fontFamily:'var(--fs-head)',fontSize:12,letterSpacing:'.14em',color:'var(--gold-l)',textTransform:'uppercase'}}>Take a seat →</span>
              </div>
            </div>
          </Link>

          {/* Slots — centered in row 2 */}
          <Link href="/slots" style={{
            gridColumn:'2 / span 2',position:'relative',borderRadius:'var(--radius-lg)',overflow:'hidden',cursor:'pointer',
            textDecoration:'none',color:'inherit',border:'1px solid rgba(217,182,90,.32)',
            boxShadow:'var(--shadow-pop)',transition:'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, border-color .25s',
            display:'flex',flexDirection:'column',minHeight:340,
          }} className="game felt">
            <div style={{flex:1,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
              {/* Mini slot machine cabinet */}
              <div style={{zIndex:2,position:'relative',display:'flex',flexDirection:'column',alignItems:'center',gap:0}}>
                {/* Cabinet top marquee */}
                <div style={{
                  background:'linear-gradient(180deg,#2a1f08,#1a130a)',
                  border:'2px solid rgba(217,182,90,.6)',borderBottom:'none',
                  borderRadius:'12px 12px 0 0',padding:'6px 24px',
                  fontFamily:'Cinzel,serif',fontWeight:900,fontSize:11,letterSpacing:'.4em',
                  color:'var(--gold-l)',textShadow:'0 0 12px rgba(217,182,90,.8)',
                  whiteSpace:'nowrap',
                }}>JACKPOT</div>
                {/* Reels window */}
                <div style={{
                  background:'rgba(0,0,0,.8)',border:'2px solid rgba(217,182,90,.6)',
                  borderRadius:'0 0 10px 10px',padding:'10px 14px',
                  display:'flex',gap:8,alignItems:'center',position:'relative',
                }}>
                  {/* Win line */}
                  <div style={{position:'absolute',left:0,right:0,top:'50%',height:2,background:'rgba(217,182,90,.5)',transform:'translateY(-50%)',zIndex:3,pointerEvents:'none'}}/>
                  {[{s:'7',c:'#d9b65a'},{s:'7',c:'#d9b65a'},{s:'7',c:'#d9b65a'}].map((r,i) => (
                    <div key={i} style={{
                      width:58,height:72,borderRadius:8,
                      background:'linear-gradient(180deg,#1a1306,#0b0a07)',
                      border:'1.5px solid rgba(217,182,90,.3)',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontFamily:'Cinzel,serif',fontWeight:900,fontSize:32,
                      color:r.c,textShadow:`0 0 16px ${r.c}`,
                      boxShadow:`inset 0 0 12px rgba(0,0,0,.6), 0 0 8px rgba(217,182,90,.2)`,
                      position:'relative',zIndex:2,
                    }}>{r.s}</div>
                  ))}
                </div>
                {/* Win label */}
                <div style={{
                  marginTop:8,fontFamily:'Cinzel,serif',fontWeight:700,fontSize:11,
                  letterSpacing:'.25em',color:'#d9b65a',textShadow:'0 0 10px rgba(217,182,90,.7)',
                }}>× 100 WIN</div>
              </div>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 120%, transparent 40%, rgba(0,0,0,.5))'}}/>
            </div>
            <div style={{padding:'20px 24px',background:'linear-gradient(180deg, rgba(19,17,11,.6), var(--ink-900))',borderTop:'1px solid rgba(217,182,90,.25)',position:'relative',zIndex:2}}>
              <h3 style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:23,margin:0,letterSpacing:'.04em'}}>Slots</h3>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Classic three-reel, jackpot up to 100×</span>
                <span style={{fontFamily:'var(--fs-head)',fontSize:12,letterSpacing:'.14em',color:'var(--gold-l)',textTransform:'uppercase'}}>Pull lever →</span>
              </div>
            </div>
          </Link>

          {/* Baccarat — centered in row 2, red felt */}
          <Link href="/baccarat" style={{
            gridColumn:'4 / span 2',position:'relative',borderRadius:'var(--radius-lg)',overflow:'hidden',cursor:'pointer',
            textDecoration:'none',color:'inherit',border:'1px solid rgba(217,182,90,.32)',
            boxShadow:'var(--shadow-pop)',transition:'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s, border-color .25s',
            display:'flex',flexDirection:'column',minHeight:340,
          }} className="game felt felt-red">
            <div style={{flex:1,position:'relative',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,overflow:'hidden',padding:16}}>
              {/* Banker hand label */}
              <div style={{fontFamily:'Cinzel,serif',fontSize:10,letterSpacing:'.3em',color:'rgba(217,182,90,.6)',textTransform:'uppercase',zIndex:2}}>Banker · 9</div>
              {/* Banker cards */}
              <div style={{display:'flex',gap:-8,zIndex:2,position:'relative'}}>
                {[{r:'K',s:'♠',red:false},{r:'9',s:'♦',red:true}].map((c,i) => (
                  <div key={i} className={'card '+(c.red?'red':'')} style={{'--w':'72px',marginLeft:i?'-28px':'0'} as React.CSSProperties}>
                    <div className="pip-tl"><div className="rank">{c.r}</div><div className="pip-suit">{c.s}</div></div>
                    <div className="center-suit">{c.s}</div>
                    <div className="pip-br"><div className="rank">{c.r}</div><div className="pip-suit">{c.s}</div></div>
                  </div>
                ))}
              </div>
              {/* vs divider */}
              <div style={{fontFamily:'Cinzel,serif',fontWeight:900,fontSize:11,letterSpacing:'.4em',color:'rgba(217,182,90,.5)',zIndex:2}}>— vs —</div>
              {/* Player cards */}
              <div style={{display:'flex',zIndex:2,position:'relative'}}>
                {[{r:'A',s:'♥',red:true},{r:'8',s:'♣',red:false}].map((c,i) => (
                  <div key={i} className={'card '+(c.red?'red':'')} style={{'--w':'72px',marginLeft:i?'-28px':'0'} as React.CSSProperties}>
                    <div className="pip-tl"><div className="rank">{c.r}</div><div className="pip-suit">{c.s}</div></div>
                    <div className="center-suit">{c.s}</div>
                    <div className="pip-br"><div className="rank">{c.r}</div><div className="pip-suit">{c.s}</div></div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:'Cinzel,serif',fontSize:10,letterSpacing:'.3em',color:'rgba(217,182,90,.6)',textTransform:'uppercase',zIndex:2}}>Player · 9</div>
              <div style={{position:'absolute',inset:0,background:'radial-gradient(120% 100% at 50% 120%, transparent 40%, rgba(0,0,0,.5))'}}/>
            </div>
            <div style={{padding:'20px 24px',background:'linear-gradient(180deg, rgba(19,17,11,.6), var(--ink-900))',borderTop:'1px solid rgba(217,182,90,.25)',position:'relative',zIndex:2}}>
              <h3 style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:23,margin:0,letterSpacing:'.04em'}}>Baccarat</h3>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Player, Banker, or Tie</span>
                <span style={{fontFamily:'var(--fs-head)',fontSize:12,letterSpacing:'.14em',color:'var(--gold-l)',textTransform:'uppercase'}}>Take a seat →</span>
              </div>
            </div>
          </Link>
        </section>

        {/* Lower panels */}
        <section style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:24,marginTop:34}}>
          {/* Invite panel */}
          <div className="gilt" style={{padding:30,borderRadius:'var(--radius-lg)'}}>
            <h2 className="gold-text" style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:22,margin:'0 0 6px',letterSpacing:'.03em'}}>
              Invite the table
            </h2>
            <p style={{color:'var(--cream-dim)',fontSize:14,lineHeight:1.55,margin:'0 0 22px'}}>
              Share your private invite link. Friends who sign up get 5,000 bonus chips — and so do you.
            </p>
            <div style={{display:'flex',gap:10,alignItems:'stretch'}}>
              <input
                readOnly
                value={inviteUrl}
                style={{
                  flex:1,background:'rgba(0,0,0,.4)',border:'1px solid rgba(217,182,90,.3)',borderRadius:10,
                  padding:'0 16px',color:'var(--gold-l)',fontFamily:'Manrope',fontSize:14,
                  letterSpacing:'.02em',height:48,
                }}
              />
              <button className="btn" onClick={handleCopyInvite}>{copied ? 'Copied!' : 'Copy Link'}</button>
            </div>
            <div style={{
              display:'inline-flex',alignItems:'center',gap:10,marginTop:18,padding:'10px 16px',
              borderRadius:10,background:'rgba(0,0,0,.35)',border:'1px dashed rgba(217,182,90,.4)',
            }}>
              <span style={{fontSize:11,letterSpacing:'.2em',color:'var(--cream-faint)',textTransform:'uppercase'}}>Your Code</span>
              <span style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:20,letterSpacing:'.32em',color:'var(--gold-l)'}}>
                {profile?.invite_code || '——————'}
              </span>
            </div>
            <div style={{display:'flex',gap:10,marginTop:22}}>
              <div style={{
                flex:1,aspectRatio:'1',borderRadius:12,border:'1px dashed rgba(217,182,90,.3)',
                display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',
                gap:6,background:'rgba(0,0,0,.25)',
              }}>
                <div style={{
                  width:34,height:34,borderRadius:'50%',
                  background:'var(--gold-grad)',color:'#2a1f08',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontFamily:'var(--fs-head)',fontWeight:800,fontSize:14,
                }}>
                  {profile?.display_name?.[0]?.toUpperCase() || 'V'}
                </div>
                <small style={{fontSize:10,letterSpacing:'.1em',color:'var(--cream-faint)',textTransform:'uppercase'}}>You</small>
              </div>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  flex:1,aspectRatio:'1',borderRadius:12,border:'1px dashed rgba(217,182,90,.3)',
                  display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',
                  gap:6,background:'rgba(0,0,0,.25)',
                }}>
                  <div style={{
                    width:34,height:34,borderRadius:'50%',
                    background:'rgba(217,182,90,.12)',border:'1px solid rgba(217,182,90,.3)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'var(--cream-faint)',fontSize:16,
                  }}>+</div>
                  <small style={{fontSize:10,letterSpacing:'.1em',color:'var(--cream-faint)',textTransform:'uppercase'}}>Open</small>
                </div>
              ))}
            </div>
          </div>

          {/* Stack panel */}
          <div className="gilt" style={{padding:30,borderRadius:'var(--radius-lg)'}}>
            <h2 className="gold-text" style={{fontFamily:'var(--fs-head)',fontWeight:700,fontSize:22,margin:'0 0 6px',letterSpacing:'.03em'}}>
              Your Stack
            </h2>
            <p style={{color:'var(--cream-dim)',fontSize:14,lineHeight:1.55,margin:'0 0 16px'}}>
              Synced to your account across all devices.
            </p>
            <div className="gold-text tabnum" style={{fontFamily:'var(--fs-display)',fontWeight:900,fontSize:42}}>
              {fmt(profile?.chips || 0)}
            </div>
            <div style={{margin:'18px 0 22px'}}>
              <div style={{display:'flex',justifyContent:'space-between',padding:'11px 0',borderBottom:'1px solid rgba(217,182,90,.14)'}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Starting bankroll</span>
                <span style={{fontWeight:700,color:'var(--cream)',fontVariantNumeric:'tabular-nums'}}>100,000</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'11px 0',borderBottom:'1px solid rgba(217,182,90,.14)'}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Net since start</span>
                <span style={{
                  fontWeight:700,
                  color: net >= 0 ? '#5fd99a' : '#e7708a',
                  fontVariantNumeric:'tabular-nums',
                }}>
                  {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
                </span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'11px 0'}}>
                <span style={{color:'var(--cream-faint)',fontSize:13}}>Total wagered</span>
                <span style={{fontWeight:700,color:'var(--cream)',fontVariantNumeric:'tabular-nums'}}>{fmt(profile?.total_wagered || 0)}</span>
              </div>
            </div>
            {refillEnabled && (
              <button className="btn" onClick={handleRefill} style={{width:'100%'}}>
                Top up to 100,000
              </button>
            )}
          </div>
        </section>

        <footer style={{textAlign:'center',marginTop:60,color:'var(--cream-faint)',fontSize:12,letterSpacing:'.08em'}}>
          <hr className="hr-gold" style={{maxWidth:200,margin:'0 auto 20px',border:'none'}} />
          Play responsibly — these chips hold no cash value. HouseTables is a private game among friends.
        </footer>
      </div>

      <style>{`
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes pulseLive { 0% { box-shadow: 0 0 0 0 rgba(58,208,122,.6); } 70% { box-shadow: 0 0 0 7px rgba(58,208,122,0); } }
        .game:hover { transform: translateY(-8px); border-color: var(--gold) !important; box-shadow: 0 28px 70px rgba(0,0,0,.6), 0 0 0 1px rgba(217,182,90,.4) !important; }
      `}</style>
    </div>
  )
}

export default function LobbyPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'var(--gold-l)',fontFamily:'var(--fs-head)',letterSpacing:'.1em',fontSize:18}}>Loading…</div>
    </div>}>
      <LobbyContent />
    </Suspense>
  )
}
