import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

const DEFAULT_HOURS = (customerId: string) =>
  Array.from({ length: 7 }, (_, i) => ({
    water_customer_id: customerId,
    day_of_week: i,
    is_open: i >= 1 && i <= 5,
    open_time: i >= 1 && i <= 5 ? '08:00:00' : null,
    close_time: i >= 1 && i <= 5 ? '17:00:00' : null,
  }))

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('water_business_hours')
    .select('*')
    .eq('water_customer_id', params.id)
    .order('day_of_week', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Return defaults for all 7 days if none are stored yet
  if (!data || data.length < 7) return Response.json(DEFAULT_HOURS(params.id))
  return Response.json(data)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const hours: Array<{
    day_of_week: number
    is_open: boolean
    open_time: string | null
    close_time: string | null
  }> = await req.json()

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('water_business_hours')
    .upsert(
      hours.map(h => ({ ...h, water_customer_id: params.id })),
      { onConflict: 'water_customer_id,day_of_week' }
    )
    .select('*')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
