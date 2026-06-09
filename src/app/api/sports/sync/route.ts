import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase-server'
import { adjustBalance, logGameSession } from '@/lib/bank'

const API_KEY = process.env.ODDS_API_KEY
const BASE = 'https://api.the-odds-api.com/v4'

const SPORTS = [
  { key: 'basketball_nba',             sport: 'nba',    label: 'NBA',              hasDraw: false },
  { key: 'americanfootball_nfl',       sport: 'nfl',    label: 'NFL',              hasDraw: false },
  { key: 'baseball_mlb',               sport: 'mlb',    label: 'MLB',              hasDraw: false },
  { key: 'icehockey_nhl',              sport: 'nhl',    label: 'NHL',              hasDraw: false },
  { key: 'soccer_epl',                 sport: 'soccer', label: 'EPL',              hasDraw: true  },
  { key: 'soccer_spain_la_liga',       sport: 'soccer', label: 'La Liga',          hasDraw: true  },
  { key: 'soccer_uefa_champs_league',  sport: 'soccer', label: 'Champions League', hasDraw: true  },
  { key: 'soccer_usa_mls',             sport: 'soccer', label: 'MLS',              hasDraw: true  },
  { key: 'mma_mixed_martial_arts',     sport: 'ufc',    label: 'UFC',              hasDraw: false },
]

function teamId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30)
}

async function runSync() {
  if (!API_KEY) return { error: 'ODDS_API_KEY not configured' }

  const admin = createAdminClient()
  let created = 0, settled = 0
  const errors: string[] = []
  const now = new Date()
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  for (const sport of SPORTS) {
    try {
      // ── Fetch upcoming events ────────────────────────────────────────────────
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
          const { data: existing } = await admin
            .from('sports_events')
            .select('id')
            .eq('description', oddsId)
            .maybeSingle()

          if (!existing) {
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
              sport:      sport.sport,
              title:      `${ev.away_team} @ ${ev.home_team}`,
              description: oddsId,
              options,
              closes_at:  ev.commence_time,
              event_date: ev.commence_time,
              status:     'open',
            })
            created++
          }
        }
      }

      // ── Fetch scores for auto-settle ─────────────────────────────────────────
      const scoresRes = await fetch(
        `${BASE}/sports/${sport.key}/scores?apiKey=${API_KEY}&daysFrom=7`,
        { cache: 'no-store' }
      )
      if (scoresRes.ok) {
        const scores: ScoreEvent[] = await scoresRes.json()
        for (const sc of Array.isArray(scores) ? scores : []) {
          if (!sc.completed || !sc.scores || sc.scores.length < 2) continue

          const oddsId = `odds:${sc.id}`
          const { data: ourEvent } = await admin
            .from('sports_events')
            .select('id, options, status')
            .eq('description', oddsId)
            .in('status', ['open', 'closed'])
            .maybeSingle()

          if (!ourEvent) continue

          // Work out who won
          const s0 = parseFloat(sc.scores[0].score)
          const s1 = parseFloat(sc.scores[1].score)
          let winnerOptionId: string | null = null

          if (!isNaN(s0) && !isNaN(s1)) {
            if (s0 === s1) {
              // Draw
              winnerOptionId = ourEvent.options.find((o: { id: string }) => o.id === 'draw')?.id ?? null
            } else {
              const winnerName = s0 > s1 ? sc.scores[0].name : sc.scores[1].name
              const wid = teamId(winnerName)
              winnerOptionId = ourEvent.options.find((o: { id: string }) => o.id === wid)?.id ?? null
              // Fallback: partial label match
              if (!winnerOptionId) {
                const last = winnerName.split(' ').pop()!.toLowerCase()
                winnerOptionId = ourEvent.options.find((o: { label: string }) =>
                  o.label.toLowerCase().includes(last)
                )?.id ?? null
              }
            }
          }

          if (!winnerOptionId) continue

          // Settle all bets for this event
          const { data: bets } = await admin
            .from('sports_bets')
            .select('id, user_id, option_id, chips_wagered')
            .eq('event_id', ourEvent.id)
            .eq('settled', false)

          for (const bet of bets ?? []) {
            const won = bet.option_id === winnerOptionId
            const chips_won = won ? bet.chips_wagered * 2 : 0
            if (won) await adjustBalance(bet.user_id, chips_won)
            await logGameSession(bet.user_id, 'sports', bet.chips_wagered, chips_won)
            await admin.from('sports_bets').update({ settled: true, won, chips_won }).eq('id', bet.id)
            settled++
          }

          await admin.from('sports_events')
            .update({ status: 'settled', result_option_id: winnerOptionId })
            .eq('id', ourEvent.id)
        }
      }
    } catch (e: unknown) {
      errors.push(`${sport.label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { created, settled, errors, timestamp: new Date().toISOString() }
}

// Vercel cron hits GET; admin manual trigger hits POST
export async function GET(request: Request) {
  const cron = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!cron || auth !== `Bearer ${cron}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runSync()
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const result = await runSync()
  return NextResponse.json(result)
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OddsEvent {
  id: string
  commence_time: string
  home_team: string
  away_team: string
}
interface ScoreEvent {
  id: string
  completed: boolean
  scores: { name: string; score: string }[] | null
}
