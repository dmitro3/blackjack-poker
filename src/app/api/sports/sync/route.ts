import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { adjustBalance, logGameSession } from '@/lib/bank'

const API_KEY = process.env.ODDS_API_KEY
const BASE = 'https://api.the-odds-api.com/v4'

// Standard h2h sports — two teams/players, one winner
const SPORTS = [
  { key: 'basketball_nba',            sport: 'nba',    label: 'NBA',                   hasDraw: false },
  { key: 'americanfootball_nfl',      sport: 'nfl',    label: 'NFL',                   hasDraw: false },
  { key: 'baseball_mlb',              sport: 'mlb',    label: 'MLB',                   hasDraw: false },
  { key: 'icehockey_nhl',             sport: 'nhl',    label: 'NHL',                   hasDraw: false },
  { key: 'soccer_fifa_world_cup',      sport: 'soccer', label: 'FIFA World Cup',        hasDraw: true  },
  { key: 'soccer_epl',                sport: 'soccer', label: 'EPL',                   hasDraw: true  },
  { key: 'soccer_spain_la_liga',      sport: 'soccer', label: 'La Liga',               hasDraw: true  },
  { key: 'soccer_uefa_champs_league', sport: 'soccer', label: 'Champions League',      hasDraw: true  },
  { key: 'soccer_usa_mls',            sport: 'soccer', label: 'MLS',                   hasDraw: true  },
  { key: 'mma_mixed_martial_arts',    sport: 'ufc',    label: 'UFC',                   hasDraw: false },
  // Tennis grand slams — player vs player, same h2h format
  { key: 'tennis_atp_french_open',    sport: 'tennis', label: 'French Open (ATP)',     hasDraw: false },
  { key: 'tennis_wta_french_open',    sport: 'tennis', label: 'French Open (WTA)',     hasDraw: false },
  { key: 'tennis_wimbledon',          sport: 'tennis', label: 'Wimbledon (ATP)',        hasDraw: false },
  { key: 'tennis_wta_wimbledon',      sport: 'tennis', label: 'Wimbledon (WTA)',        hasDraw: false },
  { key: 'tennis_us_open',            sport: 'tennis', label: 'US Open (ATP)',          hasDraw: false },
  { key: 'tennis_wta_us_open',        sport: 'tennis', label: 'US Open (WTA)',          hasDraw: false },
  { key: 'tennis_atp_aus_open',       sport: 'tennis', label: 'Australian Open (ATP)', hasDraw: false },
  { key: 'tennis_wta_aus_open',       sport: 'tennis', label: 'Australian Open (WTA)', hasDraw: false },
]

// Golf — tournament outright winner, top players as options
const GOLF_KEYS = [
  'golf_masters_tournament_winner',
  'golf_pga_championship_winner',
  'golf_us_open_winner',
  'golf_the_open_championship_winner',
  'golf_pga_tour_winner',
]

// F1 — race winner outright
const F1_KEY = 'motorsport_formula_one'

function teamId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)
}

// Handles numeric scores (NBA, NFL…) and tennis set scores ("6-4, 7-5")
function detectWinner(scores: { name: string; score: string }[]): string | 'draw' | null {
  if (scores.length < 2) return null
  const [s0, s1] = scores

  // Tennis: score strings contain "-" like "6-4, 7-5"
  if (s0.score.includes('-')) {
    const setsWon = (str: string) =>
      str.split(/[, ]+/)
        .filter(s => /^\d+-\d+(\(\d+\))?$/.test(s))
        .filter(s => {
          const [a, b] = s.split('-').map(Number)
          return a > b
        }).length
    const w0 = setsWon(s0.score), w1 = setsWon(s1.score)
    if (w0 > w1) return s0.name
    if (w1 > w0) return s1.name
    return null
  }

  // Numeric: basketball, football, etc.
  const n0 = parseFloat(s0.score), n1 = parseFloat(s1.score)
  if (isNaN(n0) || isNaN(n1)) return null
  if (n0 > n1) return s0.name
  if (n1 > n0) return s1.name
  return 'draw'
}

