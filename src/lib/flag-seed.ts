import { createAdminClient } from './supabase-server'

const SEED_FLAGS = [
  { key: 'vibrant-lobby', name: 'Vibrant Lobby Redesign', status: 'beta' },
]

export async function seedFlags() {
  try {
    const admin = createAdminClient()
    await admin.from('feature_flags').upsert(SEED_FLAGS, { onConflict: 'key', ignoreDuplicates: true })
  } catch {}
}
