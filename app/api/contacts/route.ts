import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('business_id')
  const locationId = searchParams.get('location_id')

  const db = createServerSupabaseClient()
  let query = db
    .from('contacts')
    .select('*, businesses(business_name), locations(location_name)')
    .order('created_at', { ascending: false })

  if (businessId) query = query.eq('business_id', businessId)
  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const db = createServerSupabaseClient()
  const { data, error } = await db
    .from('contacts')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
