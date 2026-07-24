import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

const DEFAULT_SETTINGS = (customerId: string) => ({
  water_customer_id: customerId,
  after_hours_enabled: true,
  min_after_hours_gallons: 50,
  continuous_flow_enabled: true,
  continuous_flow_min_hourly_gallons: 0.1,
})

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('water_alert_settings')
    .select('*')
    .eq('water_customer_id', params.id)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? DEFAULT_SETTINGS(params.id))
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('water_alert_settings')
    .upsert({ ...body, water_customer_id: params.id }, { onConflict: 'water_customer_id' })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
