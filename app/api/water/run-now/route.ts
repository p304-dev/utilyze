import { getAuthUser, hasCronSecret } from '@/lib/auth'
import { runWaterCheck } from '@/lib/water/leak-engine'

// Accepts either a valid session (dashboard button) or CRON_SECRET (machine calls).
export async function POST(req: Request) {
  const authed = hasCronSecret(req) || !!(await getAuthUser())
  if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runWaterCheck()
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
