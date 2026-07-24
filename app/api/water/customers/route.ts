import { createServerSupabaseClient } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth'
import { encrypt } from '@/lib/water/crypto'

// Never select the encrypted password — only these columns go to the client
const SAFE_COLS =
  'id, business_id, business_name, city, state, utility_provider, utility_username, ' +
  'meter_id, move_in_date, phone_number, timezone, check_time, active, created_at'

export async function GET() {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerSupabaseClient()

  const { data: customers, error } = await supabase
    .from('water_customers')
    .select(SAFE_COLS)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Attach latest scrape run status to each customer
  const { data: scrapeRuns } = await supabase
    .from('water_scrape_runs')
    .select('water_customer_id, status, started_at, finished_at, error_message')
    .order('started_at', { ascending: false })

  type ScrapeRunRow = { water_customer_id: string; status: string; started_at: string; finished_at: string | null; error_message: string | null }
  const latestByCustomer = new Map<string, ScrapeRunRow>()
  for (const run of scrapeRuns ?? []) {
    if (!latestByCustomer.has(run.water_customer_id)) {
      latestByCustomer.set(run.water_customer_id, run)
    }
  }

  const enriched = (customers ?? []).map(c => ({
    ...c,
    latest_scrape: latestByCustomer.get(c.id) ?? null,
  }))

  return Response.json(enriched)
}

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { password, ...rest } = body

  if (!password) return Response.json({ error: 'password is required' }, { status: 400 })

  const supabase = createServerSupabaseClient()

  const { data: customer, error } = await supabase
    .from('water_customers')
    .insert({ ...rest, utility_password_encrypted: encrypt(password) })
    .select(SAFE_COLS)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Create default alert settings
  await supabase.from('water_alert_settings').insert({
    water_customer_id: customer.id,
    after_hours_enabled: true,
    min_after_hours_gallons: 50,
    continuous_flow_enabled: true,
    continuous_flow_min_hourly_gallons: 0.1,
  })

  // Create default business hours (Mon–Fri open 8am–5pm, weekends closed)
  await supabase.from('water_business_hours').insert(
    Array.from({ length: 7 }, (_, i) => ({
      water_customer_id: customer.id,
      day_of_week: i,
      is_open: i >= 1 && i <= 5,
      open_time: i >= 1 && i <= 5 ? '08:00:00' : null,
      close_time: i >= 1 && i <= 5 ? '17:00:00' : null,
    }))
  )

  return Response.json(customer, { status: 201 })
}
