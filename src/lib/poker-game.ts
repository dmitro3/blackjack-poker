import { Card, evaluate, cmp, rankName, strength } from './poker-engine'

export const SB = 500
export const BB = 1000
const BOT_BUYIN = 120000

export interface Player {
  id: number
  name: string
  isYou: boolean
  isBot: boolean
  avatar: string
  stack: number
  hole: Card[]
  bet: number
  totalIn: number
  folded: boolean
  allIn: boolean
  acted: boolean
  lastAct: string
  sittingOut: boolean
  won: number
}

export type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handover'

export interface GameSnapshot {
  players: Player[]
  community: Card[]
  pot: number
  currentBet: number
  toAct: number
  street: Street
  button: number
  lastResult: LastResult | null
  message: string
  handNo: number
}

export interface LastResult {
  winners: number[]
  pot: number
  showdown: boolean
  hands: Record<number, { score: number[]; name: string }>
}

export interface LegalActions {
  toCall: number
  canCheck: boolean
  canCall: boolean
  canRaise: boolean
  minRaiseTo: number
  maxRaiseTo: number
  stack: number
  pot: number
  you: boolean
}

interface SeatDef { name: string; avatar: string }

export function freshDeck(): Card[] {
  const SUITS = [
    { s: '♠', c: 'black' }, { s: '♥', c: 'red' },
    { s: '♦', c: 'red' }, { s: '♣', c: 'black' }
  ]
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']
  const d: Card[] = []
  for (const suit of SUITS)
    for (const rank of RANKS)
      d.push({ rank, suit: suit.s, color: suit.c })
  return d
}

