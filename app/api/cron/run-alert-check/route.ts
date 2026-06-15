import { NextResponse } from 'next/server'
import { runAlertCheck } from '@/lib/alert-engine'
import { hasCronSecret } from '@/lib/auth'

// Called by Vercel Cron every 15 minutes (see vercel.json).
// Vercel automatically sends: Authorization: Bearer {CRON_SECRET}
// Rejects all other callers — there's no session cookie in a cron request.
export async function GET(req: Request) {
  if (!hasCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAlertCheck()
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Log but return 200 — Vercel retries on non-200, which could cause runaway sends
    console.error('[Cron] Alert check failed:', message)
    return NextResponse.json({ error: message }, { status: 200 })
  }
}
