import { createServerSupabaseClient } from '@/lib/supabase'
import { getCurrentTemperatureF } from '@/lib/weather'
import { sendSms } from '@/lib/sms'
import type { AlertCheckResult, Location, Contact, UtilityRateRule, AlertTemplate } from '@/types'

// ─── Time helpers ─────────────────────────────────────────────────────────────

// Returns the current date/time broken into parts using the location's local timezone.
function getLocalTimeParts(timezone: string) {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
    weekday: 'short',
  })

  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))

  return {
    year: parseInt(parts.year),
    month: parseInt(parts.month),   // 1–12
    day: parseInt(parts.day),       // 1–31
    hour: parseInt(parts.hour),     // 0–23
    minute: parseInt(parts.minute),
    // JS-compatible day of week: Sun=0, Mon=1 … Sat=6
    dayOfWeek: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),
    // "YYYY-MM-DD" in local time — used as the date portion of the idempotency key
    dateString: `${parts.year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`,
  }
}

// Converts a Postgres time string "HH:MM:SS" to total minutes since midnight.
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Returns true if the current local time (hour + minute) falls within [start, end].
// Handles overnight ranges (e.g. 22:00 to 06:00).
function isTimeInWindow(hour: number, minute: number, start: string, end: string): boolean {
  const current = hour * 60 + minute
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)

  if (startMin <= endMin) {
    return current >= startMin && current <= endMin
  }
  // Overnight: e.g. 22:00–06:00
  return current >= startMin || current <= endMin
}

// Returns true if today (month/day) falls within the rule's season window.
// Does not handle seasons that wrap around year-end (Dec→Jan) — not needed for June–Sep.
function isInSeason(month: number, day: number, rule: UtilityRateRule): boolean {
  const current = month * 100 + day                               // e.g. 615 for June 15
  const start = rule.season_start_month * 100 + rule.season_start_day
  const end = rule.season_end_month * 100 + rule.season_end_day
  return current >= start && current <= end
}

// ─── Template rendering ───────────────────────────────────────────────────────

function renderTemplate(template: AlertTemplate, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, val]) => msg.replaceAll(`{{${key}}}`, val),
    template.message_body
  )
}

// ─── Core engine ─────────────────────────────────────────────────────────────