export function shuffle(d: Card[]): Card[] {
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function fmt(n: number): string { return Number(n).toLocaleString('en-US') }
export function fmtShort(n: number): string {
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M'
  if (n >= 1e3) return (n/1e3).toFixed(n%1e3===0?0:1)+'K'
  return ''+n
}

export class PokerGame {
  players: Player[]
  button: number
  community: Card[]
  pot: number
  currentBet: number
  lastRaise: number
  toAct: number
  street: Street
  deck: Card[]
  raisesThisStreet: number
  lastResult: LastResult | null
  message: string
  handNo: number
  onBankChange?: (chips: number) => void

  constructor(seats: SeatDef[], initialChips = 100000) {
    this.players = seats.map((n, i) => ({
      id: i, name: n.name, isYou: i === 0, isBot: i !== 0, avatar: n.avatar,
      stack: i === 0 ? initialChips : BOT_BUYIN,
      hole: [], bet: 0, totalIn: 0, folded: false, allIn: false,
      acted: false, lastAct: '', sittingOut: false, won: 0
    }))
    this.button = Math.floor(Math.random() * this.players.length)
    this.community = []; this.pot = 0; this.currentBet = 0; this.lastRaise = BB
    this.toAct = -1; this.street = 'idle'; this.deck = []; this.raisesThisStreet = 0
    this.lastResult = null; this.message = ''; this.handNo = 0
  }

  syncBank() {
    const you = this.players[0]
    if (this.onBankChange) this.onBankChange(you.stack)
  }

  setPlayerStack(chips: number) {
    this.players[0].stack = chips
    this.players[0].sittingOut = chips < BB
  }

  alive(): Player[] { return this.players.filter(p => !p.folded && !p.sittingOut) }
  canAct(): Player[] { return this.players.filter(p => !p.folded && !p.allIn && !p.sittingOut) }

  startHand(): void {
    this.players.forEach(p => {
      if (p.isYou) { p.sittingOut = p.stack < BB }
      else { if (p.stack < BB) p.stack = BOT_BUYIN; p.sittingOut = false }
      p.hole = []; p.bet = 0; p.totalIn = 0; p.folded = false; p.allIn = false
      p.acted = false; p.lastAct = ''; p.won = 0
    })
    if (this.alive().length < 2) { this.street = 'idle'; this.message = 'Need chips to play — refill to deal in.'; return }
    this.handNo++
    this.community = []; this.pot = 0; this.currentBet = 0; this.lastRaise = BB
    this.raisesThisStreet = 1; this.lastResult = null
    this.deck = shuffle(freshDeck())
    do { this.button = (this.button + 1) % this.players.length } while (this.players[this.button].sittingOut)
    const order = this.seatedOrderFrom(this.button + 1)
    const sb = order[0], bb = order[1 % order.length]
    this.commit(sb, Math.min(SB, sb.stack)); sb.lastAct = 'SB'
    this.commit(bb, Math.min(BB, bb.stack)); bb.lastAct = 'BB'
    this.currentBet = BB
    for (let r = 0; r < 2; r++) for (const p of order) p.hole.push(this.deck.pop()!)
    this.players.forEach(p => { p.acted = false })
    this.street = 'preflop'
    this.toAct = this.nextIndex(this.players.indexOf(bb))
    this.message = ''
    this.syncBank()
  }

  seatedOrderFrom(start: number): Player[] {
    const arr: Player[] = []
    for (let i = 0; i < this.players.length; i++) {
      const idx = (start + i) % this.players.length
      if (!this.players[idx].sittingOut) arr.push(this.players[idx])
    }
    return arr
  }

  commit(p: Player, amt: number): void {
    amt = Math.min(amt, p.stack)
    p.stack -= amt; p.bet += amt; p.totalIn += amt; this.pot += amt
    if (p.stack === 0) p.allIn = true
    if (p.isYou) this.syncBank()
  }

  needToAct(p: Player): boolean {
    return !p.folded && !p.allIn && !p.sittingOut && (!p.acted || p.bet < this.currentBet)
  }

  nextIndex(from: number): number {
    for (let i = 1; i <= this.players.length; i++) {
      const idx = (from + i) % this.players.length
      if (this.needToAct(this.players[idx])) return idx
    }
    return -1
  }

  legal(): LegalActions | null {
    const p = this.players[this.toAct]
    if (!p) return null
    const toCall = this.currentBet - p.bet
    const minRaiseTo = this.currentBet + this.lastRaise
    const maxRaiseTo = p.bet + p.stack
    return {
      toCall: Math.min(toCall, p.stack),
      canCheck: toCall === 0,
      canCall: toCall > 0,
      canRaise: p.stack > toCall,
      minRaiseTo: Math.min(minRaiseTo, maxRaiseTo),
      maxRaiseTo,
      stack: p.stack,
      pot: this.pot,
      you: p.isYou
    }
  }

  apply(type: string, amount?: number): string {
    const p = this.players[this.toAct]
    if (!p) return 'none'
    const toCall = this.currentBet - p.bet
    if (type === 'fold') { p.folded = true; p.lastAct = 'Fold' }
    else if (type === 'check') { p.lastAct = 'Check' }
    else if (type === 'call') {
      this.commit(p, toCall)
      p.lastAct = p.allIn ? 'All-in' : 'Call'
    }
    else if (type === 'raise' || type === 'allin') {
      const target = type === 'allin' ? p.bet + p.stack : (amount || 0)
      const safeTarget = Math.max(target, this.currentBet)
      const need = safeTarget - p.bet
      this.commit(p, need)
      if (p.bet > this.currentBet) {
        this.lastRaise = Math.max(this.lastRaise, p.bet - this.currentBet)
        this.currentBet = p.bet
        this.raisesThisStreet++
      }
      p.lastAct = p.allIn ? 'All-in '+fmtShort(p.bet) : (toCall > 0 ? 'Raise ' : 'Bet ')+fmtShort(p.bet)
    }
    p.acted = true
    return this.advance()
  }

  advance(): string {
    if (this.alive().length === 1) return this.awardSingle()
    const next = this.nextIndex(this.toAct)
    if (next !== -1) { this.toAct = next; return 'await' }
    if (this.canAct().length <= 1) return this.runoutAndShowdown()
    return this.dealNextStreet()
  }

  dealNextStreet(): string {
    this.players.forEach(p => { p.bet = 0; p.acted = false; p.lastAct = p.folded ? 'Fold' : '' })
    this.currentBet = 0; this.lastRaise = BB; this.raisesThisStreet = 0
    if (this.street === 'preflop') {
      this.deck.pop()
      for (let i = 0; i < 3; i++) this.community.push(this.deck.pop()!)
      this.street = 'flop'
    } else if (this.street === 'flop') {
      this.deck.pop(); this.community.push(this.deck.pop()!); this.street = 'turn'
    } else if (this.street === 'turn') {
      this.deck.pop(); this.community.push(this.deck.pop()!); this.street = 'river'
    } else if (this.street === 'river') {
      return this.showdown()
    }
    const order = this.seatedOrderFrom(this.button + 1)
    const first = order.find(p => !p.folded && !p.allIn)
    this.toAct = first ? this.players.indexOf(first) : -1
    if (this.toAct === -1) return this.runoutAndShowdown()
    return 'deal'
  }

  runoutAndShowdown(): string {
    while (this.community.length < 5) { this.deck.pop(); this.community.push(this.deck.pop()!) }
    return this.showdown()
  }

  awardSingle(): string {
    const winner = this.alive()[0]
    winner.stack += this.pot; winner.won = this.pot
    this.lastResult = { winners: [winner.id], pot: this.pot, showdown: false, hands: {} }
    this.street = 'handover'
    this.syncBank()
    const verb = winner.isYou ? 'win' : 'wins'
    this.message = winner.name + ' ' + verb + ' ' + fmt(this.pot)
    return 'win'
  }

  showdown(): string {
    this.street = 'showdown'
    const contenders = this.alive()
    const hands: Record<number, { score: number[]; name: string }> = {}
    contenders.forEach(p => {
      const sc = evaluate(p.hole.concat(this.community))
      hands[p.id] = { score: sc, name: rankName(sc) }
    })
    let bestId: number | null = null
    contenders.forEach(p => {
      if (bestId === null || cmp(hands[p.id].score, hands[bestId].score) > 0) bestId = p.id
    })
    const winners = contenders
      .filter(p => cmp(hands[p.id].score, hands[bestId!].score) === 0)
      .map(p => p.id)
    const share = Math.floor(this.pot / winners.length)
    winners.forEach(wid => { const pl = this.players[wid]; pl.stack += share; pl.won = share })
    this.lastResult = { winners, pot: this.pot, showdown: true, hands }
    this.street = 'handover'
    this.syncBank()
    const names = winners.map(id => this.players[id].name).join(' & ')
    const youWon = winners.length === 1 && winners[0] === 0
    const verb = (winners.length > 1 || youWon) ? 'win' : 'wins'
    this.message = names + ' ' + verb + ' ' + fmt(this.pot) + ' · ' + hands[winners[0]].name
    return 'showdown'
  }

  botDecision(): { type: string; amount?: number } {
    const p = this.players[this.toAct]
    const toCall = this.currentBet - p.bet
    const s = strength(p.hole, this.community) + (Math.random() * 0.16 - 0.08)
    const potOdds = toCall / (this.pot + toCall || 1)
    const L = this.legal()!
    const roundTo = (x: number) => Math.max(BB, Math.round(x / BB) * BB)

    if (toCall === 0) {
      if (s > 0.6 && this.raisesThisStreet < 3) {
        const bet = roundTo(this.pot * (0.45 + Math.random() * 0.4))
        const target = Math.min(p.bet + bet, L.maxRaiseTo)
        if (target >= L.minRaiseTo) return { type: 'raise', amount: target }
      }
      if (s > 0.5 && Math.random() < 0.35) {
        const bet2 = roundTo(this.pot * 0.4)
        const t2 = Math.min(p.bet + bet2, L.maxRaiseTo)
        if (t2 >= L.minRaiseTo) return { type: 'raise', amount: t2 }
      }
      return { type: 'check' }
    }
    if (s > 0.8 && this.raisesThisStreet < 4 && p.stack > toCall) {
      const rr = roundTo(this.currentBet + this.pot * (0.6 + Math.random() * 0.5))
      const rt = Math.min(rr, L.maxRaiseTo)
      if (rt >= L.minRaiseTo) return { type: 'raise', amount: rt }
    }
    const callOk = (s > potOdds + 0.12) || (s > 0.42 && toCall <= p.stack * 0.12)
    if (callOk) return { type: 'call' }
    if (s > 0.3 && toCall <= p.stack * 0.06 && Math.random() < 0.5) return { type: 'call' }
    return { type: 'fold' }
  }

  snapshot(): GameSnapshot {
    return {
      players: this.players,
      community: this.community,
      pot: this.pot,
      currentBet: this.currentBet,
      toAct: this.toAct,
      street: this.street,
      button: this.button,
      lastResult: this.lastResult,
      message: this.message,
      handNo: this.handNo
    }
  }
}
