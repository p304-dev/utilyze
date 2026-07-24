import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { encrypt } from '@/lib/water/crypto'

const SAFE_COLS =
  'id, business_id, business_name, city, state, utility_provider, utility_username, ' +
  'meter_id, move_in_date, phone_number, timezone, check_time, active, created_at'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('water_customers')
    .select(SAFE_COLS)
    .eq('id', params.id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { password, ...rest } = body

  const supabase = createServerSupabaseClient()

  // Only update the encrypted password if a new one was explicitly provided
  const updatePayload = password
    ? { ...rest, utility_password_encrypted: encrypt(password) }
    : rest

  const { data, error } = await supabase
    .from('water_customers')
    .update(updatePayload)
    .eq('id', params.id)
    .select(SAFE_COLS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('water_customers').delete().eq('id', params.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
