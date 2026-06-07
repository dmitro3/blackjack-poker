const GAMES: Record<string, string> = {
  BJ: 'blackjack',
  PK: 'poker',
  RT: 'roulette',
  ST: 'slots',
  BA: 'baccarat',
}

const GAME_PREFIXES: Record<string, string> = {
  blackjack: 'BJ',
  poker: 'PK',
  roulette: 'RT',
  slots: 'ST',
  baccarat: 'BA',
}

// Unambiguous chars: no O, 0, I, 1, L
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateCode(game: string): string {
  const prefix = GAME_PREFIXES[game] ?? 'BJ'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return prefix + suffix
}

export function prettyCode(code: string): string {
  return code.slice(0, 4) + '-' + code.slice(4)
}

export function decodeCode(raw: string): string | null {
  const code = raw.replace(/-/g, '').toUpperCase().trim()
  if (code.length !== 8) return null
  const prefix = code.slice(0, 2)
  return GAMES[prefix] ?? null
}