async function runSync() {
  if (!API_KEY) return { error: 'ODDS_API_KEY not configured' }

  const admin = createAdminClient()
  let created = 0, settled = 0
  const errors: string[] = []
  const now = new Date()
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  // ── Standard h2h sports ──────────────────────────────────────────────────────
  for (const sport of SPORTS) {
    try {
      const oddsRes = await fetch(
        `${BASE}/sports/${sport.key}/odds?apiKey=${API_KEY}&regions=us&markets=h2h&bookmakers=draftkings`,
        { cache: 'no-store' }
      )
      if (oddsRes.ok) {
        const events: OddsEvent[] = await oddsRes.json()
        for (const ev of Array.isArray(events) ? events : []) {
          const start = new Date(ev.commence_time)
          if (start <= now || start > twoWeeks) continue

          const oddsId = `odds:${ev.id}`
          const { data: existing } = await admin.from('sports_events').select('id').eq('description', oddsId).maybeSingle()
          if (existing) continue

          const options = sport.hasDraw
            ? [
                { id: teamId(ev.home_team), label: `${ev.home_team} Win` },
                { id: 'draw',               label: 'Draw' },
                { id: teamId(ev.away_team), label: `${ev.away_team} Win` },
              ]
            : [
                { id: teamId(ev.home_team), label: `${ev.home_team} Win` },
                { id: teamId(ev.away_team), label: `${ev.away_team} Win` },
              ]

          await admin.from('sports_events').insert({
            sport: sport.sport, title: `${ev.away_team} @ ${ev.home_team}`,
            description: oddsId, options,
            closes_at: ev.commence_time, event_date: ev.commence_time, status: 'open',
          })
          created++
        }
      }

      // Auto-settle completed games
      const scoresRes = await fetch(
        `${BASE}/sports/${sport.key}/scores?apiKey=${API_KEY}&daysFrom=7`,
        { cache: 'no-store' }
      )
      if (scoresRes.ok) {
        const scores: ScoreEvent[] = await scoresRes.json()
        for (const sc of Array.isArray(scores) ? scores : []) {
          if (!sc.completed || !sc.scores || sc.scores.length < 2) continue

          const oddsId = `odds:${sc.id}`
          const { data: ourEvent } = await admin.from('sports_events')
            .select('id, options, status').eq('description', oddsId).in('status', ['open', 'closed']).maybeSingle()
          if (!ourEvent) continue

          const result = detectWinner(sc.scores)
          if (!result) continue

          let winnerOptionId: string | null = null
          if (result === 'draw') {
            winnerOptionId = ourEvent.options.find((o: { id: string }) => o.id === 'draw')?.id ?? null
          } else {
            const wid = teamId(result)
            winnerOptionId = ourEvent.options.find((o: { id: string }) => o.id === wid)?.id ?? null
            if (!winnerOptionId) {
              const last = result.split(' ').pop()!.toLowerCase()
              winnerOptionId = ourEvent.options.find((o: { label: string }) => o.label.toLowerCase().includes(last))?.id ?? null
            }
          }
          if (!winnerOptionId) continue

          const { data: bets } = await admin.from('sports_bets')
            .select('id, user_id, option_id, chips_wagered').eq('event_id', ourEvent.id).eq('settled', false)
          for (const bet of bets ?? []) {
            const won = bet.option_id === winnerOptionId
            const chips_won = won ? bet.chips_wagered * 2 : 0
            try {
              if (won) await adjustBalance(bet.user_id, chips_won)
              await logGameSession(bet.user_id, 'sports', bet.chips_wagered, chips_won)
              await admin.from('sports_bets').update({ settled: true, won, chips_won }).eq('id', bet.id)
              settled++
            } catch (err) {
              errors.push(`bet ${bet.id}: ${err instanceof Error ? err.message : String(err)}`)
            }
          }
          await admin.from('sports_events').update({ status: 'settled', result_option_id: winnerOptionId }).eq('id', ourEvent.id)
        }
      }
    } catch (e: unknown) {
      errors.push(`${sport.label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Golf — outright tournament winner, top players as options ────────────────
  for (const golfKey of GOLF_KEYS) {
    try {
      const res = await fetch(
        `${BASE}/sports/${golfKey}/odds?apiKey=${API_KEY}&regions=us&markets=outrights&bookmakers=draftkings`,
        { cache: 'no-store' }
      )
      if (!res.ok) continue
      const events: GolfEvent[] = await res.json()

      for (const ev of Array.isArray(events) ? events : []) {
        const start = new Date(ev.commence_time)
        if (start <= now) continue  // golf tournament already started

        const oddsId = `odds:${ev.id}`
        const { data: existing } = await admin.from('sports_events').select('id').eq('description', oddsId).maybeSingle()
        if (existing) continue

        // Pull players from first bookmaker's outright outcomes
        const outcomes: { name: string; price: number }[] =
          ev.bookmakers?.[0]?.markets?.[0]?.outcomes ?? []
        if (outcomes.length < 2) continue

        // Sort by favouritism: most negative (biggest favourite) first, then ascending positive
        const sorted = [...outcomes].sort((a, b) => {
          if (a.price < 0 && b.price >= 0) return -1
          if (a.price >= 0 && b.price < 0) return 1
          return a.price - b.price
        })

        // Take top 4 players as betting options
        const top = sorted.slice(0, 4)
        const options = top.map(p => ({ id: teamId(p.name), label: p.name }))

        // Clean up title: "Golf Masters Tournament Winner" → "Masters – Pick the winner"
        const title = ev.sport_title
          .replace(/\s*Winner$/i, '')
          .replace(/^Golf\s+/i, '')
          .trim() + ' – Pick the winner'

        await admin.from('sports_events').insert({
          sport: 'pga', title, description: oddsId, options,
          closes_at: ev.commence_time, event_date: ev.commence_time, status: 'open',
        })
        created++
      }
    } catch (e: unknown) {
      errors.push(`Golf (${golfKey}): ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── F1 — race winner outright ─────────────────────────────────────────────────
  try {
    const res = await fetch(
      `${BASE}/sports/${F1_KEY}/odds?apiKey=${API_KEY}&regions=us&markets=outrights&bookmakers=draftkings`,
      { cache: 'no-store' }
    )
    if (res.ok) {
      const events: GolfEvent[] = await res.json()
      for (const ev of Array.isArray(events) ? events : []) {
        const start = new Date(ev.commence_time)
        if (start <= now) continue

        const oddsId = `odds:${ev.id}`
        const { data: existing } = await admin.from('sports_events').select('id').eq('description', oddsId).maybeSingle()
        if (existing) continue

        const outcomes: { name: string; price: number }[] =
          ev.bookmakers?.[0]?.markets?.[0]?.outcomes ?? []
        if (outcomes.length < 2) continue

        const sorted = [...outcomes].sort((a, b) => {
          if (a.price < 0 && b.price >= 0) return -1
          if (a.price >= 0 && b.price < 0) return 1
          return a.price - b.price
        })

        const options = sorted.slice(0, 6).map(p => ({ id: teamId(p.name), label: p.name }))

        const title = ev.sport_title
          .replace(/\s*Winner$/i, '')
          .replace(/^Formula One\s*/i, 'F1 ')
          .trim() + ' – Pick the winner'

        await admin.from('sports_events').insert({
          sport: 'f1', title, description: oddsId, options,
          closes_at: ev.commence_time, event_date: ev.commence_time, status: 'open',
        })
        created++
      }
    }
  } catch (e: unknown) {
    errors.push(`F1: ${e instanceof Error ? e.message : String(e)}`)
  }

  return { created, settled, errors, timestamp: new Date().toISOString() }
}

// Vercel cron → GET; admin manual trigger → POST
export async function GET(request: Request) {
  const cron = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cron || auth !== `Bearer ${cron}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await runSync())
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await runSync())
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OddsEvent {
  id: string; commence_time: string; home_team: string; away_team: string
}
interface ScoreEvent {
  id: string; completed: boolean; scores: { name: string; score: string }[] | null
}
interface GolfEvent {
  id: string; commence_time: string; sport_title: string
  bookmakers?: { markets?: { outcomes?: { name: string; price: number }[] }[] }[]
}
