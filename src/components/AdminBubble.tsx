'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { usePathname } from 'next/navigation'

export default function AdminBubble() {
  const [isAdmin, setIsAdmin] = useState(false)
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (data?.is_admin) setIsAdmin(true)
    }
    check()
  }, [])

  if (!isAdmin || pathname.startsWith('/admin') || pathname.startsWith('/login')) return null

  return (
    <Link href="/admin" style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 999,
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '10px 18px 10px 12px',
      borderRadius: 999,
      background: 'linear-gradient(180deg, rgba(36,31,21,.97), rgba(11,10,7,.99))',
      border: '1px solid rgba(217,182,90,.5)',
      boxShadow: '0 8px 28px rgba(0,0,0,.6), 0 0 0 1px rgba(217,182,90,.15)',
      textDecoration: 'none',
      transition: 'transform .15s, box-shadow .15s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'
      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 14px 36px rgba(0,0,0,.7), 0 0 0 1px rgba(217,182,90,.3)'
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = ''
      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,.6), 0 0 0 1px rgba(217,182,90,.15)'
    }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--gold-grad)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
      }}>⚙</div>
      <span style={{
        fontFamily: 'var(--fs-head)', fontWeight: 700, fontSize: 12,
        letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-l)',
      }}>Admin</span>
    </Link>
  )
}
