'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface BetaContextValue {
  featureMap: Record<string, 'beta' | 'public'>
  hasBetaAccess: boolean
  isLoaded: boolean
  canSee: (key: string, opts?: { defaultVisible?: boolean }) => boolean
}

const BetaContext = createContext<BetaContextValue>({
  featureMap: {},
  hasBetaAccess: false,
  isLoaded: false,
  canSee: () => true,
})

export function useBeta() {
  return useContext(BetaContext)
}

export default function BetaProvider({ children }: { children: React.ReactNode }) {
  const [featureMap, setFeatureMap] = useState<Record<string, 'beta' | 'public'>>({})
  const [hasBetaAccess, setHasBetaAccess] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/beta/flags')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setFeatureMap(d.featureMap || {})
          setHasBetaAccess(d.hasBetaAccess || false)
        }
        setIsLoaded(true)
      })
      .catch(() => setIsLoaded(true))
  }, [])

  function canSee(key: string, opts?: { defaultVisible?: boolean }): boolean {
    const defaultVisible = opts?.defaultVisible ?? true
    const status = featureMap[key]
    if (status === undefined) return defaultVisible
    if (status === 'public') return true
    return hasBetaAccess
  }

  return (
    <BetaContext.Provider value={{ featureMap, hasBetaAccess, isLoaded, canSee }}>
      {children}
    </BetaContext.Provider>
  )
}
