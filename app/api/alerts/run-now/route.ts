import { NextResponse } from 'next/server'
import { runAlertCheck } from '@/lib/alert-engine'
import { getAuthUser, hasCronSecret } from '@/lib/auth'

// Accepts either an authenticated admin session OR a valid CRON_SECRET Bearer token.
// This lets both the dashboard UI and external scripts trigger a manual run.
export async function POST(req: Request) {
  const authorized = hasCronSecret(req) || !!(await getAuthUser())
  if (!authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const testMode = process.env.ALERT_TEST_MODE === 'true'

  try {
    const result = await runAlertCheck(testMode)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
