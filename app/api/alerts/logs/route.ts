import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const businessId = searchParams.get('business_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const limit = parseInt(searchParams.get('limit') ?? '100', 10)

  const db = createServerSupabaseClient()
  let query = db
    .from('alert_logs')
    .select(`
      *,
      businesses(business_name),
      locations(location_name),
      contacts(phone_number),
      utility_rate_rules(program_name)
    `)
    .order('triggered_at', { ascending: false })
    .limit(limit)

  if (status && status !== 'all') query = query.eq('status', status)
  if (businessId) query = query.eq('business_id', businessId)
  if (startDate) query = query.gte('triggered_at', startDate)
  if (endDate) query = query.lte('triggered_at', endDate)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
