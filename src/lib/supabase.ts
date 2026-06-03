// Re-export for backward compatibility
// Client-safe (browser) export
export { createClient } from './supabase-client'

// Server-only exports — only use in server components, route handlers, and proxy
// These are NOT exported here to avoid client bundle pollution
// Import directly from '@/lib/supabase-server' when needed in server contexts
