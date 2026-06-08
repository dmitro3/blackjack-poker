import { createAdminClient } from './supabase-server'

export async function getBalance(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('chips')
    .eq('id', userId)
    .single()
  if (error || !data) return 0
  return data.chips
}

export async function setBalance(userId: string, chips: number): Promise<number> {
  const supabase = createAdminClient()
  chips = Math.max(0, Math.round(chips))
  const { data, error } = await supabase
    .from('profiles')
    .update({ chips })
    .eq('id', userId)
    .select('chips')
    .single()
  if (error || !data) throw new Error('Failed to set balance')
  return data.chips
}

export async function adjustBalance(userId: string, delta: number): Promise<number> {
  const supabase = createAdminClient()
  const current = await getBalance(userId)
  return setBalance(userId, current + delta)
}

export async function logGameSession(
  userId: string,
  game: string,
  chipsWagered: number,
  chipsWon: number
): Promise<void> {
  const supabase = createAdminClient()
  const net = chipsWon - chipsWagered

  await supabase.from('game_sessions').insert({
    user_id: userId,
    game,
    chips_wagered: chipsWagered,
    chips_won: chipsWon,
    net,
  })

  // Update profile totals
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_wagered, total_won')
    .eq('id', userId)
    .single()

  if (profile) {
    await supabase
      .from('profiles')
      .update({
        total_wagered: (profile.total_wagered || 0) + chipsWagered,
        total_won: (profile.total_won || 0) + chipsWon,
        last_login: new Date().toISOString(),
      })
      .eq('id', userId)
  }
}

export function fmt(n: number): string {
  return Number(n).toLocaleString('en-US')
}

export function fmtShort(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1) + 'K'
  return '' + n
}
