import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Checks the current request's session cookie and returns the Supabase user,
// or null if no valid session exists.
// Import this in API route handlers to gate access to authenticated admins only.
export async function getAuthUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},  // read-only — API routes don't need to refresh the cookie
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Returns true if the request carries a valid CRON_SECRET Bearer token.
// Used by cron and run-now routes that need to accept machine-to-machine calls.
export function hasCronSecret(req: Request): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}
