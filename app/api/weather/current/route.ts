import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getCurrentTemperatureF } from '@/lib/weather'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const locationId = searchParams.get('location_id')

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  const db = createServerSupabaseClient()
  const { data: location, error } = await db
    .from('locations')
    .select('id, location_name, city, state, latitude, longitude')
    .eq('id', locationId)
    .single()

  if (error || !location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  if (!location.latitude || !location.longitude) {
    return NextResponse.json({ error: 'Location has no coordinates' }, { status: 422 })
  }

  try {
    const temperature_f = await getCurrentTemperatureF(location.latitude, location.longitude)
    return NextResponse.json({ temperature_f, location })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
