import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const customerId = searchParams.get('customer_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const limit = parseInt(searchParams.get('limit') ?? '100')

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('water_alerts')
    .select('*, water_customers(business_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') query = query.eq('status', status)
  if (customerId) query = query.eq('water_customer_id', customerId)
  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate + 'T23:59:59')

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
