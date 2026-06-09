'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Friend {
  id: string
  display_name: string
  last_login: string | null
  activeGame: { code: string; game: string } | null
}

interface SearchResult {
  id: string
  display_name: string
  invite_code: string
}

const GAME_ICONS: Record<string, string> = {
  blackjack: '🃏', poker: '♠', roulette: '🎡', slots: '🎰', baccarat: '🃏', tower: '🗼',
}

function isOnline(lastLogin: string | null) {
  if (!lastLogin) return false
  return Date.now() - new Date(lastLogin).getTime() < 2 * 60 * 1000
}

export default function FriendsBubble() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'friends' | 'search'>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [myCode, setMyCode] = useState('')
  const [addCode, setAddCode] = useState('')
  const [addErr, setAddErr] = useState('')
  const [addOk, setAddOk] = useState('')
  const [adding, setAdding] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathname = usePathname()

  const loadFriends = useCallback(async () => {
    const res = await fetch('/api/friends')
    if (res.ok) {
      const data = await res.json()
      setFriends(data.friends || [])
      setMyCode(data.myCode || '')
      setLoggedIn(true)
    }
  }, [])

  useEffect(() => {
    loadFriends()
    const id = setInterval(loadFriends, 30000)
    return () => clearInterval(id)
  }, [loadFriends])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (searchQuery.trim().length < 2) { setSearchResults([]); setSearching(false); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      }
      setSearching(false)
    }, 350)
  }, [searchQuery])

  async function addFromSearch(result: SearchResult) {
    if (addingId) return
    setAddingId(result.id)
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendCode: result.invite_code }),
    })
    const data = await res.json()
    if (res.ok) {
      setAddedIds(prev => new Set([...prev, result.id]))
      setSearchResults(prev => prev.filter(r => r.id !== result.id))
      setTimeout(loadFriends, 500)
    } else {
      console.error(data.error)
    }
    setAddingId(null)
  }

  async function addFriend() {
    if (!addCode.trim() || adding) return
    setAdding(true); setAddErr(''); setAddOk('')
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendCode: addCode.trim() }),
    })
    const data = await res.json()
    setAdding(false)
    if (res.ok) {
      setAddOk(`${data.name} added!`)
      setAddCode('')
      // Optimistically add friend to list, then do a full reload
      setFriends(prev => [...prev, { id: data.id, display_name: data.name, last_login: null, activeGame: null }])
      setTimeout(loadFriends, 500)
    } else {
      setAddErr(data.error || 'Could not add friend')
    }
  }

  const onlineFriends = friends.filter(f => isOnline(f.last_login))

  if (!loggedIn || pathname.startsWith('/login') || pathname.startsWith('/banned') || pathname.startsWith('/admin')) return null

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, left: 28, zIndex: 999,
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 18px 10px 12px', borderRadius: 999,
          background: 'linear-gradient(180deg, rgba(36,31,21,.97), rgba(11,10,7,.99))',
          border: '1px solid rgba(217,182,90,.5)',
          boxShadow: '0 8px 28px rgba(0,0,0,.6), 0 0 0 1px rgba(217,182,90,.15)',
          cursor: 'pointer', transition: 'transform .15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-grad)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, flexShrink: 0, position: 'relative',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
        }}>
          👥
          {onlineFriends.length > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: '#3ad07a', color: '#0b0a07', borderRadius: 999,
              fontSize: 9, fontWeight: 800, padding: '1px 4px',
              fontFamily: 'var(--fs-head)', minWidth: 14, textAlign: 'center',
              border: '1.5px solid #0b0a07', lineHeight: 1.4,
            }}>{onlineFriends.length}</span>
          )}
        </div>
        <span style={{ fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-l)' }}>
          Friends
        </span>
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 82, left: 28, zIndex: 998,
          width: 320, maxWidth: 'calc(100vw - 56px)', maxHeight: '70vh',
          background: 'linear-gradient(180deg, rgba(30,26,18,.99), rgba(11,10,7,.99))',
          border: '1px solid rgba(217,182,90,.35)', borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,.8)', display: 'flex',
          flexDirection: 'column', overflow: 'hidden', animation: 'floatUp .2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(217,182,90,.18)' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['friends', 'search'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: tab === t ? 'rgba(217,182,90,.18)' : 'none',
                  border: tab === t ? '1px solid rgba(217,182,90,.4)' : '1px solid transparent',
                  borderRadius: 8, padding: '4px 12px', cursor: 'pointer',
                  color: tab === t ? 'var(--gold-l)' : 'var(--cream-faint)',
                  fontSize: 11, fontFamily: 'var(--fs-head)', fontWeight: 700,
                  letterSpacing: '.08em', textTransform: 'uppercase',
                }}>
                  {t === 'friends' ? '👥 Friends' : '🔍 Search'}
                </button>
              ))}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--cream-faint)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {tab === 'search' ? (
            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by display name…"
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.3)', borderRadius: 10, padding: '10px 14px', color: 'var(--gold-l)', fontSize: 13, fontFamily: 'var(--fs-head)', outline: 'none', letterSpacing: '.04em' }}
              />
              {searching && <div style={{ color: 'var(--cream-faint)', fontSize: 12, textAlign: 'center' }}>Searching…</div>}
              {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div style={{ color: 'var(--cream-faint)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>No players found.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(217,182,90,.1)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--fs-head)', fontSize: 13, fontWeight: 700, color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.display_name || 'Unknown'}</div>
                      <div style={{ fontSize: 10, color: 'var(--cream-faint)', marginTop: 2, letterSpacing: '.1em' }}>{r.invite_code}</div>
                    </div>
                    <button
                      onClick={() => addFromSearch(r)}
                      disabled={addingId === r.id || addedIds.has(r.id)}
                      style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(217,182,90,.15)', border: '1px solid rgba(217,182,90,.35)', color: 'var(--gold-l)', fontSize: 11, fontFamily: 'var(--fs-head)', fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer', textTransform: 'uppercase', flexShrink: 0, opacity: addingId === r.id ? .6 : 1 }}
                    >
                      {addedIds.has(r.id) ? 'Added!' : addingId === r.id ? '…' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Friend code */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase', marginBottom: 8 }}>Your Friend Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.4)', borderRadius: 10, border: '1px solid rgba(217,182,90,.22)', padding: '10px 14px' }}>
                <span style={{ fontFamily: 'var(--fs-head)', fontSize: 16, fontWeight: 800, color: 'var(--gold-l)', letterSpacing: '.12em', flex: 1 }}>{myCode || '—'}</span>
                <button onClick={() => { navigator.clipboard.writeText(myCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500) }} style={{ background: 'rgba(217,182,90,.15)', border: '1px solid rgba(217,182,90,.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--gold-l)', fontSize: 11, fontFamily: 'var(--fs-head)', letterSpacing: '.06em' }}>
                  {codeCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Add friend */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase', marginBottom: 8 }}>Add by Code</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={addCode}
                  onChange={e => { setAddCode(e.target.value.toUpperCase()); setAddErr(''); setAddOk('') }}
                  onKeyDown={e => e.key === 'Enter' && addFriend()}
                  placeholder="Enter their code"
                  style={{ flex: 1, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(217,182,90,.22)', borderRadius: 8, padding: '8px 12px', color: 'var(--gold-l)', fontSize: 13, fontFamily: 'var(--fs-head)', outline: 'none', letterSpacing: '.06em' }}
                />
                <button onClick={addFriend} disabled={adding} style={{ background: 'var(--gold-grad)', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#2a1f08', fontSize: 12, fontFamily: 'var(--fs-head)', fontWeight: 700, letterSpacing: '.06em', opacity: adding ? .6 : 1 }}>Add</button>
              </div>
              {addErr && <div style={{ fontSize: 12, color: '#e7708a', marginTop: 6, lineHeight: 1.4 }}>{addErr}</div>}
              {addOk && <div style={{ fontSize: 12, color: '#5fd99a', marginTop: 6 }}>{addOk}</div>}
            </div>

            {/* List */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: '.15em', color: 'var(--cream-faint)', fontFamily: 'var(--fs-head)', textTransform: 'uppercase', marginBottom: 8 }}>
                {friends.length === 0 ? 'No Friends Yet' : `${friends.length} Friend${friends.length !== 1 ? 's' : ''}`}
              </div>
              {friends.length === 0 ? (
                <p style={{ color: 'var(--cream-faint)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  Share your code above to start adding friends. When they&apos;re online or in a game, they&apos;ll appear here.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...friends].sort((a, b) => (isOnline(b.last_login) ? 1 : 0) - (isOnline(a.last_login) ? 1 : 0)).map(f => {
                    const online = isOnline(f.last_login)
                    return (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(217,182,90,.1)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: online ? '#3ad07a' : '#3a3530', boxShadow: online ? '0 0 6px rgba(58,208,122,.7)' : 'none' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--fs-head)', fontSize: 13, fontWeight: 700, color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.display_name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: 'var(--cream-faint)', marginTop: 2 }}>
                            {f.activeGame
                              ? `${GAME_ICONS[f.activeGame.game] || '🎮'} Playing ${f.activeGame.game}`
                              : online ? 'In the lobby' : 'Offline'}
                          </div>
                        </div>
                        {f.activeGame && (
                          <Link
                            href={f.activeGame.game === 'blackjack'
                              ? `/${f.activeGame.game}?spectate=${f.activeGame.code}`
                              : `/${f.activeGame.game}?join=${f.activeGame.code}`}
                            onClick={() => setOpen(false)}
                            style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(58,208,122,.15)', border: '1px solid rgba(58,208,122,.35)', color: '#3ad07a', fontSize: 11, fontFamily: 'var(--fs-head)', fontWeight: 700, letterSpacing: '.06em', textDecoration: 'none', textTransform: 'uppercase', flexShrink: 0 }}
                          >
                            {f.activeGame.game === 'blackjack' ? 'Watch' : 'Join'}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}
    </>
  )
}
