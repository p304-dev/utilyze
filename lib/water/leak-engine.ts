import { createServerSupabaseClient } from '@/lib/supabase'
import { sendSms } from '@/lib/sms'
import { decrypt } from '@/lib/water/crypto'
import { SawsProvider } from '@/lib/water/saws-provider'
import type { WaterUtilityProvider } from '@/lib/water/provider'
import type { WaterCustomer, WaterBusinessHours, WaterAlertSettings, WaterCheckResult } from '@/types'

// Provider registry — add new utility providers here as they are implemented
const PROVIDERS: Record<string, WaterUtilityProvider> = {
  SAWS: new SawsProvider(),
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function getLocalHour(timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
  return parseInt(fmt.format(new Date()))
}

function getLocalDateString(timezone: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function getLocalDayOfWeek(timezone: string, offsetDays = 0): number {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(fmt.format(d))
}

function toMDY(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

// Returns true if the given hour falls outside the business's open window.
// A day marked is_open=false means ALL hours are after-hours.
function isHourAfterHours(hour: number, bh: WaterBusinessHours): boolean {
  if (!bh.is_open) return true
  if (!bh.open_time || !bh.close_time) return false
  const openHour = parseInt(bh.open_time.split(':')[0])
  const closeHour = parseInt(bh.close_time.split(':')[0])
  return hour < openHour || hour >= closeHour
}

function buildSmsMessage(businessName: string, utilityProvider: string, reason: string): string {
  return [
    'Water Leak Alert',
    `Business: ${businessName}`,
    `Utility: ${utilityProvider}`,
    'Potential leak detected.',
    `Reason: ${reason}`,
    'Please inspect your property.',
    'Reply STOP to opt out.',
  ].join('\n')
}

// ─── Core engine ─────────────────────────────────────────────────────────────

// Columns that are safe to return — never select utility_password_encrypted
const SAFE_COLS =
  'id, business_id, business_name, city, state, utility_provider, utility_username, ' +
  'utility_password_encrypted, meter_id, move_in_date, phone_number, timezone, check_time, active, created_at'

export async function runWaterCheck(
  testMode = false,
  customerId?: string
): Promise<WaterCheckResult> {
  const supabase = createServerSupabaseClient()
  const effectiveTestMode = testMode || process.env.ALERT_TEST_MODE === 'true'
  const result: WaterCheckResult = { processed: 0, alertsSent: 0, skipped: 0, failed: 0 }

  // Load active water customers (optionally filtered to one)
  let query = supabase.from('water_customers').select(SAFE_COLS).eq('active', true)
  if (customerId) query = query.eq('id', customerId)
  const { data: customers, error: custErr } = await query

  if (custErr || !customers) {
    console.error('[WaterEngine] Failed to load customers:', custErr)
    return result
  }

  for (const customer of customers as unknown as (WaterCustomer & { utility_password_encrypted: string })[]) {
    // When running globally, only process customers whose check_time hour matches now.
    // Each customer runs once per day at their preferred local hour.
    if (!customerId) {
      const localHour = getLocalHour(customer.timezone)
      const checkHour = parseInt(customer.check_time.split(':')[0])
      if (localHour !== checkHour) continue
    }

    result.processed++

    // Create scrape run record for audit trail
    const { data: scrapeRunRow } = await supabase
      .from('water_scrape_runs')
      .insert({ water_customer_id: customer.id, status: 'running' })
      .select('id')
      .single()
    const scrapeRunId = scrapeRunRow?.id

    try {
      // Decrypt password — never logged anywhere in this block
      const password = decrypt(customer.utility_password_encrypted)

      // Pull last 48 hours of data to ensure full coverage
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
      const startDate = toMDY(twoDaysAgo)
      const endDate = toMDY(now)

      const provider = PROVIDERS[customer.utility_provider]
      if (!provider) throw new Error(`No provider registered for utility: ${customer.utility_provider}`)

      const fetchResult = await provider.fetchUsage({
        username: customer.utility_username,
        password,
        meterId: customer.meter_id ?? undefined,
        moveInDate: customer.move_in_date ?? undefined,
        startDate,
        endDate,
      })

      // Auto-save captured meterId / moveInDate on first run (best-effort)
      if (fetchResult.capturedMeterId && !customer.meter_id) {
        await supabase
          .from('water_customers')
          .update({
            meter_id: fetchResult.capturedMeterId,
            ...(fetchResult.capturedMoveInDate ? { move_in_date: fetchResult.capturedMoveInDate } : {}),
          })
          .eq('id', customer.id)
      }

      // Upsert hourly usage records (unique constraint handles duplicates from re-runs)
      if (fetchResult.hours.length > 0) {
        await supabase.from('water_usage_records').upsert(
          fetchResult.hours.map(h => ({
            water_customer_id: customer.id,
            usage_date: h.date,
            hour: h.hour,
            gallons: h.gallons,
          })),
          { onConflict: 'water_customer_id,usage_date,hour' }
        )
      }

      // Update scrape run to success
      if (scrapeRunId) {
        await supabase
          .from('water_scrape_runs')
          .update({
            status: 'success',
            finished_at: new Date().toISOString(),
            rows_retrieved: fetchResult.hours.length,
          })
          .eq('id', scrapeRunId)
      }

      // Load alert settings — fall back to defaults if not configured yet
      const { data: settingsRow } = await supabase
        .from('water_alert_settings')
        .select('*')
        .eq('water_customer_id', customer.id)
        .maybeSingle()

      const settings: WaterAlertSettings = settingsRow ?? {
        id: '',
        water_customer_id: customer.id,
        after_hours_enabled: true,
        min_after_hours_gallons: 50,
        continuous_flow_enabled: true,
        continuous_flow_min_hourly_gallons: 0.1,
      }

      // Load business hours
      const { data: bhRows } = await supabase
        .from('water_business_hours')
        .select('*')
        .eq('water_customer_id', customer.id)
      const businessHours = (bhRows ?? []) as WaterBusinessHours[]

      // "Yesterday" in the customer's timezone is the most recent complete day
      const yesterdayStr = getLocalDateString(customer.timezone, -1)
      const yesterdayDow = getLocalDayOfWeek(customer.timezone, -1)
      const dayHours = businessHours.find(bh => bh.day_of_week === yesterdayDow)

      const alertsToRaise: Array<{ type: string; reason: string; date: string }> = []

      // ── Algorithm 1: After-hours usage ────────────────────────────────────
      // Sums gallons outside business hours for yesterday.
      // If the day is closed (is_open=false), all gallons count as after-hours.
      if (settings.after_hours_enabled) {
        const { data: yesterdayUsage } = await supabase
          .from('water_usage_records')
          .select('hour, gallons')
          .eq('water_customer_id', customer.id)
          .eq('usage_date', yesterdayStr)

        if (yesterdayUsage && yesterdayUsage.length > 0) {
          let afterHoursGallons = 0
          for (const record of yesterdayUsage) {
            if (!dayHours || isHourAfterHours(record.hour, dayHours)) {
              afterHoursGallons += Number(record.gallons)
            }
          }
          if (afterHoursGallons >= settings.min_after_hours_gallons) {
            alertsToRaise.push({
              type: 'after_hours',
              reason: `${Math.round(afterHoursGallons)} gallons used outside business hours on ${yesterdayStr}`,
              date: yesterdayStr,
            })
          }
        }
      }

      // ── Algorithm 2: Continuous 24-hour flow ──────────────────────────────
      // Normal usage has multiple zero/near-zero hours overnight.
      // If ALL 24 trailing hours show flow above the minimum, it's likely a leak.
      if (settings.continuous_flow_enabled) {
        const { data: last24 } = await supabase
          .from('water_usage_records')
          .select('hour, gallons, usage_date')
          .eq('water_customer_id', customer.id)
          .order('usage_date', { ascending: false })
          .order('hour', { ascending: false })
          .limit(24)

        if (last24 && last24.length === 24) {
          const allFlowing = last24.every(
            r => Number(r.gallons) >= settings.continuous_flow_min_hourly_gallons
          )
          if (allFlowing) {
            alertsToRaise.push({
              type: 'continuous_flow',
              reason: 'Continuous water flow detected for the previous 24 hours',
              date: yesterdayStr,
            })
          }
        }
      }

      // ── Send / log alerts ─────────────────────────────────────────────────
      for (const alert of alertsToRaise) {
        const idempotencyKey = `${customer.id}:${alert.type}:${alert.date}`

        // Skip if already sent today (prevents re-alerting on same leak)
        const { data: existing } = await supabase
          .from('water_alerts')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .eq('status', 'sent')
          .maybeSingle()

        if (existing) {
          result.skipped++
          continue
        }

        const message = buildSmsMessage(customer.business_name, customer.utility_provider, alert.reason)

        if (effectiveTestMode) {
          await supabase.from('water_alerts').insert({
            water_customer_id: customer.id,
            alert_type: alert.type,
            message,
            detection_date: alert.date,
            status: 'test_logged',
            provider: 'test',
            idempotency_key: idempotencyKey,
          })
          result.alertsSent++
          continue
        }

        const smsResult = await sendSms(customer.phone_number, message)

        await supabase.from('water_alerts').insert({
          water_customer_id: customer.id,
          alert_type: alert.type,
          message,
          detection_date: alert.date,
          status: smsResult.success ? 'sent' : 'failed',
          provider: 'twilio',
          provider_message_id: smsResult.messageId ?? null,
          error_message: smsResult.error ?? null,
          idempotency_key: idempotencyKey,
        })

        if (smsResult.success) result.alertsSent++
        else result.failed++
      }

      if (alertsToRaise.length === 0) result.skipped++

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      // Never log the password — err.message is safe (we never put password in Error messages)
      console.error(`[WaterEngine] Customer ${customer.id} (${customer.business_name}) failed:`, errMsg)

      if (scrapeRunId) {
        await supabase
          .from('water_scrape_runs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            error_message: errMsg,
          })
          .eq('id', scrapeRunId)
      }
      result.failed++
    }
  }

  return result
}
