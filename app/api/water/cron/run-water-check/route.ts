import { hasCronSecret } from '@/lib/auth'
import { runWaterCheck } from '@/lib/water/leak-engine'

// Triggered hourly by cron-job.org.
// Scrapes all active customers every run and fires SMS immediately when an
// after-hours threshold is crossed. Idempotency keys prevent duplicate alerts.
// Returns 200 even on error to prevent the cron service from retrying.
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
