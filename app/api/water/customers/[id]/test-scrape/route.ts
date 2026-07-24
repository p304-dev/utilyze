import { getAuthUser } from '@/lib/auth'
import { runWaterCheck } from '@/lib/water/leak-engine'

// Runs scrape + detection for ONE customer, always in test mode.
// Bypasses check_time — usable at any hour to verify credentials and selectors.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await runWaterCheck(true, params.id)
    return Response.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
