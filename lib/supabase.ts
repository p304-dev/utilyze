import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// Uses the service_role key which bypasses Row Level Security entirely.
// Safe for an internal-only tool where all DB writes are admin-initiated.
// ONLY import this in: API route handlers, server actions, lib/alert-engine.ts
// NEVER import in client components — service_role key must never reach the browser.
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Disable session persistence — server clients are per-request, not stateful
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Uses the anon (public) key. Safe to call in browser (client) components.
// Only used for auth session management — the login page calls signInWithPassword here.
// All actual data queries go through the server client above.
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
