import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get('days') ?? '2')

  const supabase = createServerSupabaseClient()

  // Get usage records for the last N days, ordered chronologically
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('water_usage_records')
    .select('usage_date, hour, gallons, retrieved_at')
    .eq('water_customer_id', params.id)
    .gte('usage_date', cutoffStr)
    .order('usage_date', { ascending: true })
    .order('hour', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
