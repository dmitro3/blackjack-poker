'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export default function HeartbeatProvider() {
  useEffect(() => {
    const supabase = createClient()

    const ping = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
    }

    ping()
    const id = setInterval(ping, 60000)
    return () => clearInterval(id)
  }, [])

  return null
}
