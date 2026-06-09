// Poker hand evaluator and AI

const VAL: Record<string, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14
}
const CAT_NAMES = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush']

export interface Card { rank: string; suit: string; color: string }

function straightHigh(vals: number[]): number {
  const s: Record<number, number> = {}
  vals.forEach(v => { s[v] = 1 })
  if (s[14]) s[1] = 1
  let run = 0, high = 0
  for (let v = 14; v >= 1; v--) {
    if (s[v]) { run++; if (run >= 5 && high === 0) high = v + 4 }
    else run = 0
  }
  return high
}

export function evaluate(cards: Card[]): number[] {
  const vals = cards.map(c => VAL[c.rank])
  const bySuit: Record<string, number[]> = {}
  cards.forEach(c => { (bySuit[c.suit] = bySuit[c.suit] || []).push(VAL[c.rank]) })
  const counts: Record<number, number> = {}
  vals.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  const uniqDesc = Object.keys(counts).map(Number).sort((a, b) => b - a)

  let flushSuit: string | null = null
  Object.keys(bySuit).forEach(s => { if (bySuit[s].length >= 5) flushSuit = s })

  if (flushSuit) {
    const sfHigh = straightHigh(bySuit[flushSuit])
    if (sfHigh) return [8, sfHigh]
  }

  const quad = uniqDesc.find(v => counts[v] === 4)
  if (quad !== undefined) {
    const k = uniqDesc.filter(v => v !== quad)[0]
    return [7, quad, k]
  }

  const trips = uniqDesc.filter(v => counts[v] === 3)
  const pairs = uniqDesc.filter(v => counts[v] === 2)
  if (trips.length >= 1 && (trips.length >= 2 || pairs.length >= 1)) {
    const t = trips[0], p = trips.length >= 2 ? trips[1] : pairs[0]
    return [6, t, p]
  }

  if (flushSuit) {
    const f = bySuit[flushSuit].slice().sort((a, b) => b - a).slice(0, 5)
    return [5, ...f]
  }

  const sh = straightHigh(vals)
  if (sh) return [4, sh]

  if (trips.length) {
    const tk = uniqDesc.filter(v => v !== trips[0]).slice(0, 2)
    return [3, trips[0], ...tk]
  }

  if (pairs.length >= 2) {
    const kk = uniqDesc.filter(v => v !== pairs[0] && v !== pairs[1])[0]
    return [2, pairs[0], pairs[1], kk]
  }

  if (pairs.length === 1) {
    const pk = uniqDesc.filter(v => v !== pairs[0]).slice(0, 3)
    return [1, pairs[0], ...pk]
  }

  return [0, ...uniqDesc.slice(0, 5)]
}

export function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0
    if (x !== y) return x - y
  }
  return 0
}

export function rankName(score: number[]): string {
  return CAT_NAMES[score[0]]
}

function preflopStrength(hole: Card[]): number {
  const a = VAL[hole[0].rank], b = VAL[hole[1].rank]
  const hi = Math.max(a, b), lo = Math.min(a, b)
  const suited = hole[0].suit === hole[1].suit
  let s = 0
  if (a === b) s = 0.5 + (hi / 14) * 0.45
  else { s = (hi / 14) * 0.34 + (lo / 14) * 0.16; if (suited) s += 0.08; if (hi - lo <= 2) s += 0.06 }
  return Math.max(0, Math.min(1, s))
}

function postStrength(hole: Card[], board: Card[]): number {
  const sc = evaluate(hole.concat(board))
  const base = sc[0] / 8
  return Math.max(0, Math.min(1, base + (sc[1] || 0) / 200))
}

export function strength(hole: Card[], board: Card[]): number {
  return board.length === 0 ? preflopStrength(hole) : postStrength(hole, board)
}

// Classify preflop hand: 1=premium, 2=strong, 3=playable, 4=marginal, 5=trash
export function preflopTier(hole: Card[]): number {
  const a = VAL[hole[0].rank], b = VAL[hole[1].rank]
  const hi = Math.max(a, b), lo = Math.min(a, b)
  const suited = hole[0].suit === hole[1].suit
  const paired = a === b
  if (paired && hi >= 12) return 1               // QQ+
  if (hi === 14 && lo === 13) return 1           // AK
  if (paired && hi >= 9) return 2                // 99-JJ
  if (hi === 14 && lo >= 11) return 2            // AQ, AJ
  if (hi === 13 && lo >= 11 && suited) return 2  // KQs, KJs
  if (hi === 14 && lo >= 9 && suited) return 2   // ATs+
  if (paired && hi >= 5) return 3                // 55-88
  if (hi === 14 && lo >= 7) return 3             // A7+
  if (hi >= 13 && lo >= 10) return 3             // KQ, KJ, QJ
  if (suited && hi - lo <= 2 && hi >= 8) return 3 // suited connectors 8-high+
  if (paired) return 4                           // 22-44
  if (hi === 14) return 4                        // A low
  if (suited && hi - lo <= 3 && hi >= 6) return 4 // weak suited connectors
  if (hi >= 10 && lo >= 8 && hi - lo <= 3) return 4 // offsuit connectors
  return 5
}

// Estimate bonus equity from flush/straight draws (0 to ~0.3)
export function drawEquity(hole: Card[], board: Card[]): number {
  if (board.length === 0 || board.length >= 5) return 0
  const all = hole.concat(board)
  const suits: Record<string, number> = {}
  const valSet: Set<number> = new Set()
  all.forEach(c => {
    suits[c.suit] = (suits[c.suit] || 0) + 1
    valSet.add(VAL[c.rank])
  })
  if (valSet.has(14)) valSet.add(1)
  const streetsLeft = board.length <= 3 ? 2 : 1
  let bonus = 0
  // Flush draw
  if (Math.max(...Object.values(suits)) === 4) bonus += streetsLeft === 2 ? 0.21 : 0.16
  // Straight draw
  const sorted = [...valSet].sort((a, b) => a - b)
  let best = 1, run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) { run++; best = Math.max(best, run) }
    else run = 1
  }
  if (best >= 4) bonus += streetsLeft === 2 ? 0.18 : 0.14       // open-ender
  else if (best === 3) bonus += streetsLeft === 2 ? 0.09 : 0.05  // gutshot
  return Math.min(bonus, 0.32)
}
