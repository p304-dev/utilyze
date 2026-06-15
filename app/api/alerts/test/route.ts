import { NextResponse } from 'next/server'
import { runAlertCheck } from '@/lib/alert-engine'
import { getAuthUser } from '@/lib/auth'

// Runs the alert check for a single location, always in test mode.
// Body: { location_id: string }
export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { location_id } = body

  if (!location_id) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  try {
    // Force test mode = true regardless of ALERT_TEST_MODE env var
    const result = await runAlertCheck(true, location_id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
