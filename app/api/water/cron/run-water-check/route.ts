import { hasCronSecret } from '@/lib/auth'
import { runWaterCheck } from '@/lib/water/leak-engine'

// Triggered hourly by Vercel cron (see vercel.json).
// Inside runWaterCheck, each customer is only processed when the current local
// hour matches their check_time preference — so each customer runs once per day.
// Returns 200 even on error to prevent Vercel from retrying and causing duplicate scrapes.
export async function GET(req: Request) {
  if (!hasCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWaterCheck()
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WaterCron] Unhandled error:', message)
    return Response.json({ error: message }, { status: 200 })
  }
}