export async function runAlertCheck(testMode = false): Promise<AlertCheckResult> {
  const supabase = createServerSupabaseClient()
  const effectiveTestMode = testMode || process.env.ALERT_TEST_MODE === 'true'

  const result: AlertCheckResult = { processed: 0, sent: 0, skipped: 0, failed: 0 }

  // 1. Load all active locations that have coordinates
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('*')
    .eq('active', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)

  if (locErr || !locations) {
    console.error('[AlertEngine] Failed to load locations:', locErr)
    return result
  }

  // 2. Load all active alert templates once (reused across locations)
  const { data: templates } = await supabase
    .from('alert_templates')
    .select('*')
    .eq('active', true)

  for (const location of locations as Location[]) {
    result.processed++

    const local = getLocalTimeParts(location.timezone)

    // 3. Fetch current temperature and save a weather observation record
    let temperatureF: number
    try {
      temperatureF = await getCurrentTemperatureF(location.latitude!, location.longitude!)
    } catch (err) {
      console.error(`[AlertEngine] Weather fetch failed for location ${location.id}:`, err)
      result.failed++
      continue
    }

    await supabase.from('weather_observations').insert({
      location_id: location.id,
      provider: process.env.WEATHER_PROVIDER ?? 'open_meteo',
      temperature_f: temperatureF,
      observed_at: new Date().toISOString(),
    })

    // 4. Find matching utility rate rules
    const { data: allRules } = await supabase
      .from('utility_rate_rules')
      .select('*')
      .eq('city', location.city)
      .eq('state', location.state)
      .eq('utility_name', location.utility_name)
      .eq('active', true)

    const matchingRules = (allRules as UtilityRateRule[] ?? []).filter(rule =>
      isInSeason(local.month, local.day, rule) &&
      rule.active_days_of_week.includes(local.dayOfWeek) &&
      isTimeInWindow(local.hour, local.minute, rule.start_time_local, rule.end_time_local) &&
      temperatureF >= rule.min_temperature_f
    )

    // 5. No rules match — log a single skipped record and move on
    if (matchingRules.length === 0) {
      await supabase.from('alert_logs').insert({
        business_id: location.business_id,
        location_id: location.id,
        temperature_f: temperatureF,
        status: 'skipped',
        skip_reason: 'No matching rules (outside window, season, day, or temp threshold)',
      })
      result.skipped++
      continue
    }

    // 6. Load contacts for this business who want alerts and haven't opted out
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('business_id', location.business_id)
      .eq('receive_alerts', true)
      .eq('opt_out_status', 'subscribed')

    if (!contacts || contacts.length === 0) {
      result.skipped++
      continue
    }

    // 7. For each rule + contact pair — check, render, send
    for (const rule of matchingRules) {
      for (const contact of contacts as Contact[]) {
        const idempotencyKey = `${location.id}:${contact.id}:${rule.id}:${local.dateString}`

        // 7a. Skip if already sent today
        const { data: existing } = await supabase
          .from('alert_logs')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .eq('status', 'sent')
          .maybeSingle()

        if (existing) {
          result.skipped++
          continue
        }

        // 7b. Skip if inside contact's quiet hours
        if (contact.quiet_hours_start && contact.quiet_hours_end) {
          if (isTimeInWindow(local.hour, local.minute, contact.quiet_hours_start, contact.quiet_hours_end)) {
            await supabase.from('alert_logs').insert({
              business_id: location.business_id,
              location_id: location.id,
              contact_id: contact.id,
              rule_id: rule.id,
              temperature_f: temperatureF,
              status: 'skipped',
              skip_reason: 'Contact quiet hours',
              idempotency_key: idempotencyKey,
            })
            result.skipped++
            continue
          }
        }

        // 7c. Find the template matching this rule's severity
        const template = (templates as AlertTemplate[] ?? []).find(
          t => t.severity === rule.severity
        )

        if (!template) {
          console.warn(`[AlertEngine] No template found for severity: ${rule.severity}`)
          result.skipped++
          continue
        }

        // 7d. Render the message
        const messageBody = renderTemplate(template, {
          temperature_f: Math.round(temperatureF).toString(),
          city: location.city,
          utility_name: location.utility_name,
          end_time: rule.end_time_local.slice(0, 5),   // "19:00:00" → "19:00"
        })

        // 7e. Test mode — log without sending
        if (effectiveTestMode) {
          await supabase.from('alert_logs').insert({
            business_id: location.business_id,
            location_id: location.id,
            contact_id: contact.id,
            rule_id: rule.id,
            temperature_f: temperatureF,
            message_body: messageBody,
            status: 'test_logged',
            provider: 'test',
            idempotency_key: idempotencyKey,
          })
          result.sent++
          continue
        }

        // 7f. Send real SMS and log the outcome
        const smsResult = await sendSms(contact.phone_number, messageBody)

        await supabase.from('alert_logs').insert({
          business_id: location.business_id,
          location_id: location.id,
          contact_id: contact.id,
          rule_id: rule.id,
          temperature_f: temperatureF,
          message_body: messageBody,
          status: smsResult.success ? 'sent' : 'failed',
          provider: 'twilio',
          provider_message_id: smsResult.messageId ?? null,
          error_message: smsResult.error ?? null,
          sent_at: smsResult.success ? new Date().toISOString() : null,
          idempotency_key: idempotencyKey,
        })

        if (smsResult.success) {
          result.sent++
        } else {
          result.failed++
        }
      }
    }
  }

  return result
}
